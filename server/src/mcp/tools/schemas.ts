import * as z from 'zod';
import type {
  ActionPreview,
  AttendanceRow,
  ClassSession,
  Deadline,
  Notice,
  PendingSummary,
  StudyBlock,
} from '../../../../shared/types/index.ts';

/*
 * Output schemas for MCP tools. Each one `satisfies` the shared API type, so the data the AI
 * receives can't drift from what the dashboard uses. The SDK validates every result against them.
 */

export const Day = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
export const AnyDay = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const DeadlineKind = z.enum(['assignment', 'exam', 'other']);
const ActionStatus = z.enum(['pending', 'approved', 'done', 'rejected', 'failed', 'expired']);
const ActTool = z.enum([
  'draft_faculty_email',
  'add_deadline',
  'create_reminder',
  'mark_deadline_done',
]);

export const ClassSessionSchema = z.object({
  subjectCode: z.string(),
  subjectName: z.string(),
  day: Day,
  start: z.string(),
  end: z.string(),
  room: z.string(),
  kind: z.enum(['lecture', 'lab', 'tutorial']),
}) satisfies z.ZodType<ClassSession>;

export const DeadlineSchema = z.object({
  id: z.string(),
  subjectCode: z.string(),
  title: z.string(),
  dueAt: z.string(),
  kind: DeadlineKind,
  status: z.enum(['open', 'done']),
  source: z.enum(['seed', 'notice', 'student']),
}) satisfies z.ZodType<Deadline>;

export const AttendanceRowSchema = z.object({
  subjectCode: z.string(),
  subjectName: z.string(),
  attended: z.number().int(),
  held: z.number().int(),
  percent: z.number(),
  canMiss: z.number().int(),
  mustAttend: z.number().int(),
}) satisfies z.ZodType<AttendanceRow>;

export const NoticeSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  postedAt: z.string(),
  from: z.string(),
}) satisfies z.ZodType<Notice>;

export const StudyBlockSchema = z.object({
  date: z.string(),
  day: AnyDay,
  start: z.string(),
  end: z.string(),
  task: z.string(),
  deadlineId: z.string().optional(),
}) satisfies z.ZodType<StudyBlock>;

export const PendingSummarySchema = z.object({
  id: z.string(),
  tool: ActTool,
  status: ActionStatus,
  summary: z.string(),
}) satisfies z.ZodType<PendingSummary>;

export const ActionPreviewSchema = z.discriminatedUnion('tool', [
  z.object({
    tool: z.literal('draft_faculty_email'),
    email: z.object({
      toName: z.string(),
      toEmail: z.string(),
      subject: z.string(),
      body: z.string(),
    }),
  }),
  z.object({
    tool: z.literal('add_deadline'),
    deadline: DeadlineSchema.omit({ id: true, status: true }),
  }),
  z.object({
    tool: z.literal('create_reminder'),
    reminder: z.object({
      text: z.string(),
      remindAt: z.string(),
      deadlineId: z.string().optional(),
    }),
  }),
  z.object({ tool: z.literal('mark_deadline_done'), deadline: DeadlineSchema }),
]) satisfies z.ZodType<ActionPreview>;

/** What every act tool returns: a proposal, never a completed action. */
export const ProposalOutput = z.object({
  actionId: z.string(),
  status: z.literal('pending'),
  preview: ActionPreviewSchema,
  message: z.string(),
});

// ---------- Shared input fields ----------

export const isoDateTime = z.iso.datetime({ offset: true });
export const reason = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .describe(
    'One sentence telling the student why you are proposing this. Shown on the approval card.',
  );
export const subjectCode = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .describe('Subject code such as "OS" or "DBMS", or the full subject name.');
export { DeadlineKind };
