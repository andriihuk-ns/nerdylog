# 02 — Database Schema

Source: PRD §5.2 + amendments A1, A4, A5, A6. Code: `src/server/db/schema/*.ts` (barrel `index.ts`). Migrations: `drizzle/` (one chain; `0000_init.sql` generated, `0001_rls_policies.sql` custom). Enum values come from `src/contracts/enums.ts`.

## Enums

| pgEnum | Values (from contracts) |
| :--- | :--- |
| `role` | `ROLES` — admin, manager, member |
| `entry_type` | `ENTRY_TYPES` — work, vacation, sick, holiday |
| `entry_source` | `ENTRY_SOURCES` — slack_standup, slack_command, web_ui, sheet_import |
| `slack_submission_kind` | `SLACK_SUBMISSION_KINDS` — standup, log, pto |

## Tables

All `id` columns are `uuid` PK `default gen_random_uuid()`. Timestamps are `timestamptz default now() not null`. Dates are `date` mapped to `"YYYY-MM-DD"` strings (`IsoDate`). Numerics use Drizzle `mode: "number"`, so services get `number`, never strings.

**`users`** — `slack_user_id text unique not null`, `auth_user_id uuid unique null` (*addition, pending approval*: links `auth.users.id` for RLS), `full_name text not null default ''`, `email text`, `avatar_url text`, `role role not null default 'member'`, `timezone text not null default 'Europe/Kyiv'`, `daily_norm_hours numeric(3,1) not null default 8.0`, `pto_allowance_days numeric(4,1) null` (A9: yearly vacation allowance, null = not set; check `pto_allowance_days is null or pto_allowance_days between 0 and 365`, migration `0002_pto_allowance`), `is_active bool not null default true`, `created_at`.

**`projects`** — `name text not null`, `code text unique` (nullable), `monthly_hour_cap numeric(5,1)` (null = no cap), `is_billable bool not null default true`, `is_active bool not null default true`, `slack_channel_id text unique` (A11: nullable; one channel = one project; constraint `projects_slack_channel_id_unique`, migration `0003_project_channels`).

**`time_entries`** (Stream A) — `user_id → users` (restrict), `project_id → projects` (restrict, null for PTO), `work_date date not null`, `hours numeric(4,2) not null`, `entry_type not null`, `task_summary text not null default ''`, `ticket_refs text[] not null default '{}'`, `source not null`, `slack_view_id text` (**not unique**, A1), `updated_at` (auto-bumped by Drizzle `$onUpdate`).
- Checks: `hours between 0 and 24`; `entry_type <> 'work' or project_id is not null`; `entry_type = 'work' or hours = 0` (mirrors `timeEntryInputSchema`).
- Indexes: `(user_id, work_date)`, `(project_id, work_date)` (A6), `(slack_view_id)` (A1).

**`daily_checkins`** (Stream B, never in hour math) — `user_id → users` (restrict), `checkin_date date not null`, `planned_today text not null default ''`, `blockers text not null default ''`, `channel_message_ts text`, `created_at`. Unique index `(user_id, checkin_date)` (A6) → upsert target.

**`company_holidays`** — `holiday_date date unique not null`, `name text not null`.

**`slack_submissions`** (A1) — `view_id text PK`, `user_id → users` (restrict), `kind slack_submission_kind not null`, `created_at`.

**`daily_pings`** (A4) — PK `(user_id, ping_date)`, `user_id → users` (cascade), `ping_date date` (user-local date), `sent_at`.

**`app_settings`** (A11) — `key text PK`, `value text not null`, `updated_at` (auto-bumped by `$onUpdate`). Known key: `standup_channel_id` (general channel for the full standup card). No row = not set → nothing posted. Migration `0003_project_channels`, RLS in `0004_app_settings_rls`.

Users are archived (`is_active = false`), never deleted; `restrict` FKs protect history.

## A1 idempotency pattern

