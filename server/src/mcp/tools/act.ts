import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { ActionPreview } from '../../../../shared/types/index.ts';
import type { Store, SubjectRecord } from '../../data/store.ts';
import { resolveSubject } from '../../domain/academic.ts';
import { describe, propose } from '../../domain/approvals.ts';
import { AppError, conflict, notFound, validationError } from '../../domain/errors.ts';
import { defineTool, type ToolDeps } from '../defineTool.ts';
import { DeadlineKind, isoDateTime, ProposalOutput, reason, subjectCode } from './schemas.ts';

const APPROVAL_NOTE =
  'This only creates a request. Nothing happens until the student approves it in the CampusMate dashboard; ' +
  'tell them it is waiting there. You cannot approve it yourself.';

const normalise = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b(prof|dr|mr|ms|mrs)\.?\s*/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The recipient always comes from CampusMate's faculty list, never from the AI's input. */
function resolveFaculty(
  store: Store,
  input: { subjectCode?: string; facultyName?: string },
): SubjectRecord {
  if (input.subjectCode) return resolveSubject(store, input.subjectCode);
  if (!input.facultyName) throw validationError('Give either subjectCode or facultyName.');

  const wanted = normalise(input.facultyName);
  const subjects = store.listSubjects();
  const matches = subjects.filter((s) => {
    const name = normalise(s.facultyName);
    return name === wanted || name.split(' ').includes(wanted) || name.includes(wanted);
  });
  const unique = [...new Map(matches.map((s) => [s.facultyEmail, s])).values()];
  if (unique.length === 1 && unique[0]) return unique[0];

  const known = subjects.map((s) => `${s.facultyName} (${s.code})`).join(', ');
  throw new AppError(
    'not_found',
    404,
    unique.length > 1
      ? `“${input.facultyName}” matches more than one faculty member. Use subjectCode instead. Faculty: ${known}.`
      : `No faculty member matches “${input.facultyName}”. Faculty: ${known}.`,
  );
}

function requireFuture(iso: string, what: string, now: Date) {
  if (Date.parse(iso) <= now.getTime()) throw validationError(`${what} must be in the future.`);
}

/** Records the proposal and builds the reply; shared by all four act tools. */
function proposal(deps: ToolDeps, preview: ActionPreview, why: string) {
  const action = propose(deps.store, { preview, reason: why }, deps.now());
  const what = describe(preview);
  return {
    text:
      `Waiting for the student's approval: ${what}. Nothing has been done yet. ` +
      'The student can approve, reject or (for emails) edit it in the CampusMate dashboard.',
    activity: `Proposed: ${what}. Reason given: “${why.replace(/[.!?]+$/, '')}”.`,
    actionId: action.id,
    structured: {
      actionId: action.id,
      status: 'pending' as const,
      preview,
      message: 'Waiting for approval in the CampusMate dashboard.',
    },
  };
}

