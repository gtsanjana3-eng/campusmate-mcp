import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';

const userMessage = (text: string) => ({
  messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }],
});

/**
 * Ready-made starters the student can pick in their AI app. Prompts only contain instructions;
 * they read no data themselves, so they need no ability check.
 */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'morning_brief',
    {
      title: 'Morning brief',
      description: "A short summary of today: classes, what's due soon and attendance to watch.",
    },
    () =>
      userMessage(
        'Give me my morning brief from CampusMate. Call get_today, then summarise in under 120 words: ' +
          "today's classes in order, anything due in the next 72 hours, any subject where my attendance needs care " +
          '(quote canMiss or mustAttend exactly), and the status of anything you proposed earlier.',
      ),
  );

  server.registerPrompt(
    'weekly_plan',
    {
      title: 'Plan my week',
      description: 'A study plan for the next 7 days around classes and deadlines.',
    },
    () =>
      userMessage(
        'Plan my study week with CampusMate. Call plan_week and present the sessions day by day. Point out any ' +
          'deadline in `unplaced`. This is only a suggestion: do not create reminders unless I ask, and remember ' +
          'any reminder you propose needs my approval in CampusMate.',
      ),
  );

  server.registerPrompt(
    'write_to_faculty',
    {
      title: 'Write to faculty',
      description: 'Draft a polite email to a faculty member for my approval.',
      argsSchema: z.object({
        purpose: z
          .enum(['extension', 'leave', 'doubt', 'other'])
          .describe('What the email is for.'),
      }),
    },
    ({ purpose }) =>
      userMessage(
        `Help me write a ${purpose} email to one of my faculty members. Ask me who it is for and the key details ` +
          'if I have not said. Read campusmate://rules for etiquette if you can. Then call draft_faculty_email with ' +
          'a clear subject, a short polite body signed with my name, and a one-sentence reason. Tell me it is waiting ' +
          'for my approval in CampusMate; it is not sent until I approve it.',
      ),
  );
}
