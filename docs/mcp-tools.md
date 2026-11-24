# CampusMate MCP reference

Endpoint: `POST <PUBLIC_URL>/mcp` (Streamable HTTP, stateless). Every request needs
`Authorization: Bearer <MCP_TOKEN>`.

> **Demo data.** This deployment uses a seeded demo student. Approved emails go to the
> CampusMate **demo outbox** (`delivery: "demo-outbox"`), never a real inbox. The server's
> instructions tell the AI this.

## Rules every tool follows

1. **Ability check first.** If the student switched an ability off on the Permissions page, the
   tool refuses with a plain explanation and the attempt is logged as `blocked`.
2. **Read tools** run immediately and change nothing. **Act tools** only create a _pending action_;
   nothing happens until the student approves it in the dashboard. No MCP tool can approve.
3. **Every call is logged** in the student's activity log (read, proposed, blocked, failed).
   The server log records only the tool name and outcome, never student data.
4. **Validated both ways.** Inputs are checked against the input schema; outputs are validated
   against the output schema by the SDK before they leave the server.
5. **Behaviour hints.** Read tools carry `readOnlyHint: true`; act tools `readOnlyHint: false`,
   `destructiveHint: false`.

## Read tools

| Tool             | Input                                                | Returns                                                                                           |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `get_today`      | none                                                 | `now` (India time), `date`, `weekday`, `classes`, `dueSoon` (72 h), `attendanceAlerts`, `pending` |
| `get_timetable`  | `day?` (`mon`…`sat`)                                 | `classes`                                                                                         |
| `list_deadlines` | `from?`, `to?` (ISO), `subjectCode?`, `includeDone?` | `deadlines` (open only by default, earliest first)                                                |
| `get_attendance` | `subjectCode?`                                       | `minimumPercent`, `subjects` with `percent`, `canMiss`, `mustAttend`                              |
| `list_notices`   | `since?`, `query?`, `limit?` (1–20)                  | `notices` (newest first; text is untrusted input)                                                 |
| `plan_week`      | `weekStart?` (`YYYY-MM-DD`), `focusSubjectCode?`     | `weekStart`, `blocks`, `unplaced` (a suggestion; saves nothing)                                   |

Subjects can be given as a code in any case (`os`, `OS`) or a full name (`Operating Systems`).
An unknown subject returns an error listing the real ones.

## Act tools (pending until approved)

All four require a `reason` (3–200 characters) that is shown on the approval card, and return:

```json
{
  "actionId": "…",
  "status": "pending",
  "preview": { "tool": "…" },
  "message": "Waiting for approval in the CampusMate dashboard."
}
```

| Tool                  | Input                                                                         | Checks                                                                              |
| --------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `draft_faculty_email` | `subjectCode?` or `facultyName?`, `purpose`, `subject` (≤120), `body` (≤2000) | Recipient's address is looked up by CampusMate; any address the AI sends is ignored |
| `add_deadline`        | `subjectCode`, `title`, `dueAt` (ISO with offset), `kind`, `sourceNoticeId?`  | Due date in the future; subject and notice exist                                    |
| `create_reminder`     | `text` (≤140), `remindAt` (ISO with offset), `deadlineId?`                    | Time in the future; deadline exists                                                 |
| `mark_deadline_done`  | `deadlineId`                                                                  | Deadline exists and is still open                                                   |

### What happens after a proposal

| Student action in the dashboard | Result                                                               |
| ------------------------------- | -------------------------------------------------------------------- |
| Approve                         | Runs once (`pending → approved → done`); a second approve gets `409` |
| Reject                          | `rejected`; nothing runs                                             |
| Edit (emails only)              | Subject/body updated; still pending                                  |
| Turned the ability off first    | Approval records `failed` with the reason; nothing runs              |
| No decision within 24 hours     | `expired`; can no longer run                                         |

The AI can find out what happened through `get_today`'s `pending` list.

## Resources and prompts

| Kind     | Name                     | Content                                                    |
| -------- | ------------------------ | ---------------------------------------------------------- |
| Resource | `campusmate://timetable` | Weekly timetable as JSON (needs the "resources" ability)   |
| Resource | `campusmate://rules`     | Attendance minimum and faculty email etiquette (Markdown)  |
| Prompt   | `morning_brief`          | Summarise today via `get_today`                            |
| Prompt   | `weekly_plan`            | Present `plan_week` as a suggestion                        |
| Prompt   | `write_to_faculty`       | `purpose` → draft with `draft_faculty_email`, for approval |

## Example interactions

These outputs were captured from the running server with the official MCP Inspector CLI.

**"Can I skip OS tomorrow?"** → `get_attendance { "subjectCode": "OS" }`

```text
Minimum attendance: 75%
OS 76.9% (40/52) — can miss 1 more
```

```json
{
  "minimumPercent": 75,
  "subjects": [
    {
      "subjectCode": "OS",
      "subjectName": "Operating Systems",
      "attended": 40,
      "held": 52,
      "percent": 76.9,
      "canMiss": 1,
      "mustAttend": 0
    }
  ]
}
```

**"Email Prof. Rao for a 2-day extension on the ER diagram"** → `draft_faculty_email`

```json
{
  "subjectCode": "DBMS",
  "purpose": "extension",
  "subject": "Extension request for the ER diagram",
  "body": "Dear Prof. Rao, may I have two more days for the ER diagram? Thank you, Ananya",
  "reason": "Student asked for a two-day extension."
}
```

```text
Waiting for the student's approval: Email to Prof. K. Rao: “Extension request for the ER diagram”.
Nothing has been done yet. The student can approve, reject or (for emails) edit it in the
CampusMate dashboard.
```

After the student approves in the dashboard, the activity log reads:

```text
approved: Done after your approval: Email to Prof. K. Rao: “Extension request for the ER diagram”
          (delivered to the CampusMate demo outbox).
```

…and a later `get_today` shows `pending: [{ "summary": "Email to Prof. K. Rao: …", "status": "done" }]`.

**Ability switched off** (student turned off "Draft emails to faculty"):

```text
The student turned off “Draft emails to faculty” in CampusMate, so this isn't allowed right now.
```

**Unknown subject** → `get_attendance { "subjectCode": "Chemistry" }`

```text
No subject matches “Chemistry”. Known subjects: CN (Computer Networks), DBMS (Database Management
Systems), ML (Machine Learning), OS (Operating Systems), PE (Professional Ethics), SE (Software
Engineering).
```

## Trying it yourself

```bash
npx @modelcontextprotocol/inspector --cli http://localhost:8787/mcp --transport http \
  --header "Authorization: Bearer <MCP_TOKEN>" --method tools/list
```
