# 02 — Database Schema

Source: PRD §5.2 + amendments A1, A4, A5, A6 … A16 (A15 removed teams and client caps, added offices, per-office holidays and project members; A16 added office timezones, per-project status prompts and `project_prompts`). Code: `src/server/db/schema/*.ts` (barrel `index.ts`). Migrations: `drizzle/` (one chain; `0000_init.sql` generated, `0001_rls_policies.sql` custom). Enum values come from `src/contracts/enums.ts`.

## Enums

| pgEnum | Values (from contracts) |
| :--- | :--- |
| `role` | `ROLES` — admin, manager, member |
| `entry_type` | `ENTRY_TYPES` — work, vacation, sick, holiday |
| `entry_source` | `ENTRY_SOURCES` — slack_standup, slack_command, web_ui, sheet_import |
| `slack_submission_kind` | `SLACK_SUBMISSION_KINDS` — standup, log, pto |

## Tables

All `id` columns are `uuid` PK `default gen_random_uuid()`. Timestamps are `timestamptz default now() not null`. Dates are `date` mapped to `"YYYY-MM-DD"` strings (`IsoDate`). Numerics use Drizzle `mode: "number"`, so services get `number`, never strings.

**`users`** — `slack_user_id text unique not null`, `auth_user_id uuid unique null` (A7, approved: links `auth.users.id` for RLS), `full_name text not null default ''`, `email text`, `avatar_url text`, `title text null` (A12: Slack profile title, null = none; filled at sign-in and by Sync from Slack, migration `0006_user_title`), `role role not null default 'member'`, `timezone text not null default 'Europe/Kyiv'`, `locale locale not null default 'uk'` (A14: enum `locale` = `LOCALES` from `src/contracts/locale.ts` (`uk`, `en`); UI / Slack DM language; new users from sign-in or Sync get the DB default and neither path ever writes it; only `setMyLocale` changes it; migration `0009_user_locale`), `daily_norm_hours numeric(3,1) not null default 8.0`, `pto_allowance_days numeric(4,1) null` (A9: yearly vacation allowance, null = not set; check `pto_allowance_days is null or pto_allowance_days between 0 and 365`, migration `0002_pto_allowance`), `is_active bool not null default true`, `office_id uuid null → offices` (A15, on delete set null; whose holidays apply; null = no holidays; migration `0011` assigned every existing user to `UA`), `created_at`.

**`offices`** (A15) — `id uuid PK`, `code text unique not null` (constraint `offices_code_unique`; service enforces uppercase 2–6 letters), `name text not null`, `timezone text not null` (A16: IANA zone, validated by `office-service`; migration `0014` added it nullable, backfilled `UA` → `Europe/Kyiv`, `PL` → `Europe/Warsaw`, any other office → `Europe/Kyiv`, then set not null; no DB default), `created_at`. Seeded `UA` (Ukraine) and `PL` (Poland) by migration `0011`. RLS in `0012`.

**`projects`** — A15: name + Slack channel only (`code`, `monthly_hour_cap`, `is_billable` dropped in `0010`). `name text not null`, `is_active bool not null default true`, `slack_channel_id text unique` (A11: nullable in the DB, required by the service for new projects; one channel = one project; constraint `projects_slack_channel_id_unique`, migration `0003_project_channels`), `created_by uuid null → users` (A15, on delete set null; null for rows older than A15). A16 (`0014`): `status_prompt_time text not null default '10:00'` (check `projects_status_prompt_time_check`: `~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`, local time of the daily status prompt in the project channel) and `status_prompt_office_id uuid null → offices` (on delete set null; whose timezone and holidays apply; null → the `UA` office). Projects can be **deleted** (A16, admin) only when no `time_entries` reference them (the FK is `restrict`); `project_members` and `project_prompts` cascade. Otherwise archive (`is_active = false`).

**`project_members`** (A15) — cached members of the project's Slack channel (Tempo users only). PK `project_members_pk (project_id, user_id)`, `project_id → projects` (cascade), `user_id → users` (cascade); index `project_members_user_id_idx (user_id)` (the PK leads with `project_id`). Replaced as a whole by `replaceProjectMembers` (project saved, Sync from Slack, "Refresh members"). Only members may log `work` to a project. RLS in `0012`.

