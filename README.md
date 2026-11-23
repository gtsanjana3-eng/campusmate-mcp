# CampusMate MCP

**Your college life, in your AI assistant, and nothing happens without your yes.**

wHACKiest 2026 · Track 1: Make MCP Matter

> **Status: foundation.** The server runs: it answers the MCP handshake (bearer token required),
> serves `/api/health` and hosts the dashboard. No MCP tools or dashboard pages exist yet; they are
> built next (see [Roadmap](#roadmap)). Anything marked _planned_ doesn't work yet.

## The problem

A student's day is spread across the college portal (attendance), WhatsApp groups (notices),
Google Classroom (assignments), email (faculty) and a timetable photo. Deadlines get missed,
attendance shortages are found too late, and writing to faculty takes far too long. AI assistants
could help, but they can't see this data, and students wouldn't trust them to act on their own.

## The solution

CampusMate is an **MCP server** plus a **companion dashboard**:

- **Reads** the timetable, deadlines, attendance and notices for the AI assistant, immediately.
- **Proposes** actions: faculty emails, reminders, new deadlines. Each one becomes a _pending_ card.
- **The student approves** every action in the dashboard. No MCP tool can approve anything.

Example: _"Can I skip OS tomorrow?"_ → _"You're at 77%. You can miss 1 more class and stay above
75%."_ The number comes from code, not from the model.

See [docs/architecture.md](docs/architecture.md) for the full design.

## Repository layout

```
campusmate-mcp/
├── shared/types/   API contract shared by server and dashboard (@shared/types)
├── server/         MCP server, REST API and static host (Hono + official MCP SDK v2)
├── web/            Dashboard (React 19 + Vite 8, from our frontend template)
└── docs/           architecture.md, demo-script.md
```

## Getting started

Requires **Node 24+**.

```bash
npm install
cp .env.example .env   # then replace every placeholder (see the comment at the top for generating secrets)
npm run check          # lint, format check, typecheck, tests, build (all workspaces)
```

Never commit `.env`. The server refuses to start if a secret is missing or too short.

| Command              | What it does                                                                           |
| -------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev:server` | Server with auto-restart at http://localhost:8787 (MCP at `/mcp`)                      |
| `npm run dev:web`    | Dashboard dev server at http://localhost:5173; proxies `/api` and `/mcp` to the server |
| `npm run build`      | Builds the dashboard into `web/dist`                                                   |
| `npm start`          | Production: one process serves the dashboard, `/api` and `/mcp`                        |

The server runs its TypeScript sources directly on Node 24, so it has no build step; `tsc` only
type-checks.

## Roadmap

| Stage | Goal                                          | Status              |
| ----- | --------------------------------------------- | ------------------- |
| A     | Repo, API contract, architecture docs, pitch  | **In progress**     |
| B     | Read tools working in Claude via MCP          | Planned             |
| C     | Approval loop and dashboard                   | Planned             |
| D     | Deployed, tested, documented                  | Planned             |
| E     | Undo, MCP Apps approval card, Google Calendar | Planned (build day) |

## Honest scope

- The hackathon version uses realistic **mock college data** for one student. Real sources plug in
  behind the `server/src/sources/` interfaces later.
- Emails go to a **mock outbox**, never a real inbox.
- Single demo student, no OAuth yet.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
