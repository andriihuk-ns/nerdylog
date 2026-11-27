# 04 — Deployment Runbook

Targets: Vercel (Next.js, Hobby is enough), Supabase (Postgres + Auth + `pg_cron`/`pg_net` scheduler, amendment A10), one Slack app. Secrets live only in `.env.local` (local) and the Vercel / Supabase dashboards. Never commit them.

## 1. Environment variables

Validated at runtime by `src/lib/env.ts`. Template: `.env.example`.

| Variable | Where it comes from | Used by |
| :--- | :--- | :--- |
| `DATABASE_URL` | Supabase → **Connect** → connection string. App on Vercel: **transaction pooler (port 6543)**. Migrations: session pooler (5432) or direct (see section 3a). Local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres` | Drizzle (`src/server/db/client.ts`, `prepare: false`) and `npm run db:migrate` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API. Local: `http://127.0.0.1:54321` | Auth (browser + server) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API keys → **publishable** key (`sb_publishable_…`) or legacy **anon** key (`supabase start` prints it) | Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API keys → **secret** key (`sb_secret_…`) or legacy **service_role** key. Server only, never `NEXT_PUBLIC_` | Server tasks |
| `SLACK_SIGNING_SECRET` | Slack app → Basic Information → App Credentials | `/api/slack/*` HMAC check |
| `SLACK_BOT_TOKEN` | Slack app → OAuth & Permissions → Bot User OAuth Token (`xoxb-…`) | DMs, channel posts, `users.list`, `conversations.list` / `conversations.join` |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | Slack app → Basic Information | Supabase Slack OIDC provider (`supabase/config.toml` reads them via `env(...)`) |
| `APP_BASE_URL` | Public origin, e.g. `https://tempo.example.com` | Deep links, redirects |
| `CRON_SECRET` | `openssl rand -hex 32` (≥ 16 chars). The same value goes into Supabase Vault as `tempo_cron_secret` (section 5a) | `/api/cron/*` rejects requests without `Authorization: Bearer $CRON_SECRET` |

## 2. Local development

1. `npm ci`, then `cp .env.example .env.local` and fill it in.
2. `supabase start` (needs Docker). It reads `supabase/config.toml`, which enables `[auth.external.slack_oidc]` with `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` from the shell env, so export them first (or put them in `supabase/.env`, which is git-ignored).
3. `npm run db:migrate` — applies every file in `drizzle/` in journal order (`0000_init` … `0013_a15_seed_holidays_2026`). `0001`, `0004`, `0005`, `0008` and `0012` need Supabase (`auth.uid()`, roles `anon`/`authenticated`); they fail on plain Postgres.
4. `npm run dev` → http://localhost:3000. Slack cannot reach localhost: for Slack webhooks use a tunnel (ngrok / cloudflared) and put its origin into the Slack app URLs (section 4).

Schema changes: edit `src/server/db/schema/*.ts`, run `npm run db:generate`, review the SQL in `drizzle/`, commit it, then `npm run db:migrate`.

## 3. Supabase (hosted)

1. Create a project (region close to the team; Europe for Kyiv).
2. **Auth → Providers → Slack (OIDC)**: enable, paste Slack Client ID and Client Secret. Copy the callback URL shown (`https://<project>.supabase.co/auth/v1/callback`) — it goes into the Slack app (section 4).
3. **Auth → URL Configuration**: Site URL = `APP_BASE_URL`; Redirect URLs = `APP_BASE_URL/auth/callback` (plus preview URLs if used, e.g. `https://*-<team>.vercel.app/auth/callback`).
4. Run migrations against the hosted DB from a trusted machine (section 3a): `DATABASE_URL=<session-uri> npm run db:migrate`. Run it before each deploy that ships a new migration.
5. **Project Settings → API (Data API)**: you can turn the Data API off. Tempo does not use PostgREST (all data goes through server-side Drizzle), and `0005_lockdown_grants` already revokes `anon`/`authenticated` table access. Supabase Auth keeps working without it.
6. Promote the first admin once they have signed in: `update users set role = 'admin' where email = '<admin email>';` (SQL editor). Everything else is done in `/admin`.
7. Set up the morning-ping scheduler (section 5a) once the app is deployed.

## 3a. Supabase cloud dev project (which connection string and key goes where)

