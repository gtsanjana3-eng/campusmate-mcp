# Demo script

> **Planned.** These journeys are the acceptance tests for the MVP. Each one is marked done only
> after it has been run on the deployed URL.

## J0: First-time setup

1. Open the dashboard and sign in (owner account, or create one with the invite code).
2. Open **Connect**, copy the MCP URL and token.
3. In Claude: Customize → Connectors → Add custom connector → paste the URL, add header
   `Authorization: Bearer <token>`.
4. Run the test prompt shown on the Connect page.

## J1: "Can I skip OS tomorrow?"

1. Ask Claude the question.
2. Expected: Claude calls `get_attendance` and answers "77%, you can miss 1 more class".
3. The read appears on **Activity** within 5 seconds.

## J2: "Email Prof. Rao for a 2-day extension on the DBMS assignment"

1. Claude calls `draft_faculty_email` and says the email is waiting for approval.
2. The Approvals badge shows 1. Open the card, edit a line, approve.
3. Expected: the email is in the mock outbox; Activity says it was sent after your approval.
4. Ask Claude "Did my email go out?": `get_today` shows the action as done.

## J3: Notice with a hidden instruction

1. Paste the seeded "lab record" notice into Claude and ask it to add anything important.
2. Expected: an `add_deadline` card (correct) and, if the model follows the hidden instruction, an
   email card addressed to faculty.
3. Approve the deadline, reject the email. Nothing happened without a yes.

## J4: Switching an ability off

1. On **Permissions**, turn off "Draft emails".
2. Ask Claude to email a faculty member.
3. Expected: the tool refuses with an explanation; Activity logs it as "blocked".