```ts
await db.transaction(async (tx) => {
  await tx.insert(slackSubmissions).values({ viewId, userId, kind: "standup" });
  if (rows.length) await tx.insert(timeEntries).values(rows.map((r) => ({ ...r, slackViewId: viewId })));
  await tx.insert(dailyCheckins).values(checkin)
    .onConflictDoUpdate({ target: [dailyCheckins.userId, dailyCheckins.checkinDate], set: {...} });
});
```
A retry with the same `view.id` fails the first insert with SQLSTATE `23505` on `slack_submissions_pkey`; the whole transaction rolls back. The handler catches exactly that error and treats it as "already processed" (ack 200, no new rows). Any other error propagates.

A4 ping dedup: `insert into daily_pings … on conflict do nothing returning user_id`; send the DM only when a row came back.

## RLS (defence in depth, A5)

Drizzle connects as the table owner and bypasses RLS; services enforce RBAC. Policies cover Supabase-client (JWT) access. Helpers in schema `app_private` (not exposed via PostgREST), `SECURITY DEFINER`, mapping `auth.uid() → users.auth_user_id`; inactive users resolve to nothing.

| Table | Read | Write |
| :--- | :--- | :--- |
| users | own row; manager/admin all | admin |
| projects, company_holidays | any authenticated | admin |
| time_entries | own; manager/admin all | own; manager/admin all (PRD §2 "edit on behalf") |
| daily_checkins | own; manager/admin all | own only |
| app_settings (A11, `0004`) | manager/admin | admin |
| slack_submissions, daily_pings | none | none (server only) |

`anon` has no policies → no access. Migrations `0001` and `0004` need Supabase (`auth.uid()`, role `authenticated`); it will not apply on plain Postgres.

## Rollup spec (Wave 1b, pure functions)

Inputs: a user's `time_entries` for the month + `daily_norm_hours`. `daily_checkins` and `company_holidays` are **not** inputs.

| Metric | Formula |
| :--- | :--- |
| `hours` | Σ `hours` where `entry_type = 'work'` |
| `days` | `hours / daily_norm_hours` (default 8.0); no rounding in the service, UI shows 1 decimal |
| `vacSick` | count of distinct `work_date` with any `vacation` or `sick` entry |
| `holidays` | count of distinct `work_date` with a `holiday` entry |

Month total = same formulas over the whole month (equals the sum of week buckets for hours/days; distinct-day counts also sum, since buckets do not overlap).

**Month-weeks (A2):** Week 1 = the 1st through the first Sunday (a single day if the 1st is a Sunday). Each next week = Mon–Sun. The last week is cut at the month's last day. At most 6 weeks. Example Nov 2026 (1st = Sunday): W1 1–1, W2 2–8, W3 9–15, W4 16–22, W5 23–29, W6 30–30. Bucket by `work_date` only (dates are already user-local). Weekend work counts. The ledger CSV still exports ISO week as `ISO_Week`.

Parity check (PRD §7): Sviatoslav Nov 2026 → 152.0h / 19.0d / 2 vac-sick days.

## Services (Wave 1b)

Code: `src/server/services/*.ts`. Signatures come from `src/contracts/services.ts`. DB modules call `getDb()` at call time, so importing them never connects. Queries live in `src/server/db/queries/*.ts` (take `Db` or a transaction `Tx`).

