# 04 — Deployment Runbook

Targets: Vercel (Next.js, **Pro plan** — amendment A4 needs a 15-minute cron), Supabase (Postgres + Auth), one Slack app. Secrets live only in `.env.local` (local) and the Vercel / Supabase dashboards. Never commit them.

## 1. Environment variables

Validated at runtime by `src/lib/env.ts`. Template: `.env.example`.

| Variable | Where it comes from | Used by |
| :--- | :--- | :--- |
| `DATABASE_URL` | Supabase → Project Settings → Database → connection string, **transaction pooler (port 6543)** for Vercel. Local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | Drizzle (`src/server/db/client.ts`, `prepare: false`) and `npm run db:migrate` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API. Local: `http://127.0.0.1:54321` | Auth (browser + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API → anon key (`supabase start` prints it) | Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → service_role key. Server only | Server tasks |
| `SLACK_SIGNING_SECRET` | Slack app → Basic Information → App Credentials | `/api/slack/*` HMAC check |
| `SLACK_BOT_TOKEN` | Slack app → OAuth & Permissions → Bot User OAuth Token (`xoxb-…`) | DMs, broadcast, `users.list` |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | Slack app → Basic Information | Supabase Slack OIDC provider (`supabase/config.toml` reads them via `env(...)`) |
| `SLACK_STANDUP_CHANNEL_ID` | Channel details → channel ID (`C…`). Optional | FR-SLACK-03 broadcast |
| `APP_BASE_URL` | Public origin, e.g. `https://tempo.example.com` | Deep links, redirects |
| `CRON_SECRET` | `openssl rand -hex 32` (≥ 16 chars) | Vercel sends `Authorization: Bearer $CRON_SECRET` to cron routes |

## 2. Local development

1. `npm ci`, then `cp .env.example .env.local` and fill it in.
2. `supabase start` (needs Docker). It reads `supabase/config.toml`, which enables `[auth.external.slack_oidc]` with `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` from the shell env, so export them first (or put them in `supabase/.env`, which is git-ignored).
3. `npm run db:migrate` — applies `drizzle/0000_init.sql`, `0001_rls_policies.sql`, `0002_pto_allowance.sql` in order. `0001` needs Supabase (`auth.uid()`, role `authenticated`); it fails on plain Postgres.
4. `npm run dev` → http://localhost:3000. Slack cannot reach localhost: for Slack webhooks use a tunnel (ngrok / cloudflared) and put its origin into the Slack app URLs (section 4).

Schema changes: edit `src/server/db/schema/*.ts`, run `npm run db:generate`, review the SQL in `drizzle/`, commit it, then `npm run db:migrate`.

## 3. Supabase (hosted)

1. Create a project (region close to the team; Europe for Kyiv).
2. **Auth → Providers → Slack (OIDC)**: enable, paste Slack Client ID and Client Secret. Copy the callback URL shown (`https://<project>.supabase.co/auth/v1/callback`) — it goes into the Slack app (section 4).
3. **Auth → URL Configuration**: Site URL = `APP_BASE_URL`; Redirect URLs = `APP_BASE_URL/auth/callback` (plus preview URLs if used, e.g. `https://*-<team>.vercel.app/auth/callback`).
4. Run migrations against the hosted DB from a trusted machine: `DATABASE_URL=<direct or session connection string> npm run db:migrate`. Run it before each deploy that ships a new migration.
5. Promote the first admin once they have signed in: `update users set role = 'admin' where email = '<admin email>';` (SQL editor). Everything else is done in `/admin`.

## 4. Slack app (from `docs/03-slack-app-manifest.yaml`)

1. api.slack.com/apps → **Create New App → From a manifest** → pick the workspace → paste the manifest after replacing `APP_BASE_URL` (no scheme, no trailing slash) and `<project>`.
2. Check **OAuth & Permissions → Redirect URLs** lists the Supabase callback (hosted and/or `http://127.0.0.1:54321/auth/v1/callback`).
3. **Install to Workspace**; copy the Bot User OAuth Token → `SLACK_BOT_TOKEN`.
4. **Basic Information**: copy Signing Secret, Client ID, Client Secret → env vars above and the Supabase Slack OIDC provider.
5. Confirm the request URLs verify: Event Subscriptions (`/api/slack/events`), Interactivity (`/api/slack/interactions`), slash commands `/log` and `/pto` (`/api/slack/commands`).
6. Invite the bot to the standup channel: `/invite @Tempo` in `#daily-standup`, then set `SLACK_STANDUP_CHANNEL_ID`.
7. In `/admin`, click **Sync from Slack** to import members (new users start as active `member`s).

## 5. Vercel

1. Import the repo; framework Next.js; Node ≥ 24. Add every variable from section 1 for Production (and Preview if used).
2. Cron jobs — add to `vercel.json` at the repo root (Orchestrator-owned file):

   ```json
   {
     "crons": [
       { "path": "/api/cron/morning-ping", "schedule": "*/15 * * * 1-5" }
     ]
   }
   ```

   - Every 15 minutes, Mon–Fri **UTC**. The route must reject requests whose `Authorization` header is not `Bearer ${CRON_SECRET}`.
   - The service decides per user (local window `[09:30, 09:45)`, local weekday, holidays, PTO) and dedups through `daily_pings`, so extra or retried runs are safe.
   - Caveat: with `1-5` in UTC, users east of UTC+09:30 (e.g. Australia, New Zealand) miss their Monday ping, because their Monday 09:30 is Sunday in UTC. If such users exist, use `*/15 * * * *`; weekend runs cost nothing and send nothing.
   - Vercel Hobby only allows daily crons; A4 needs Pro.
3. Deploy. Then smoke test: sign in with Slack → `/my-time`; download `/api/export/ledger.csv?from=YYYY-MM-01&to=YYYY-MM-28` and `/api/export/summary.csv?month=YYYY-MM`; check the cron log at the next quarter hour.

## 6. Release checklist

- [ ] `npm run check` and `npm run build` green on the release commit.
- [ ] New migrations applied to the hosted DB (`npm run db:migrate`) before the deploy goes live.
- [ ] Supabase Slack OIDC enabled; Site URL and Redirect URLs match `APP_BASE_URL`.
- [ ] Slack app request URLs verified; bot invited to the standup channel.
- [ ] `CRON_SECRET` set in Vercel; cron entry present; Vercel plan is Pro.
- [ ] First admin promoted; directory synced; holidays for the year entered in `/admin`.