/** The four act tools. Each one can only create a pending action; none of them executes anything. */
export function registerActTools(server: McpServer, deps: ToolDeps): void {
  defineTool(
    server,
    deps,
    {
      name: 'draft_faculty_email',
      kind: 'act',
      title: 'Draft an email to faculty',
      description:
        "Drafts a polite email to one of the student's faculty members (e.g. extension request, leave, doubt). " +
        'Identify the recipient by subjectCode or facultyName; the email address is looked up by CampusMate. ' +
        `In this demo, approved emails go to the CampusMate demo outbox, not a real inbox. ${APPROVAL_NOTE}`,
      inputSchema: z.object({
        subjectCode: subjectCode
          .optional()
          .describe('Subject whose faculty member to email, e.g. "DBMS".'),
        facultyName: z
          .string()
          .trim()
          .min(2)
          .max(80)
          .optional()
          .describe('Faculty name, e.g. "Prof. Rao".'),
        purpose: z.enum(['extension', 'leave', 'doubt', 'other']),
        subject: z.string().trim().min(3).max(120).describe('Email subject line.'),
        body: z
          .string()
          .trim()
          .min(10)
          .max(2000)
          .describe("Full email body, signed with the student's name."),
        reason,
      }),
      outputSchema: ProposalOutput,
    },
    (input) => {
      const faculty = resolveFaculty(deps.store, input);
      return proposal(
        deps,
        {
          tool: 'draft_faculty_email',
          email: {
            toName: faculty.facultyName,
            toEmail: faculty.facultyEmail,
            subject: input.subject,
            body: input.body,
          },
        },
        input.reason,
      );
    },
  );

  defineTool(
    server,
    deps,
    {
      name: 'add_deadline',
      kind: 'act',
      title: 'Add a deadline',
      description:
        'Proposes adding a deadline, for example one found in a notice the student pasted. Pass sourceNoticeId when ' +
        `it came from a CampusMate notice. ${APPROVAL_NOTE}`,
      inputSchema: z.object({
        subjectCode,
        title: z.string().trim().min(3).max(120),
        dueAt: isoDateTime.describe(
          'When it is due, ISO 8601 with offset, e.g. 2026-11-28T16:00:00+05:30.',
        ),
        kind: DeadlineKind,
        sourceNoticeId: z.string().trim().max(60).optional(),
        reason,
      }),
      outputSchema: ProposalOutput,
    },
    (input) => {
      const now = deps.now();
      requireFuture(input.dueAt, 'dueAt', now);
      const subject = resolveSubject(deps.store, input.subjectCode);
      if (input.sourceNoticeId && !deps.store.hasNotice(input.sourceNoticeId))
        throw notFound('Notice');
      return proposal(
        deps,
        {
          tool: 'add_deadline',
          deadline: {
            subjectCode: subject.code,
            title: input.title,
            dueAt: input.dueAt,
            kind: input.kind,
            source: input.sourceNoticeId ? 'notice' : 'student',
          },
        },
        input.reason,
      );
    },
  );

  defineTool(
    server,
    deps,
    {
      name: 'create_reminder',
      kind: 'act',
      title: 'Create a reminder',
      description:
        'Proposes a reminder at a specific time, optionally linked to a deadline (use its id from list_deadlines). ' +
        `Reminders are stored in CampusMate. ${APPROVAL_NOTE}`,
      inputSchema: z.object({
        text: z.string().trim().min(3).max(140),
        remindAt: isoDateTime.describe('When to remind, ISO 8601 with offset.'),
        deadlineId: z.string().trim().max(60).optional(),
        reason,
      }),
      outputSchema: ProposalOutput,
    },
    (input) => {
      requireFuture(input.remindAt, 'remindAt', deps.now());
      if (input.deadlineId && !deps.store.getDeadline(input.deadlineId)) throw notFound('Deadline');
      return proposal(
        deps,
        {
          tool: 'create_reminder',
          reminder: {
            text: input.text,
            remindAt: input.remindAt,
            ...(input.deadlineId ? { deadlineId: input.deadlineId } : {}),
          },
        },
        input.reason,
      );
    },
  );

  defineTool(
    server,
    deps,
    {
      name: 'mark_deadline_done',
      kind: 'act',
      title: 'Mark a deadline as done',
      description:
        'Proposes marking a deadline as submitted or finished, after the student says they did it. Use the id from ' +
        `list_deadlines. ${APPROVAL_NOTE}`,
      inputSchema: z.object({ deadlineId: z.string().trim().min(1).max(60), reason }),
      outputSchema: ProposalOutput,
    },
    (input) => {
      const deadline = deps.store.getDeadline(input.deadlineId);
      if (!deadline) throw notFound('Deadline');
      if (deadline.status === 'done') throw conflict('That deadline is already marked as done.');
      return proposal(deps, { tool: 'mark_deadline_done', deadline }, input.reason);
    },
  );
}