| Module | Kind | Exports / contract |
| :--- | :--- | :--- |
| `calendar.ts` | pure | `monthWeeks` (A2), `previousBusinessDay` (`PreviousBusinessDay`: skips weekends + given holidays), `isoWeek` (CSV `ISO_Week`), `monthRange`, `addDays`. UTC math on `YYYY-MM-DD`. |
| `time-aggregator.ts` | pure | `aggregateMonth(month, users, entries) → UserMonthRollup[]`, `projectCapUsage(month, projects, entries) → ProjectCapUsage[]` (uses `capStatus`). Inputs are `time_entries` columns only; no check-in type exists in its API. Hours rounded to 0.01; `days` unrounded; norm ≤ 0 falls back to 8.0. |
| `user-service.ts` | DB | `upsertUserFromSlack` (`UpsertUserFromSlack`): upsert on `slack_user_id`, sets `auth_user_id`/email/avatar/name, timezone only when non-null, new rows `member`; role/norm/active never changed. Archived user → row refreshed, then `InactiveUserError`. `getActorByAuthUserId` (`GetActorByAuthUserId`): inactive → `null`. Pure mapping in `user-mapping.ts`. |
| `standup-service.ts` | DB | `submitSlackSubmission` (`SubmitSlackSubmission`, A1): validate first (`standup-rows.ts`: `timeEntryInputSchema`, `dailyCheckinInputSchema`, all rows must belong to `input.userId`, ticket refs via `extractTicketRefs`, `slack_view_id` = `viewId`; else `InvalidSubmissionError`, nothing written). One transaction: `slack_submissions` → `time_entries` → `daily_checkins` upsert (separate `upsertDailyCheckin`). 23505 on `slack_submissions_pkey` (`pg-errors.ts`) → `{ status: "duplicate" }`. |
| `errors.ts` | shared | `ForbiddenError` (A5 denial), `NotFoundError`. Callers map to 403/404 or a Slack ephemeral. |
| `pto-balance.ts` | pure | `computePtoBalance(userId, year, allowance, rows) → PtoBalance` (A9): DISTINCT vacation and sick dates; only vacation reduces the allowance; `remainingDays` null when allowance is null, may be negative, rounded to 0.1. `yearRange(year)` → `YYYY-01-01..YYYY-12-31` (RangeError on bad year). |
| `pto-service.ts` | DB | `getPtoBalance` (`GetPtoBalance`, A9): member → own `userId` only, else `ForbiddenError` (checked before any query); manager/admin → anyone, archived users included. Unknown user → `NotFoundError`. The caller picks `year` (A9: current year in the user's timezone). Queries: `findPtoAllowance` (users), `listUserPtoDates` (time_entries, `vacation`/`sick` only; holidays ignored). |
| `rollup-service.ts` | DB | `getTeamMonthRollup` (`GetTeamMonthRollup`): member → own row only; manager/admin → all active users. `getProjectCapUsage` (`GetProjectCapUsage`): `usedHours` is team-wide per project; manager/admin → active projects + inactive ones with hours; member → only projects they logged work on that month. |

## Services (Wave 2)

Signatures: `src/contracts/services-wave2.ts` (+ `GetActorBySlackUserId` in `services.ts`). Shared helpers: `rbac.ts` (`assertCanActOnUser`, `assertManagerOrAdmin`, `assertAdmin`), `validation.ts` (`parseInput` → `InvalidInputError` with `fieldErrors` keyed by Zod path; `assertIsoDate` → `RangeError`; non-uuid ids → `NotFoundError`). Errors: `ForbiddenError` → 403, `InvalidInputError` / `RangeError` → 400, `NotFoundError` → 404.

| Module | Kind | Behaviour |
| :--- | :--- | :--- |
| `time-entry-service.ts` | DB | `listWeekEntries` (weekStart must be a Monday, else `RangeError`; reads Mon–Sun). `createTimeEntry` (`timeEntryInputSchema`, source `web_ui`, `extractTicketRefs`). `updateTimeEntry` re-validates the merged row (work keeps a project, PTO stays 0h), re-extracts tickets, keeps the original `source`. `deleteTimeEntry`. `setDayStatus` in one transaction: `work` → delete that day's PTO rows; PTO → delete every row that day, insert one 0h row. RBAC: member own rows; manager/admin anyone (PRD §2). Queries: `queries/time-entry-views.ts`. |
| `checkin-service.ts` | DB | Stream B only. `listCheckinsForDate`: manager/admin → all active users; member → own. `hasBlocker` (`checkin-view.ts`, pure) = trimmed text non-empty and not `none`/`no`/`-` (case-insensitive). `setCheckinChannelTs` (system): sets `channel_message_ts` for user+date; no row → no-op. |
| `directory-service.ts` | DB | `listDirectory` (manager+, archived included). `updateDirectoryUser` (admin; Zod patch; an admin cannot demote or archive themselves). `syncDirectoryFromSlack` (admin; one transaction; pure plan in `directory-sync.ts`): new Slack ids → active `member`; existing → only name/email/avatar/timezone that Slack actually sent; never role, norm, allowance, `is_active`, `auth_user_id`. Returns `{ created, updated }`. |
| `project-service.ts` | DB | `listProjects` (any user; archived on request). `upsertProject` (admin): blank code → null, duplicate code → `InvalidInputError` on `code`. A11 `slackChannelId`: blank → null, else must match `^[CG][A-Z0-9]{8,}$`; duplicate channel → `InvalidInputError` on `slackChannelId` ("This channel is already linked to another project"). |
| `settings-service.ts` | DB | A11. `getAppSettings` (manager+) → `{ standupChannelId }`. `updateAppSettings` (admin; partial patch: omitted key untouched, null/blank deletes the row, else same channel-id check). System reads for the Slack layer (no actor): `getStandupChannelId` (null → do not post the general card), `listProjectChannels` (active projects with a non-null channel, by name). Project channels are written via `upsertProject`. Queries: `queries/settings.ts`, `queries/catalog.ts#listProjectChannelRows`. |
| `holiday-service.ts` | DB | `listHolidays(year)` (any user). `addHoliday` / `removeHoliday` (admin). Adding a holiday does **not** create `holiday` time entries (follow-up for FR-WEB-06 pre-fill). |
| `ping-service.ts` | DB | `claimMorningPings(now)` (A4 + A10, called by Supabase pg_cron every 15 min). Pure rules in `ping-decision.ts`: local time via `@date-fns/tz` (unknown zone → `Europe/Kyiv`), window `[09:30:00, 11:00:00)` (A10: wide so late runs catch up), local weekday, not a company holiday, no PTO row that local day. Then `insert into daily_pings … on conflict do nothing returning user_id`; only newly claimed users are returned, with `logDate = previousBusinessDay(localDate)`. A claimed ping is not released if the DM fails. |
| `user-service.ts` | DB | adds `getActorBySlackUserId` (active users only, returns `SlackActorProfile`). |
| `export-service.ts` | DB | `buildLedgerCsv`, `buildSummaryCsv`, `buildReportPdf`. Scope (`export-scope.ts`, pure): member → self only (`ForbiddenError` for others); manager/admin → named users or all active. Range ≤ 366 days, `from ≤ to`. A project filter drops PTO rows (they have no project). |
| `csv.ts`, `ledger-csv.ts` | pure | UTF-8 BOM, RFC 4180 quoting, CRLF. Ledger columns `Date,ISO_Week,Employee,Project,Entry_Type,Hours,Day_Equiv,Tasks,Ticket_IDs,Source`; `Day_Equiv = hours / daily_norm_hours` (4 decimals); tickets joined with `; `. Free-text cells starting with `= + - @` get a `'` prefix (CSV injection). Summary pivot: per user × month-week Hours, Days, Vac/Sick, Holidays + month total (same math as `/team`). |
| `pdf/*` | pure + render | `report-model.ts` (pure) → `ReportDocument` (`report-document.tsx`, `employee-section.tsx`, `entries-table.tsx`, `totals-table.tsx`) → `renderToBuffer`. Built-in Helvetica: Latin-1 only (non-Latin names need an embedded font). |

Routes: `GET /api/export/ledger.csv?from&to&userIds&projectIds`, `GET /api/export/summary.csv?month=YYYY-MM`, `GET /api/export/report.pdf?from&to&userIds` (ids comma-separated or repeated). Each calls `requireActor()`, validates with Zod and returns `Content-Disposition: attachment`.
