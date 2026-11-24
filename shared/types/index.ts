/**
 * CampusMate API contract, shared by server/ and web/ (import from '@shared/types').
 * Matches the approved architecture (Phase 4 §4–5) with fix F3 (pending summary in today views).
 * Dates are ISO 8601 strings; times are 'HH:MM' in the student's timezone.
 */

// ---------- Academic data ----------

/** Days with classes. */
export type ClassDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
/** Any day; Sunday appears only in study plans. */
export type Weekday = ClassDay | 'sun';

export interface Subject {
  code: string;
  name: string;
  facultyName: string;
}

export interface ClassSession {
  subjectCode: string;
  subjectName: string;
  day: ClassDay;
  start: string;
  end: string;
  room: string;
  kind: 'lecture' | 'lab' | 'tutorial';
}

export interface Deadline {
  id: string;
  subjectCode: string;
  title: string;
  dueAt: string;
  kind: 'assignment' | 'exam' | 'other';
  status: 'open' | 'done';
  source: 'seed' | 'notice' | 'student';
}

export interface AttendanceRow {
  subjectCode: string;
  subjectName: string;
  attended: number;
  held: number;
  percent: number;
  /** Classes that can still be missed while staying at or above the minimum (0 when below it). */
  canMiss: number;
  /** Consecutive classes needed to get back to the minimum (0 when at or above it). */
  mustAttend: number;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  postedAt: string;
  from: string;
}

export interface StudyBlock {
  /** Calendar date in India, 'YYYY-MM-DD'. */
  date: string;
  day: Weekday;
  start: string;
  end: string;
  task: string;
  deadlineId?: string;
}

// ---------- Control: approvals, activity, abilities ----------

export type ActToolName =
  'draft_faculty_email' | 'add_deadline' | 'create_reminder' | 'mark_deadline_done';

export type ReadToolName =
  | 'get_today'
  | 'get_timetable'
  | 'list_deadlines'
  | 'get_attendance'
  | 'list_notices'
  | 'plan_week';

export type ToolName = ReadToolName | ActToolName;

export type ActionStatus = 'pending' | 'approved' | 'done' | 'rejected' | 'failed' | 'expired';

export interface EmailPreview {
  toName: string;
  toEmail: string;
  subject: string;
  body: string;
}

export interface ReminderPreview {
  text: string;
  remindAt: string;
  deadlineId?: string;
}

export type ActionPreview =
  | { tool: 'draft_faculty_email'; email: EmailPreview }
  | { tool: 'add_deadline'; deadline: Omit<Deadline, 'id' | 'status'> }
  | { tool: 'create_reminder'; reminder: ReminderPreview }
  | { tool: 'mark_deadline_done'; deadline: Deadline };

export interface PendingAction {
  id: string;
  status: ActionStatus;
  /** Why the AI wants to do this; shown on the approval card. */
  reason: string;
  /** One plain sentence, e.g. "Email to Prof. K. Rao: “Extension request”". */
  summary: string;
  preview: ActionPreview;
  createdAt: string;
  /** When an undecided action expires (createdAt + 24 h). */
  expiresAt: string;
  decidedAt?: string;
  /** Failure explanation when status is 'failed'. */
  error?: string;
  /** Follow-up result, e.g. whether an approved reminder was also added to Google Calendar. */
  note?: string;
}

/** Short form used by get_today and the header badge (fix F3). */
export interface PendingSummary {
  id: string;
  tool: ActToolName;
  status: ActionStatus;
  summary: string;
}

export type ActivityKind =
  'read' | 'proposed' | 'approved' | 'rejected' | 'blocked' | 'failed' | 'edited';

export interface ActivityEntry {
  id: string;
  at: string;
  kind: ActivityKind;
  tool?: ToolName;
  /** Plain-language sentence, e.g. "Read your attendance because you asked about OS." */
  summary: string;
  actionId?: string;
}

export type AbilityName = ToolName | 'resources';

export interface Ability {
  name: AbilityName;
  group: 'read' | 'act';
  label: string;
  enabled: boolean;
}

// ---------- REST API (/api) ----------

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface SessionRequest {
  passcode: string;
}

/** GET /api/session — lets the dashboard check whether its cookie is still valid. */
export interface SessionStatusResponse {
  authenticated: true;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  db: 'ok' | 'down';
}

export interface TodayResponse {
  date: string;
  classes: ClassSession[];
  dueSoon: Deadline[];
  attendanceAlerts: AttendanceRow[];
  pendingCount: number;
}

export interface DeadlinesResponse {
  deadlines: Deadline[];
}

export interface AttendanceResponse {
  minimumPercent: number;
  subjects: AttendanceRow[];
}

export interface ApprovalsResponse {
  actions: PendingAction[];
}

/** PATCH /api/approvals/:id — email drafts only. */
export interface EditEmailRequest {
  subject?: string;
  body?: string;
}

export interface ActionResponse {
  action: PendingAction;
}

export interface ActivityResponse {
  entries: ActivityEntry[];
}

export interface AbilitiesResponse {
  abilities: Ability[];
}

export interface UpdateAbilityRequest {
  enabled: boolean;
}

export interface AbilityResponse {
  ability: Ability;
}

export interface ConnectResponse {
  mcpUrl: string;
  token: string;
  testPrompt: string;
}

/**
 * External connection status. not_configured: this server has no Google credentials;
 * needs_reconnect: access expired or was revoked.
 */
export interface IntegrationStatus {
  provider: 'google_calendar';
  state: 'not_configured' | 'disconnected' | 'connected' | 'needs_reconnect';
  connectedAt?: string;
}

export interface IntegrationsResponse {
  integrations: IntegrationStatus[];
}

export interface ConnectIntegrationResponse {
  /** Google consent page to open in the same tab. */
  authUrl: string;
}

// ---------- MCP tool structured outputs ----------

export interface GetTodayOutput {
  date: string;
  /** Current time in India, e.g. 2026-11-24T10:30:00+05:30. The AI uses it to resolve "tomorrow", "in 2 hours". */
  now: string;
  weekday: Weekday;
  classes: ClassSession[];
  dueSoon: Deadline[];
  attendanceAlerts: AttendanceRow[];
  /** Proposals from the last 24 hours, so the AI can tell the student what happened (fix F3). */
  pending: PendingSummary[];
}

export interface ProposeOutput {
  actionId: string;
  status: 'pending';
  preview: ActionPreview;
  message: string;
}
