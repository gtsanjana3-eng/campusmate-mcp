# Testing and coverage

Run everything with `npm run check`; coverage with `npm run test:coverage`.

## Automated tests (as of Phase 17)

| Suite                                        | Files            | Tests | What it covers                                                                                                                      |
| -------------------------------------------- | ---------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Server unit + integration                    | 16               | 185   | Domain rules, store, auth, API routes, all 10 MCP tools, resources, prompts, approvals, Google Calendar (simulated), security fixes |
| Server end-to-end (`server/src/e2e.test.ts`) | (included above) | 8     | Real HTTP server + official MCP client + dashboard HTTP calls: journeys J0–J6                                                       |
| Web (`web/src`)                              | 7                | 51    | Every page, confirm/cancel/edit, success only on server "done", errors, session expiry, lockout message, Calendar card, components  |
| Lint, format, type checks, build             | —                | —     | `npm run check`, both workspaces                                                                                                    |

### Coverage (v8, measured in Phase 16)

| Workspace | Statements | Branches | Functions | Lines |
| --------- | ---------- | -------- | --------- | ----- |
| Server    | 96.5%      | 88.8%    | 97.2%     | 98.0% |
| Web       | 95.0%      | 84.8%    | 95.3%     | 96.8% |

Excluded from measurement: tests, test helpers, `server/src/index.ts`, the seed script, `web/src/main.tsx`.

## Requirement → evidence

| Requirement                               | Automated                                                                                        | Manual                                                                                           |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| All 10 MCP tools individually             | `mcp/tools.test.ts` (each tool, valid and invalid input), `e2e.test.ts`                          | Inspector CLI runs (Phases 9–11)                                                                 |
| Read-only vs approval-required            | Read tools change no student data (`planner`, `tools` tests); act tools create only pending rows | —                                                                                                |
| Confirmation, cancellation, authorisation | `domain/approvals.test.ts`, `api/approvals.test.ts`, `pages.test.tsx`, E2E J2/J3/J6              | Approve, reject, focus and history in the browser (phone width)                                  |
| Frontend → backend → MCP                  | E2E suite (HTTP), `pages.test.tsx` (UI against the API contract)                                 | Browser run with real MCP proposals                                                              |
| AI tool selection and argument validation | `mcp/workflows.test.ts` (scripted AI sessions), schema validation tests                          | Live Claude: **not yet** (site is live; connector not added yet, plan in `docs/ai-workflows.md`) |
| External integrations and fallbacks       | `api/integrations.test.ts`, E2E J5 (simulated Google)                                            | "Not configured" state in the browser; real Google: **not yet**                                  |
| Authentication, sessions, isolation       | `auth/*.test.ts`, `api/routes.test.ts`, E2E J6                                                   | Lockout message in the browser                                                                   |
| Errors, loading states, recovery          | Web `ErrorState`, `RouteErrorPage`, loading/empty states; server failure paths                   | —                                                                                                |
| Full student journeys                     | E2E J0–J6                                                                                        | Browser: J2-style approve and reject                                                             |

"Data isolation" means: the AI channel (bearer token) and the dashboard channel (session) cannot be
used in each other's place; CampusMate serves one student per server, so there is no cross-student
data to isolate.

## Performance (Phase 15 audit → Phase 16 fixes)

Same script, same machine, in-memory database, before and after the Phase 15 fixes:

| Measurement                                     | Before                       | After                                     |
| ----------------------------------------------- | ---------------------------- | ----------------------------------------- |
| Approving a reminder while Google never answers | 24.0 s                       | 2.0 s                                     |
| `tools/list` size the AI reads                  | 25,433 bytes (≈6,358 tokens) | 20,105 bytes (≈5,026 tokens)              |
| MCP reply when the database is down             | internal error text          | generic message                           |
| `/api/today` p95 / MCP `get_today` p95          | 4.7 ms / 9.7 ms              | 4.5 ms / 10.4 ms (unchanged within noise) |
| Dashboard JavaScript (gzip)                     | 112.5 KB                     | 112.7 KB                                  |

Rate limits, re-measured: 5 wrong passcodes → 429 with `Retry-After: 900`; the 21st pending
proposal is refused; bodies over 16 KB → 413; MCP without a token → 401. Google calls: 8 s timeout,
3 attempts, then an honest note on the reminder.

## Production checks

**Clean install (Phase 17):** fresh copy, `npm ci`, `npm run build`, started with Render-style
variables. 13 of 13 smoke checks passed (health, dashboard and deep links, caching, security
headers, cookie flags, `no-store`, Connect URL, 401s, MCP `tools/list` and `get_today`, database
seeded). Browser: no console or CSP errors.

**Live site (Phase 18, https://campusmate-ulnc.onrender.com), checked from outside:**

| Check                                            | Result                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Deploy from `render.yaml`                        | Build succeeded on Node 24.22.3; `npm ci` 0 vulnerabilities                   |
| Health                                           | 200 `{"status":"ok","db":"ok"}`                                               |
| HTTP → HTTPS                                     | 301                                                                           |
| Security headers                                 | CSP, HSTS, nosniff, `no-referrer`, frame protection                           |
| Dashboard `/` and deep link `/approvals`         | 200, app shell                                                                |
| Caching                                          | assets `immutable` 1 year; page `no-cache`; API `no-store`; missing asset 404 |
| API without session / MCP without or wrong token | 401 / 401 / 401                                                               |
| Cross-site requests                              | no CORS headers granted; preflight 404                                        |
| Form-encoded login / 17 KB body / unknown API    | 415 / 413 / JSON 404                                                          |

**Not yet verified on the live site:** logged-in dashboard journeys, the 10 tools called from
Claude, logout, phone layout on a real device, recovery after the free instance sleeps. These are
covered locally (E2E J0–J6, browser checks in Phases 14–15) but were not run against the live URL,
because no logged-in session could be driven from the testing environment.

## Known limitations and future improvements

| Item                                                 | Status / next step                                                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Live test inside Claude                              | Add the connector with the Connect page's URL and token, then run `docs/ai-workflows.md`                                         |
| Google Calendar against real Google                  | Needs OAuth credentials (`docs/integrations.md`); off on the live demo                                                           |
| Login lockout behind Render's proxy                  | Phase 21: counts per visitor via `TRUST_PROXY_HOPS=1` (tests cover spoofed entries); live log check in `docs/deployment.md`      |
| Free hosting                                         | Sleeps after 15 min; data resets on every restart. Demo-day checklist in `docs/deployment.md`; paid instance + disk for real use |
| Unauthenticated logout (review H1)                   | Phase 21: fixed; logout now needs a valid session (test added)                                                                   |
| Wrong-passcode message                               | Says "Please log in again."; a clearer "Wrong passcode" would help                                                               |
| Audit Low findings (Phase 13 L1–L8, Phase 15 L1–L10) | Not approved for fixing (e.g. health 500 vs 503, polling load, Escape focus)                                                     |
| Browser end-to-end automation (Playwright)           | Not added; HTTP-level E2E is automated, browser journeys were checked manually                                                   |
| Lighthouse / axe                                     | Not run; contrast, labels, landmarks and target sizes were scripted checks                                                       |
| Real college data, real email, multiple students     | Out of hackathon scope; plug in behind `server/src/sources/`                                                                     |
| Re-enter passcode before sending email               | Planned mitigation for a browser agent driving a logged-in dashboard                                                             |