**`time_entries`** (Stream A) — `user_id → users` (restrict), `project_id → projects` (restrict, null for PTO), `work_date date not null`, `hours numeric(4,2) not null`, `entry_type not null`, `task_summary text not null default ''`, `ticket_refs text[] not null default '{}'`, `source not null`, `slack_view_id text` (**not unique**, A1), `updated_at` (auto-bumped by Drizzle `$onUpdate`).
- Checks: `hours between 0 and 24`; `entry_type <> 'work' or project_id is not null`; `entry_type = 'work' or hours = 0` (mirrors `timeEntryInputSchema`).
- Indexes: `(user_id, work_date)`, `(project_id, work_date)` (A6), `(slack_view_id)` (A1).

**`daily_checkins`** (Stream B, never in hour math) — `user_id → users` (restrict), `checkin_date date not null`, `planned_today text not null default ''`, `blockers text not null default ''`, `channel_message_ts text`, `created_at`. Unique index `(user_id, checkin_date)` (A6) → upsert target.

**`company_holidays`** — per office (A15). `office_id uuid not null → offices` (on delete **restrict**), `holiday_date date not null`, `name text not null`; unique `company_holidays_office_date_unique (office_id, holiday_date)` replaced the global unique on `holiday_date` (`0011`; existing rows were backfilled to `UA`). 2026 holidays for UA and PL (7 each, Ukrainian names) seeded by `0013_a15_seed_holidays_2026` (`on conflict do nothing`).

**`slack_submissions`** (A1) — `view_id text PK`, `user_id → users` (restrict), `kind slack_submission_kind not null`, `created_at`.

**`daily_pings`** (A4) — PK `(user_id, ping_date)`, `user_id → users` (cascade), `ping_date date` (user-local date), `sent_at`. A16 removed the personal morning DM: the table is kept as history only; no code writes or reads it.

**`project_prompts`** (A16) — PK `project_prompts_pk (project_id, prompt_date)`, `project_id → projects` (cascade), `prompt_date date` (prompt-office local date), `posted_at timestamptz not null default now()`. One status prompt per project per local day. Migration `0014`, RLS in `0015`.

**`app_settings`** (A11) — `key text PK`, `value text not null`, `updated_at` (auto-bumped by `$onUpdate`). Known key: `standup_channel_id` (general channel for the full standup card). No row = not set → nothing posted. Migration `0003_project_channels`, RLS in `0004_app_settings_rls`.

Teams (`teams`, `team_members`, A13) were dropped with their data in `0010` (A15).

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

A16 prompt dedup (same pattern as the old A4 ping dedup): `insert into project_prompts … on conflict do nothing returning project_id`; post to the channel only when a row came back.

## RLS (defence in depth, A5)

**No Supabase Data API (PostgREST) access, by design.** All data access is server-side Drizzle (table owner, bypasses RLS) with service-layer RBAC (A5). Migration `0005_lockdown_grants` revokes all privileges on every table, sequence and function in schema `public` from `anon` and `authenticated` (this removes the Supabase default grants, including `TRUNCATE`, which RLS does not cover, plus `TRIGGER` and `REFERENCES`). It also revokes the default privileges for future objects. That covers only objects created by the migrating role (`postgres`), so new migrations must not re-grant to `anon`/`authenticated`.

RLS stays on as defence in depth: if grants are ever restored by mistake, the policies below still apply to Supabase-client (JWT) access. Helpers in schema `app_private` (not exposed via PostgREST), `SECURITY DEFINER`, mapping `auth.uid() → users.auth_user_id`; inactive users resolve to nothing.

| Table | Read | Write |
| :--- | :--- | :--- |
| users | own row; manager/admin all | admin |
| projects, company_holidays | active app users (`app_private.current_user_id() is not null`, `0005`) | admin |
| time_entries | own; manager/admin all | own; manager/admin all (PRD §2 "edit on behalf") |
| daily_checkins | own; manager/admin all | own only |
| app_settings (A11, `0004`) | manager/admin | admin |
| slack_submissions, daily_pings | none | none (server only) |
| project_prompts (A16, `0015`) | none | none (server only; `0015` also revokes `anon`/`authenticated` grants explicitly) |
| offices, project_members (A15, `0012`) | none | none (server only; `0012` also revokes `anon`/`authenticated` grants on both tables explicitly). Offices are read through `listOffices`. |

