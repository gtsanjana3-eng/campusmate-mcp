/**
 * What each permission switch controls, shown on the Permissions page so the student can see
 * which MCP tool it is and exactly what data it touches. Keys match the server's ability names.
 */
export const ABILITY_DETAILS: Record<string, { tool: string; detail: string }> = {
  get_today: {
    tool: 'get_today',
    detail:
      "Reads today's classes, what's due in 72 hours, attendance alerts and your recent requests.",
  },
  get_timetable: {
    tool: 'get_timetable',
    detail: 'Reads your weekly timetable: subject, time and room.',
  },
  list_deadlines: {
    tool: 'list_deadlines',
    detail: 'Reads your deadlines: subject, title, due date and status.',
  },
  get_attendance: {
    tool: 'get_attendance',
    detail:
      'Reads classes attended and held per subject; CampusMate works out how many you can miss.',
  },
  list_notices: {
    tool: 'list_notices',
    detail: 'Reads college notices: title, text and who posted them.',
  },
  plan_week: {
    tool: 'plan_week',
    detail: 'Reads your timetable and open deadlines to suggest study times. Saves nothing.',
  },
  resources: {
    tool: 'campusmate://timetable, campusmate://rules',
    detail: 'Shares your timetable and the attendance and email rules as reference material.',
  },
  draft_faculty_email: {
    tool: 'draft_faculty_email',
    detail:
      'Proposes an email to one of your faculty (CampusMate looks up the address). Sent only if you approve.',
  },
  add_deadline: {
    tool: 'add_deadline',
    detail: 'Proposes a new deadline. Added only if you approve.',
  },
  create_reminder: {
    tool: 'create_reminder',
    detail: 'Proposes a reminder at a set time. Saved only if you approve.',
  },
  mark_deadline_done: {
    tool: 'mark_deadline_done',
    detail: 'Proposes marking a deadline as done. Changed only if you approve.',
  },
};
