# Testing and coverage

Run everything with `npm run check`; coverage with `npm run test:coverage`.

## Automated tests (as of Phase 15)

| Suite                                        | Files            | Tests | What it covers                                                                                                                      |
| -------------------------------------------- | ---------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Server unit + integration                    | 16               | 181   | Domain rules, store, auth, API routes, all 10 MCP tools, resources, prompts, approvals, Google Calendar (simulated), security fixes |
| Server end-to-end (`server/src/e2e.test.ts`) | (included above) | 8     | Real HTTP server + official MCP client + dashboard HTTP calls: journeys J0–J6                                                       |
| Web (`web/src`)                              | 7                | 51    | Every page, confirm/cancel/edit, success only on server "done", errors, session expiry, lockout message, Calendar card, components  |
| Lint, format, type checks, build             | —                | —     | `npm run check`, both workspaces                                                                                                    |

### Coverage (v8)

| Workspace | Statements | Branches | Functions | Lines |
| --------- | ---------- | -------- | --------- | ----- |
| Server    | 96.4%      | 88.8%    | 97.1%     | 98.0% |
| Web       | 94.8%      | 84.3%    | 95.2%     | 96.7% |

Excluded from measurement: tests, test helpers, `server/src/index.ts`, the seed script, `web/src/main.tsx`.

## Requirement → evidence

| Requirement                               | Automated                                                                                        | Manual                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| All 10 MCP tools individually             | `mcp/tools.test.ts` (each tool, valid and invalid input), `e2e.test.ts`                          | Inspector CLI runs (Phases 9–11)                                            |
| Read-only vs approval-required            | Read tools change no student data (`planner`, `tools` tests); act tools create only pending rows | —                                                                           |
| Confirmation, cancellation, authorisation | `domain/approvals.test.ts`, `api/approvals.test.ts`, `pages.test.tsx`, E2E J2/J3/J6              | Approve, reject, focus and history in the browser (phone width)             |
| Frontend → backend → MCP                  | E2E suite (HTTP), `pages.test.tsx` (UI against the API contract)                                 | Browser run with real MCP proposals                                         |
| AI tool selection and argument validation | `mcp/workflows.test.ts` (scripted AI sessions), schema validation tests                          | Live Claude: **not yet** (needs deployment; plan in `docs/ai-workflows.md`) |
| External integrations and fallbacks       | `api/integrations.test.ts`, E2E J5 (simulated Google)                                            | "Not configured" state in the browser; real Google: **not yet**             |
| Authentication, sessions, isolation       | `auth/*.test.ts`, `api/routes.test.ts`, E2E J6                                                   | Lockout message in the browser                                              |
| Errors, loading states, recovery          | Web `ErrorState`, `RouteErrorPage`, loading/empty states; server failure paths                   | —                                                                           |
| Full student journeys                     | E2E J0–J6                                                                                        | Browser: J2-style approve and reject                                        |

"Data isolation" means: the AI channel (bearer token) and the dashboard channel (session) cannot be
used in each other's place; CampusMate serves one student per server, so there is no cross-student
data to isolate.

## Unresolved issues

| Item                                       | Status                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| Live test inside Claude                    | Needs the public URL (deployment)                                               |
| Google Calendar against real Google        | Needs OAuth credentials (`docs/integrations.md`)                                |
| Audit Low findings L1–L8                   | Not approved for fixing; listed in the Phase 13 report                          |
| Login lockout behind a proxy               | All clients may share one address; needs proxy-aware settings at deployment     |
| Browser end-to-end automation (Playwright) | Not added: browser journeys were verified manually; HTTP-level E2E is automated |
| Remaining uncovered branches               | Optional-prop paths in UI components, `useAsync` non-Error rejections           |