`anon` has no grants and no policies → no access. Migrations `0001`, `0004`, `0005`, `0008` and `0012` need Supabase (`auth.uid()`, role `authenticated`); it will not apply on plain Postgres.

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
| `time-aggregator.ts` | pure | `aggregateMonth(month, users, entries) → UserMonthRollup[]`, `projectHours(month, projects, entries) → ProjectHours[]` (A15: `work` hours per project, zero-hour projects omitted, by name; caps removed). Inputs are `time_entries` columns only; no check-in type exists in its API. Hours rounded to 0.01; `days` unrounded; norm ≤ 0 falls back to 8.0. |
| `user-service.ts` | DB | `upsertUserFromSlack` (`UpsertUserFromSlack`): upsert on `slack_user_id`, sets `auth_user_id`/email/avatar/name, timezone only when non-null, new rows `member`; role/norm/active never changed. Archived user → row refreshed, then `InactiveUserError`. `getActorByAuthUserId` (`GetActorByAuthUserId`): inactive → `null`. Pure mapping in `user-mapping.ts`. |
| `standup-service.ts` | DB | `submitSlackSubmission` (`SubmitSlackSubmission`, A1): validate first (`standup-rows.ts`: `timeEntryInputSchema`, `dailyCheckinInputSchema`, all rows must belong to `input.userId`, ticket refs via `extractTicketRefs`, `slack_view_id` = `viewId`; else `InvalidSubmissionError`, nothing written; A15: a `work` row for a project the user is not a member of → `InvalidInputError` `{ projectId: ["not_member"] }`, also before any write). One transaction: `slack_submissions` → `time_entries` → `daily_checkins` upsert (separate `upsertDailyCheckin`). 23505 on `slack_submissions_pkey` (`pg-errors.ts`) → `{ status: "duplicate" }`. |
| `errors.ts` | shared | `ForbiddenError` (A5 denial), `NotFoundError`. Callers map to 403/404 or a Slack ephemeral. |
| `pto-balance.ts` | pure | `computePtoBalance(userId, year, allowance, rows) → PtoBalance` (A9): DISTINCT vacation and sick dates; only vacation reduces the allowance; `remainingDays` null when allowance is null, may be negative, rounded to 0.1. `yearRange(year)` → `YYYY-01-01..YYYY-12-31` (RangeError on bad year). |
| `pto-service.ts` | DB | `getPtoBalance` (`GetPtoBalance`, A9): member → own `userId` only, else `ForbiddenError` (checked before any query); manager/admin → anyone, archived users included. Unknown user → `NotFoundError`. The caller picks `year` (A9: current year in the user's timezone). Queries: `findPtoAllowance` (users), `listUserPtoDates` (time_entries, `vacation`/`sick` only; holidays ignored). |
| `rollup-service.ts` | DB | `getTeamMonthRollup` (`GetTeamMonthRollup`): member → own row only; manager/admin → all active users. `getProjectHours(actor, month, userId = actor)` (`GetProjectHours`, A15): one user's `work` hours per project that month; member → self only (`ForbiddenError`), manager/admin → anyone. |

## Services (Wave 2)

Signatures: `src/contracts/services-wave2.ts` (+ `GetActorBySlackUserId` in `services.ts`). Shared helpers: `rbac.ts` (`assertCanActOnUser`, `assertManagerOrAdmin`, `assertAdmin`), `validation.ts` (`parseInput` → `InvalidInputError` with `fieldErrors` keyed by Zod path; `assertIsoDate` → `RangeError`; non-uuid ids → `NotFoundError`). Errors: `ForbiddenError` → 403, `InvalidInputError` / `RangeError` → 400, `NotFoundError` → 404.

| Module | Kind | Behaviour |
| :--- | :--- | :--- |
| `time-entry-service.ts` | DB | `listWeekEntries` (weekStart must be a Monday, else `RangeError`; reads Mon–Sun). `createTimeEntry` (`timeEntryInputSchema`, source `web_ui`, `extractTicketRefs`; A15: when `projectId` is set, the entry's **owner** must be a project member → `assertProjectMember`). `updateTimeEntry` re-validates the merged row (work keeps a project, PTO stays 0h), re-extracts tickets, keeps the original `source`; A15: moving a row to another project checks the owner's membership, unchanged project does not. `deleteTimeEntry`. `setDayStatus` in one transaction: `work` → delete that day's PTO rows; PTO → delete every row that day, insert one 0h row. RBAC: member own rows; manager/admin anyone (PRD §2). Queries: `queries/time-entry-views.ts`. |
| `checkin-service.ts` | DB | Stream B only. `listCheckinsForDate`: manager/admin → all active users; member → own. `hasBlocker` (`checkin-view.ts`, pure) = trimmed text non-empty and not `none`/`no`/`-` (case-insensitive). `setCheckinChannelTs` (system): sets `channel_message_ts` for user+date; no row → no-op. `listCheckinsForUser(actor, userId, from, to)` (A15 people page): newest first, archived users included; member → self only. |
| `directory-service.ts` | DB | `listDirectory` (manager+, archived included; A15: `officeId` + `projectIds` from `project_members`). `updateDirectoryUser` (admin; Zod patch; an admin cannot demote or archive themselves; A15 `officeId`: null or an existing office, else `InvalidInputError` on `officeId`). `syncDirectoryFromSlack` (admin; one transaction; pure plan in `directory-sync.ts`): new Slack ids → active `member`; existing → only name/email/avatar/timezone that Slack actually sent; never role, norm, allowance, `is_active`, `auth_user_id`. Returns `{ created, updated }`. |
| `project-service.ts` | DB | A15. `listProjects` (any user sees all projects; archived on request) with `createdBy { userId, fullName }`, `memberIds` and `isMember` for the actor. `upsertProject` (admin; `UpsertProjectInput`): create needs a channel (`InvalidInputError` on `slackChannelId`) and sets `created_by = actor`; update never touches `created_by`. A11 `slackChannelId`: blank → null, else must match `^[CG][A-Z0-9]{8,}$`; duplicate channel → `InvalidInputError` on `slackChannelId` ("This channel is already linked to another project"). `replaceProjectMembers(projectId, memberSlackIds)` (system; callers check admin): one transaction, replaces the member set with Tempo users among the Slack ids → `{ members, skipped }`; unknown project → `NotFoundError`. A16: `ProjectView` also carries `statusPromptTime`, `statusPromptOfficeId` and `hasTimeEntries` (correlated `exists(select 1 from "time_entries" te where te."project_id" = "projects"."id")`, explicit table names). `upsertProject` takes optional `statusPromptTime` (trimmed, `HH:MM` 00:00–23:59, else `InvalidInputError` on `statusPromptTime`; default `10:00` on create) and `statusPromptOfficeId` (null clears; unknown office → `InvalidInputError` on `statusPromptOfficeId`); omitted fields are left unchanged on update. `deleteProject(actor, id)` (admin, one transaction): unknown/malformed id → `NotFoundError`; any time entry → `InvalidInputError` `{ _: ["has_entries"] }` (also when the `restrict` FK fires in a race); members and prompts cascade. `assertProjectMember(userId, projectId)`: not a member → `InvalidInputError` `{ projectId: ["not_member"] }`. |
| `settings-service.ts` | DB | A11. `getAppSettings` (manager+) → `{ standupChannelId }`. `updateAppSettings` (admin; partial patch: omitted key untouched, null/blank deletes the row, else same channel-id check). System reads for the Slack layer (no actor): `getStandupChannelId` (null → do not post the general card), `listProjectChannels` (active projects with a non-null channel, by name). Project channels are written via `upsertProject`. Queries: `queries/settings.ts`, `queries/catalog.ts#listProjectChannelRows`. |
| `holiday-service.ts` | DB | A15 per office. `listHolidays(year, officeId?)` (any user; omitted → all offices). `addHoliday({ officeId, holidayDate, name })` / `removeHoliday` (admin; unknown office → `InvalidInputError` on `officeId`; duplicate office+date → on `holidayDate`). `copyHolidays(officeId, fromYear, toYear)` (admin): same month/day, existing dates skipped, Feb 29 into a non-leap year skipped → `{ copied, skipped }`. System read `listHolidayDatesForUser(userId, from, to)`: dates of the user's office; no office → `[]` (Slack layer: `previousBusinessDay` and PTO day expansion). Adding a holiday does **not** create `holiday` time entries. |
| `office-service.ts` | DB | A15. `listOffices` (any user; `memberCount` = users with that office, archived included). `upsertOffice` (admin; code trimmed + uppercased, `^[A-Z]{2,6}$`; duplicate → `InvalidInputError` on `code`; A16 `timezone` required, trimmed, must be an IANA zone the runtime knows (`isValidTimeZone`), else `InvalidInputError` on `timezone`). `listOffices` returns `timezone`. `deleteOffice` (admin): only when no users and no holidays, else `InvalidInputError` on `members` / `holidays`. Queries: `queries/offices.ts`. |
| `project-prompt-service.ts` | DB | A16 (replaces A4/A10 `ping-service`, which was deleted with `ping-decision.ts` and `queries/pings.ts`). `claimProjectPrompts(now)` (called by Supabase pg_cron every 15 min via `/api/cron/morning-ping`). Pure rules in `project-prompt-decision.ts`: active projects with a channel; prompt office = `status_prompt_office_id`, else the `UA` office (no `UA` row → `Europe/Kyiv`, no holidays); local time via `@date-fns/tz` in that office's timezone; window `[status_prompt_time, +90 min)` (clamped at local midnight, so a 23:30 prompt closes at 24:00); local weekday; not a holiday of that office. Then `insert into project_prompts … on conflict do nothing returning project_id`; only newly claimed projects are returned (`ProjectPromptTarget`), with `logDate = previousBusinessDay(localDate, office holidays)`. A claimed prompt is not released if the Slack post fails. Queries: `queries/project-prompts.ts`. |
| `user-service.ts` | DB | adds `getActorBySlackUserId` (active users only, returns `SlackActorProfile`). |
| `user-service.ts` | DB | A12: `upsertUserFromSlack` writes `title` trimmed when non-blank; null/blank keeps the stored title (same rule as timezone). `getMyProfile` (`GetMyProfile`): `MyProfile` (name, email, avatar, title, timezone, role) for `actor.userId` only, archived rows included; missing row → `NotFoundError`. Query `findMyProfileById`. |
| `user-service.ts` | DB | A14: `getMyProfile` and `getActorBySlackUserId` also return `locale`. `setMyLocale` (`SetMyLocale`): validates with `localeSchema` (else `InvalidInputError`), updates `actor.userId`'s row only (any role; no acting on others); missing row → `NotFoundError`. Query `updateUserLocale`. `upsertUserFromSlack` and `syncDirectoryFromSlack` never set `locale`. |
| `directory-sync.ts` | pure | A12: member `title` string → written trimmed (blank → null clears it); `null` → field omitted, stored title kept. `DirectoryUser` includes `title`. |
| `export-service.ts` | DB | `buildLedgerCsv`, `buildSummaryCsv`, `buildReportPdf`. Scope (`export-scope.ts`, pure): member → self only (`ForbiddenError` for others); manager/admin → named users or all active. Range ≤ 366 days, `from ≤ to`. A project filter drops PTO rows (they have no project). |
| `csv.ts`, `ledger-csv.ts` | pure | UTF-8 BOM, RFC 4180 quoting, CRLF. Ledger columns `Date,ISO_Week,Employee,Project,Entry_Type,Hours,Day_Equiv,Tasks,Ticket_IDs,Source`; `Day_Equiv = hours / daily_norm_hours` (4 decimals); tickets joined with `; `. Free-text cells starting with `= + - @` get a `'` prefix (CSV injection). Summary pivot: per user × month-week Hours, Days, Vac/Sick, Holidays + month total (same math as `/team`). |
| `pdf/*` | pure + render | `report-model.ts` (pure) → `ReportDocument` (`report-document.tsx`, `employee-section.tsx`, `entries-table.tsx`, `totals-table.tsx`) → `renderToBuffer`. Built-in Helvetica: Latin-1 only (non-Latin names need an embedded font). |

Routes: `GET /api/export/ledger.csv?from&to&userIds&projectIds`, `GET /api/export/summary.csv?month=YYYY-MM&projectIds`, `GET /api/export/report.pdf?from&to&userIds&projectIds` (ids comma-separated or repeated). Each calls `requireActor()`, validates with Zod and returns `Content-Disposition: attachment`. Project-scoped summaries include employees with tracked entries in the selected projects; PTO is omitted because it has no project.