Use a separate Supabase project for dev/staging; do not point dev at production data. Copy values from the project's **Connect** dialog and **Project Settings → API keys**.

| Purpose | Value | Why |
| :--- | :--- | :--- |
| `DATABASE_URL` for the app on Vercel (and `.env.local` when running the app against the cloud DB) | **Transaction pooler**, port **6543** (`postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`) | Serverless functions open many short connections; the transaction pooler handles that. It does not support prepared statements, which our client disables (`prepare: false` in `src/server/db/client.ts`). |
| `npm run db:migrate` | **Session pooler**, port **5432** (same host as above), or the **direct** connection (`db.<ref>.supabase.co:5432`, IPv6 unless the IPv4 add-on is enabled) | Migrations run multi-statement DDL in one session; keep them off the transaction pooler. Pass it inline so `.env.local` keeps the app URL: `DATABASE_URL=<session-uri> npm run db:migrate` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Publishable** key (`sb_publishable_…`) or legacy **anon** key | Safe in the browser; RLS applies |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** key (`sb_secret_…`) or legacy **service_role** key | Bypasses RLS. Server only; never expose to the browser or commit |

URL-encode special characters in the database password inside connection strings.

## 4. Slack app (from `docs/03-slack-app-manifest.yaml`)

1. api.slack.com/apps → **Create New App → From a manifest** → pick the workspace → paste the manifest after replacing `APP_BASE_URL` (no scheme, no trailing slash) and `<project>`.
2. Check **OAuth & Permissions → Redirect URLs** lists the Supabase callback (hosted and/or `http://127.0.0.1:54321/auth/v1/callback`).
3. **Install to Workspace**; copy the Bot User OAuth Token → `SLACK_BOT_TOKEN`.
4. **Basic Information**: copy Signing Secret, Client ID, Client Secret → env vars above and the Supabase Slack OIDC provider.
5. Confirm the request URLs verify: Event Subscriptions (`/api/slack/events`), Interactivity (`/api/slack/interactions`), slash commands `/log` and `/pto` (`/api/slack/commands`).
6. Channels are picked in `/admin` (amendment A11), not in env vars: the general standup channel (full standup card) and one channel per project (only that project's lines). No channel set → nothing is posted. Public channels: the bot joins on pick. Private channels: `/invite @Tempo` in the channel first, then pick it.
   Bot scopes required by A11: `channels:read`, `groups:read`, `channels:join`. An existing install must be **reinstalled** (OAuth & Permissions → Reinstall to Workspace) after the manifest gains these scopes; the bot token may change, so re-copy `SLACK_BOT_TOKEN` if it does.
   A15 removed teams: `usergroups:read` is **no longer needed** and can be dropped from the manifest (dropping a scope also needs a reinstall; keeping it is harmless). Project members are read with `conversations.members`, covered by `channels:read` / `groups:read`; the bot must be in the channel (public: it joins on pick; private: invite it first).
7. In `/admin`, click **Sync from Slack** to import members (new users start as active `member`s, with no office) and refresh every project's members. Morning standup cards go to the general standup channel (A11).
8. A15 offices and projects, after migrating (section 3a / A15 rollout below): in `/admin` → People assign each new user an office (users without an office get no holidays: they are pinged on every weekday and their "previous business day" skips weekends only). In `/admin` → Projects, each project needs a channel; saving a project refreshes its members, and **Refresh members** re-reads the channel. Only members of a project's channel can log time to it (web and Slack).

### A15 rollout (migrations `0010`–`0013`)

Ship the migrations **before** deploying the A15 code (`DATABASE_URL=<session-uri> npm run db:migrate`), in one go:

- `0010_a15_drop_teams_caps` drops `teams` / `team_members` **with their data** and the `projects` columns `code`, `monthly_hour_cap`, `is_billable`. Not reversible; take a backup first if team data matters. The old (A13/A14) code reads those columns, so deploy right after migrating.
- `0011_a15_offices_project_members` creates `offices` (+ `UA`, `PL`) and `project_members`, adds `projects.created_by`, assigns **every existing user to `UA`**, backfills existing holidays to `UA`, then makes `company_holidays.office_id` not null and swaps the unique to `(office_id, holiday_date)`. Re-assign the Polish team to `PL` in `/admin` → People afterwards.
- `0012_a15_rls` enables RLS (no policies) and revokes Data API grants on the two new tables.
- `0013_a15_seed_holidays_2026` inserts the 2026 holidays for UA and PL (`on conflict do nothing`, so it never overwrites admin edits).

After deploy, existing projects have **no members** until an admin opens `/admin` → Projects and runs **Refresh members** (or **Sync from Slack**); until then nobody can log time to them. Each year, add the next year's holidays per office in `/admin` → Holidays (**Copy from {previous year}**, then move Easter-based dates by hand).

## 5. Vercel

1. Import the repo; framework Next.js; Node ≥ 24. Add every variable from section 1 for Production (and Preview if used).
2. No Vercel cron. Vercel Hobby allows daily crons only, so the 15-minute morning-ping scheduler runs in Supabase (section 5a, amendment A10).
3. Deploy. Then smoke test: sign in with Slack → `/my-time`; download `/api/export/ledger.csv?from=YYYY-MM-01&to=YYYY-MM-28` and `/api/export/summary.csv?month=YYYY-MM`; after setting up section 5a, check `net._http_response` at the next quarter hour.

## 5a. Morning-ping scheduler (Supabase `pg_cron` + `pg_net`, amendment A10)

Supabase calls `GET <APP_BASE_URL>/api/cron/morning-ping` every 15 minutes with `Authorization: Bearer <CRON_SECRET>`. The app sends the ping on the first run where the user's local time is in `[09:30, 11:00)` on a local weekday, not a holiday of the user's own office (A15), not on PTO, and not yet pinged that local date (`daily_pings`, `ON CONFLICT DO NOTHING`). Late, skipped, repeated or weekend runs are therefore safe: a user gets at most one ping per local date, and a run delayed by up to ~1.5 h still catches them.

Do this once per environment, after the app is deployed and `CRON_SECRET` is set in Vercel:

1. **Database → Extensions**: enable `pg_cron` and `pg_net` if they are not on yet (the script also tries `create extension if not exists`).
2. **SQL editor** → create the two Vault secrets (replace the placeholders; do not save real values in files):

   ```sql
   select vault.create_secret('https://<deployed-app-origin>', 'tempo_app_base_url');  -- no trailing slash
   select vault.create_secret('<same value as CRON_SECRET in Vercel>', 'tempo_cron_secret');
   ```

3. **SQL editor** → paste and run `scripts/setup-pg-cron.sql`. It is idempotent: it unschedules any job named `tempo-morning-ping` and schedules it again (`*/15 * * * *`, UTC). The job reads both secrets from `vault.decrypted_secrets` on every run, so rotating a secret (`vault.update_secret`) needs no reschedule.
4. **Verify** after the next quarter hour:

   ```sql
   select * from cron.job;                                                -- tempo-morning-ping, active
   select * from cron.job_run_details order by start_time desc limit 5;   -- status 'succeeded'
   select * from net._http_response order by created desc limit 5;        -- status_code 200
   ```

   `401` means the Vault secret differs from Vercel's `CRON_SECRET`; a null `status_code` with `error_msg` usually means a wrong base URL or a timeout (10 s). A `200` body looks like the route's JSON result (sent count etc.).

Rotating `CRON_SECRET`: update Vercel's env and redeploy, then `vault.update_secret` for `tempo_cron_secret`. Runs between the two steps get `401` and are caught up by later runs within the window. To stop the scheduler: `select cron.unschedule('tempo-morning-ping');`.

## 6. Release checklist

- [ ] `npm run check` and `npm run build` green on the release commit.
- [ ] New migrations applied to the hosted DB (`npm run db:migrate`) before the deploy goes live.
- [ ] Supabase Slack OIDC enabled; Site URL and Redirect URLs match `APP_BASE_URL`.
- [ ] Slack app request URLs verified; bot invited to the standup channel.
- [ ] `CRON_SECRET` set in Vercel; Vault secrets `tempo_app_base_url` / `tempo_cron_secret` match; `scripts/setup-pg-cron.sql` run; `net._http_response` shows `200`.
- [ ] First admin promoted; directory synced; every user has an office; each office's holidays for the year entered in `/admin` → Holidays.
- [ ] Projects have a channel and their members refreshed (`/admin` → Projects → Refresh members).
