# Deployment

CampusMate runs as **one Node 24 process** that serves the dashboard, the REST API (`/api`) and the
MCP endpoint (`/mcp`). The approved host is **Render (free web service)**; `render.yaml` in the
repo root describes it.

## Before you deploy

Run the full check locally. It must pass with no warnings:

```sh
npm ci
npm run check   # lint, format check, type checks, all tests, production build
```

## Deploy on Render

1. Push the repository to GitHub.
2. In Render: **New → Blueprint**, pick the repository. Render reads `render.yaml`.
3. When asked, type a **DASHBOARD_PASSCODE**: at least 12 random characters. This is what the
   student types to open the dashboard. Leave GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET empty
   unless you set up Google Calendar (see `docs/integrations.md`).
4. Render generates `MCP_TOKEN` and `SESSION_SECRET` (random 256-bit values) and builds with
   `npm ci && npm run build`, then starts `npm start`. The health check is `/api/health`.
5. When the deploy is live, open `https://<service>.onrender.com`, log in, and open **Connect**. It
   shows the MCP URL and token to paste into Claude.

**If the first deploy fails with `DASHBOARD_PASSCODE: Invalid input`**, the passcode was left empty
at step 3 (this happened on the first live deploy). Open the service → **Environment** → **Edit** →
**Add variable** `DASHBOARD_PASSCODE`, type a value or click **Generate**, then **Save, rebuild, and
deploy**. A generated value is long: reveal and copy it with the eye icon on the same page.

### Current deployment

| Item     | Value                                                                |
| -------- | -------------------------------------------------------------------- |
| Live URL | https://campusmate-ulnc.onrender.com                                 |
| Service  | Render web service `campusmate`, free plan, Singapore                |
| Source   | `gtsanjana3-eng/campusmate-mcp`, branch `main`; auto-deploys on push |
| Secrets  | Stored only in Render's Environment page, never in the repo          |

`PUBLIC_URL` does not need to be set on Render: the server uses Render's `RENDER_EXTERNAL_URL`. If
you use your own domain, set `PUBLIC_URL` to it (an explicit value always wins). The MCP endpoint
only accepts requests whose Host matches it.

## Environment variables

| Name                                      | Required    | Set by                         | Notes                                                              |
| ----------------------------------------- | ----------- | ------------------------------ | ------------------------------------------------------------------ |
| `MCP_TOKEN`                               | yes         | Render (`generateValue`)       | Bearer token for the AI connector; at least 32 chars               |
| `SESSION_SECRET`                          | yes         | Render (`generateValue`)       | Signs the dashboard cookie and encrypts Google tokens              |
| `DASHBOARD_PASSCODE`                      | yes         | You, at Blueprint creation     | At least 12 characters, not a placeholder                          |
| `DATABASE_PATH`                           | no          | `render.yaml`                  | `./data/campusmate.db` (re-seeded when missing)                    |
| `PUBLIC_URL`                              | no (Render) | Render's `RENDER_EXTERNAL_URL` | Set it only for a custom domain                                    |
| `PORT`                                    | no          | Render (10000)                 | The server listens on `0.0.0.0:$PORT`                              |
| `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` | no          | You                            | Both or neither; callback `<url>/api/integrations/google/callback` |

The server refuses to start if a secret is missing, short, repetitive or still a placeholder, and
the error names the variable without printing its value. No secret is stored in the repository.

## What the free plan means

- **Sleeps after 15 minutes without traffic**; the first request afterwards takes about a minute.
  Open the site a few minutes before a demo.
- **No persistent disk**: every restart, redeploy or sleep starts from fresh demo data. Pending
  approvals, the activity log, logged-in sessions and a Google Calendar connection are lost.
  This matches the demo scope (one seeded student); real use needs a paid instance with a disk
  or a hosted database.

## Production behaviour (verified locally, Phase 17)

A clean copy was installed with `npm ci`, built with `npm run build`, and started with Render-style
variables (`NODE_ENV=production`, `PORT=10000`, `RENDER_EXTERNAL_URL`, generated secrets). Checked:
health 200, dashboard and deep links served, hashed assets cached for a year (`immutable`), the page
always revalidated (`no-cache`), API responses `no-store`, security headers (CSP, HSTS, nosniff,
referrer policy), login cookie `HttpOnly; Secure; SameSite=Strict`, MCP `tools/list` (10 tools) and
`get_today` with the token, 401 without it, and the Connect page showing the public MCP URL.

## Known limits to check after the first deploy

- **Login lockout behind Render's proxy.** The limiter counts failures per connection address.
  Render's documentation does not say which address the app sees; if every visitor arrives from
  the proxy, five wrong passcodes from anyone lock **everyone** out for 15 minutes (the right
  passcode still can't get in during that time). Forwarded-for headers are not trusted, because
  they can be faked. Check this on the live URL before the demo, and share the passcode only with
  the people who need it.
- **Live test inside Claude** and **real Google Calendar** still need the deployed URL; follow
  `docs/ai-workflows.md` and `docs/integrations.md`.

## Rollback

Render keeps previous deploys: **Service → Events → Rollback**. Because the database is re-seeded on
every start, a rollback never needs a data migration.
