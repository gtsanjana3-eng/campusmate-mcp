import type {
  Ability,
  ActivityEntry,
  AttendanceResponse,
  PendingAction,
  SessionStatusResponse,
  TodayResponse,
} from '@shared/types';

/** Sample API responses for page tests, shaped exactly like the server's. */

export const today: TodayResponse = {
  date: '2026-11-24',
  classes: [
    {
      subjectCode: 'OS',
      subjectName: 'Operating Systems',
      day: 'tue',
      start: '09:00',
      end: '09:55',
      room: 'CSE-301',
      kind: 'lecture',
    },
  ],
  dueSoon: [
    {
      id: 'dl-cn-quiz',
      subjectCode: 'CN',
      title: 'CN Quiz 2 (Units 3–4)',
      dueAt: '2026-11-25T09:00:00+05:30',
      kind: 'exam',
      status: 'open',
      source: 'seed',
    },
  ],
  attendanceAlerts: [],
  pendingCount: 0,
};

export const attendance: AttendanceResponse = {
  minimumPercent: 75,
  subjects: [
    {
      subjectCode: 'OS',
      subjectName: 'Operating Systems',
      attended: 40,
      held: 52,
      percent: 76.9,
      canMiss: 1,
      mustAttend: 0,
    },
    {
      subjectCode: 'CN',
      subjectName: 'Computer Networks',
      attended: 30,
      held: 42,
      percent: 71.4,
      canMiss: 0,
      mustAttend: 6,
    },
    {
      subjectCode: 'SE',
      subjectName: 'Software Engineering',
      attended: 36,
      held: 40,
      percent: 90,
      canMiss: 8,
      mustAttend: 0,
    },
  ],
};

export const emailAction = (overrides: Partial<PendingAction> = {}): PendingAction => ({
  id: 'act-1',
  status: 'pending',
  reason: 'Student asked for a two-day extension.',
  summary: 'Email to Prof. K. Rao: “Extension request”',
  preview: {
    tool: 'draft_faculty_email',
    email: {
      toName: 'Prof. K. Rao',
      toEmail: 'k.rao@college.example.edu',
      subject: 'Extension request',
      body: 'Dear Prof. Rao,\nCould I have two more days?\nAnanya',
    },
  },
  createdAt: '2026-11-24T05:00:00.000Z',
  expiresAt: '2026-11-25T05:00:00.000Z',
  ...overrides,
});

export const activity: ActivityEntry[] = [
  {
    id: '2',
    at: '2026-11-24T05:01:00.000Z',
    kind: 'blocked',
    tool: 'draft_faculty_email',
    summary: 'Draft an email to faculty: turned off.',
  },
  {
    id: '1',
    at: '2026-11-24T05:00:00.000Z',
    kind: 'read',
    tool: 'get_attendance',
    summary: 'Read your attendance for OS.',
  },
];

export const abilities: Ability[] = [
  { name: 'get_attendance', group: 'read', label: 'Read your attendance', enabled: true },
  { name: 'draft_faculty_email', group: 'act', label: 'Draft emails to faculty', enabled: true },
];

export const session: SessionStatusResponse = {
  authenticated: true,
  user: { name: 'Ananya', email: 'ananya@college.test' },
  student: { name: 'Ananya', college: 'Demo Institute of Technology' },
};
