# External integrations

## Status

| Source                                   | Status                                                                                                                                         | What students see                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Google Calendar** (approved reminders) | **Built and tested against a simulated Google. Not yet verified against real Google** (needs OAuth credentials, below). Off unless configured. | Connect page: "Not available", "Not connected", "Connected" or "Reconnect needed" |
| Email to faculty                         | **Demo outbox** by design: approved emails are stored, never sent                                                                              | "Delivered to the CampusMate demo outbox"                                         |
| College portal (timetable, attendance)   | **Demo data**: no public API exists                                                                                                            | "Demo data" notice on every page                                                  |
| WhatsApp notices                         | **Demo data / paste-in**: no API for personal or group chats                                                                                   | Same notice                                                                       |

Only Google Calendar is a real integration, as approved. Nothing else is replaced.

## Google Calendar

### What it does

When the student **approves** a `create_reminder` action, CampusMate saves the reminder and, if
Google Calendar is connected, adds it to a calendar called **"CampusMate"** in their Google account.

- The reminder is **always saved in CampusMate first**. A Google problem never loses it.
- Nothing is sent to Google before approval; proposals and all read tools make no Google calls.
- The approval result says exactly what happened, e.g. "Also added to your 'CampusMate' Google
  Calendar" or "Saved in CampusMate, but not added to Google Calendar: access expired…".

### Permission requested

One scope: `https://www.googleapis.com/auth/calendar.app.created`, the narrowest Calendar scope
([Google's list](https://developers.google.com/calendar/api/auth)). It lets CampusMate create its own
calendar and manage events **in that calendar only**. CampusMate **cannot see** the student's
other calendars or events. The callback refuses the connection if this scope wasn't granted.

### Data sent to Google

Per reminder: the reminder text, start time (end = start + 15 minutes) and a popup at the start
time. Nothing else: no name, subjects, attendance, deadlines or email addresses.

### Security

- OAuth web-server flow with a single-use random `state` (10 minutes), stored on the server and in
  an httpOnly, Secure, SameSite=Lax cookie scoped to `/api/integrations/google`. The callback must
  match both. (The session cookie is SameSite=Strict, so it is not sent on Google's redirect.)
- Only a logged-in student can start the connection.
- The **refresh token is encrypted** (AES-256-GCM, key derived from `SESSION_SECRET`) before it is
  stored; access tokens are kept in memory only. Tokens never reach the browser or the AI.
- Client ID and secret come from environment variables only; never commit them.
- Disconnecting revokes the grant at Google and deletes the stored token.

### Failure handling

| Situation                                                                                    | Behaviour                                                                                                               |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Access token expired (hourly)                                                                | Refresh once, retry once                                                                                                |
| Refresh token expired or revoked (`invalid_grant`), or calendar access removed (401/403/404) | Mark **Reconnect needed**; reminder stays saved in CampusMate; later approvals skip Google until reconnected            |
| Network error, 429 or 5xx                                                                    | Retry twice (300 ms, 900 ms), 8 s timeout per call; then "could not be reached", reminder stays saved, connection stays |
| Student declines on Google                                                                   | Back to Connect: "You chose not to connect"                                                                             |
| Bad or reused `state`, missing cookie                                                        | Rejected; nothing stored                                                                                                |

### Set-up (needs your Google account)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the
   **Google Calendar API**.
2. Configure the **OAuth consent screen**: External, Testing; add your Google account under
   **Test users**.
3. Create an **OAuth client ID** of type **Web application** with this authorised redirect URI:
   `<PUBLIC_URL>/api/integrations/google/callback`
   (e.g. `https://campusmate.onrender.com/api/integrations/google/callback`).
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server (`.env` locally, the host's
   settings when deployed). Both or neither; empty means off.
5. Restart, log in, open **Connect → Connect Google Calendar**, and approve.
6. Verify: approve a reminder, then check a "CampusMate" calendar appears in Google Calendar with it.

### Limitations

- **Testing mode** ([Google](https://support.google.com/cloud/answer/15549945)): up to 100 test users,
  and sign-ins expire after **7 days**. CampusMate then shows "Reconnect needed". Publishing the
  app removes the 7-day limit but requires Google's review.
- One student per server (the demo has no per-student accounts).
- Reminders can't be edited or deleted from CampusMate after approval (undo is not built).
- Not verified against real Google yet; the steps above are the verification.

## Tests

`server/src/api/integrations.test.ts` runs the whole flow against a simulated Google
(`server/src/test/fakeGoogle.ts`): narrow scope, state checks, declined consent, missing scope,
missing refresh token, encryption at rest, no Google calls for reads or proposals, approved
reminder content, token refresh, expiry and revocation, outages and retries, and disconnect.
`web/src/components/sections/CalendarCard.test.tsx` covers the dashboard states.
