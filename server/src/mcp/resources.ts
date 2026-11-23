import type { McpServer } from '@modelcontextprotocol/server';
import { requireAbility } from '../domain/abilities.ts';
import { attendanceMinimum, getTimetable } from '../domain/academic.ts';
import { logActivity } from '../domain/activity.ts';
import type { ToolDeps } from './defineTool.ts';

/** Reference material an AI host can attach to a conversation. Both need the "resources" ability. */
export function registerResources(server: McpServer, deps: ToolDeps): void {
  const allow = (summary: string) => {
    // Throws an AppError when switched off; the SDK returns it to the client as an error.
    requireAbility(deps.store, 'resources');
    logActivity(deps.store, { kind: 'read', summary });
  };

  server.registerResource(
    'timetable',
    'campusmate://timetable',
    {
      title: 'Weekly timetable',
      description: "The student's Monday–Saturday class timetable (times in India Standard Time).",
      mimeType: 'application/json',
    },
    async (uri) => {
      allow('Shared your weekly timetable as reference.');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ classes: getTimetable(deps.store) }, null, 2),
          },
        ],
      };
    },
  );

  server.registerResource(
    'rules',
    'campusmate://rules',
    {
      title: 'College rules and etiquette',
      description: 'Attendance minimum and how to write to faculty.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      allow('Shared the college rules as reference.');
      const minimum = Math.round(attendanceMinimum(deps.store) * 100);
      const text = [
        '# College rules',
        '',
        `- Minimum attendance per subject: **${minimum}%**. Below it, the student may not be allowed to sit the exam.`,
        '- Use get_attendance for exact "can I skip?" numbers; never estimate.',
        '',
        '# Writing to faculty',
        '',
        '- Greet them by title (Prof./Dr.) and surname.',
        '- One clear request per email; give the reason and, for extensions, a specific new date.',
        "- Keep it short and polite; sign with the student's name, roll number and section.",
        '- Every email is a proposal until the student approves it in CampusMate.',
      ].join('\n');
      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text }] };
    },
  );
}
