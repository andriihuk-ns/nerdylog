# Product Requirements Document (PRD): Tempo — Internal Slack-First Time & Standup Platform

| Metadata | Details |
| :--- | :--- |
| **Product Name** | Tempo (Internal Time, PTO & Async Standup Platform) |
| **Document Version** | 1.0 (Final Baseline) |
| **Target Release** | Q4 2026 |
| **Primary Stack** | Next.js 16.4 (App Router), TypeScript, Tailwind CSS v4.3, shadcn/ui, Drizzle ORM, Supabase (PostgreSQL), Slack Bolt / Block Kit |
| **Hosting** | Vercel (Web + Serverless Slack Webhooks + Cron) & Supabase (Managed Postgres + Auth) |
| **Code Quality Mandate** | Strict modular architecture: **max 400 lines per file** enforced via ESLint/CI |

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
Currently, the team tracks time across fragmented Google Sheets tabs (`Sviatoslav`, `Artem`, `Volodymyr`, `Olena`, `Andrii`, etc.) paired with a manual `Summary` rollup tab. This creates four systemic failure points:
1. **Friday Memory Decay:** Logging an entire week's work retroactively on Friday afternoon leads to guesswork, forgotten context, and delayed reporting.
2. **Duplicate Entry & Formula Fragility:** Daily hours and free-text task descriptions must be manually aggregated into weekly totals, day-equivalents (`hours ÷ 8`), `vac/sick` counts, and `holidays`.
3. **Unstructured Metadata:** Linear/Jira ticket references (`CNG-009`, `DOG-1364`), project tags, and client monthly hour caps (e.g., *DogTeamPro — up to 40h/month (~25%)*) are buried in plain text rather than tracked programmatically.
4. **Context Switching:** Engineers and designers must leave Slack to open a browser spreadsheet just to record 2–4 hours of work.

### 1.2 Product Vision
Replace the manual spreadsheet with a **Slack-first Time & Async Standup Platform** paired with an **Apple-HIG-inspired Web Panel**. Every morning, a Slack bot prompts each teammate with a 15-second native modal: **yesterday's spent time and tasks** flow directly into the relational timesheet database, while **today's plan and blockers** post as reference-only team context.

---

## 2. User Roles & Permissions

| Role | Access & Capabilities |
| :--- | :--- |
| **Member** | • Authenticate via **Sign in with Slack (OIDC)**.<br>• Receive daily morning standup & time-logging DM pings.<br>• Log, edit, and delete their own time entries and PTO (`Work`, `Vacation`, `Sick`, `Holiday`) via Slack or Web UI.<br>• View personal monthly project allocation progress bars.<br>• Export their own timesheets (`CSV` / `PDF`). |
| **Manager** | • All **Member** permissions.<br>• View the Team Summary Matrix (replacing the legacy `Summary` sheet) across all assigned projects/teams.<br>• View team-wide daily plans and active blockers.<br>• Edit/approve teammate time entries on their behalf.<br>• Export multi-user client/project reports (`CSV` / `PDF`). |
| **Admin** | • All **Manager** permissions.<br>• Sync workspace users directly from Slack (`users.list`) and assign roles (`Admin`, `Manager`, `Member`).<br>• Create/archive Projects, set monthly hour caps (e.g., `40h/mo`), and configure regional public holiday calendars.<br>• Configure global morning ping schedules and Slack channel routing. |

---

## 3. Functional Requirements

### 3.1 Slack Bot & Daily Standup Engine (FR-SLACK)
* **FR-SLACK-01 (Morning Prompt):** Every weekday (Mon–Fri) at `09:30` in each active user's local Slack timezone (skipping configured public holidays and active PTO days), the bot sends a direct message with two CTAs:
  * Primary: **`Log Yesterday & Plan Today`** (opens Block Kit Modal).
  * Secondary: **`Quick PTO (Vacation / Sick)`** (opens 1-click PTO modal).
* **FR-SLACK-02 (Split-Stream Modal Submission):** The morning modal captures two distinct streams in one view:
  1. **Yesterday's Work (Billable/Tracked $\rightarrow$ `time_entries`):**
     * Work Date (defaults to previous business day; Friday logs Thursday, Monday logs Friday).
     * Repeatable Project rows (`Project Select` + `Hours` numeric input, e.g., `4` or `2.5` + `Task Summary`).
     * Automatic regex extraction of ticket IDs (e.g., `[A-Z]+-\d+` $\rightarrow$ `DOG-1364`, `CNG-009`).
  2. **Today's Focus & Blockers (Reference Only $\rightarrow$ `daily_checkins`):**
     * `What are you planning today?` (multiline plain text — **never** creates time entries).
     * `Any blockers?` (optional plain text — highlights in amber on Manager dashboard).
* **FR-SLACK-03 (Channel Broadcast):** Upon modal submission, the bot formats a clean standup card (`Yesterday: 4h DogTeamPro — Map modal iterations | Today: Handler mobile flow | Blockers: None`) and posts it to the designated `#daily-standup` channel (if enabled).
* **FR-SLACK-04 (Slash Commands & App Home):**
  * `/log`: Opens the time-logging modal anytime during the day.
  * `/pto`: Opens the Vacation/Sick Day logger.
  * **Slack App Home Tab:** Displays personal weekly hours, monthly project cap progress bars, remaining PTO days, and a 1-click **`Open Web Panel`** deep link.

### 3.2 Web Application — Employee Experience (FR-WEB-EMP)
* **FR-WEB-01 (1-Click Slack Auth):** Users sign in exclusively via **Slack OAuth / OIDC**. Account provisioning automatically binds `slack_user_id`, avatar, email, and timezone.
* **FR-WEB-02 (Interactive Weekly Time Matrix `/my-time`):**
  * High-density, spreadsheet-fast weekly grid (`Mon`–`Sun` + `Weekly Total`).
  * Inline cell editing: click any day/project cell to adjust hours, add task notes, or split hours across multiple projects.
  * Day-status pills: toggle any date between `Work`, `Vacation`, `Sick Day`, or `Public Holiday` (automatically sets work hours to `0` and increments PTO counters).
* **FR-WEB-03 (Client Cap Telemetry):** Subtle progress indicator per project showing current month hours vs. agreed client cap (e.g., `DogTeamPro: 32.0h / 40.0h · 80%`), shifting from neutral slate to amber at `85%` and coral at `100%`.

### 3.3 Web Application — Manager & Admin Experience (FR-WEB-MGR)
* **FR-WEB-04 (Team Summary Matrix `/team`):**
  * Exact functional replacement for the legacy `Summary` sheet, eliminating manual formulas.
  * Columns per teammate grouped by Month and ISO Week (`Week 1`–`Week 5` + `Monthly Total`):
    * `Hours` (sum of `work` entries)
    * `Days` (`Hours ÷ user.daily_norm_hours`, default `8.0`)
    * `Vac/Sick` (count of `vacation` + `sick` days, highlighted in soft coral when `> 0`)
    * `Holidays` (count of `holiday` days)
* **FR-WEB-05 (Async Standup & Blocker Drawer):** Collapsible side panel on `/team` displaying each teammate's `Planned Today` and `Blockers` for the selected date, kept strictly separate from billable hour calculations.
* **FR-WEB-06 (Admin Governance `/admin`):**
  * **Team Directory:** 1-click **"Sync from Slack"** button, role switcher (`Admin / Manager / Member`), custom daily hour norm (`8.0h` default), and active/archived status toggle.
  * **Projects & Caps:** Create projects, set monthly hour allocations (e.g., `40h`), toggle billable status.
  * **Holiday Calendar:** Define company/regional public holidays that automatically pre-fill `holiday` rows and suppress morning Slack pings.

### 3.4 Reporting & Data Export (FR-EXPORT)
* **FR-EXP-01 (CSV Export):** Generates UTF-8 CSV files (with BOM for clean Excel/Google Sheets opening) in two modes:
  1. **Detailed Ledger CSV:** `Date, ISO_Week, Employee, Project, Entry_Type, Hours, Day_Equiv, Tasks, Ticket_IDs, Source`.
  2. **Monthly Summary Pivot CSV:** Mirrors the `Summary` matrix (`Hours`, `Days`, `Vac/Sick`, `Holidays` per employee per week).
* **FR-EXP-02 (PDF Report Export):** Generates a clean, print-grade PDF report via `@react-pdf/renderer` containing company/client header, date range, employee breakdown, task descriptions, monthly totals, and PTO summary.

---

## 4. Non-Functional & UX Standards

### 4.1 "Apple-Level" Design System Specification
* **Aesthetic Direction:** Braun / Dieter Rams functional minimalism meets Apple Human Interface Guidelines.
* **Typography:** Inter / SF Pro with mandatory `font-variant-numeric: tabular-nums` on all hour cells, totals, and dates so columns align to the pixel. Minimum body size `14px`–`15px`.
* **Color & Contrast:** WCAG 2.1 AA/AAA compliant semantic tokens supporting instant Light & Dark mode switching. Neutral warm-gray surfaces (`#FAFAFA` / `#111113`), `1px` hairline borders, high-contrast ink, and restrained semantic accents (emerald for normal hours, amber for `>85%` client cap / blockers, rose for sick/vacation).
* **Motion & Tactility:** Spring-physics transitions (`cubic-bezier(0.22, 1, 0.36, 1)`) for drawers and modals; optimistic UI updates on cell edits (`< 50ms` perceived latency); minimum `44px` interactive targets.

### 4.2 Engineering & Code Architecture Constraints
* **Strict File Size Ceiling:** Every source file (`.ts`, `.tsx`) must remain **under 400 lines** (target `100–300` lines). Enforced automatically via ESLint:
  ```json
  "max-lines": ["error", { "max": 400, "skipBlankLines": true, "skipComments": true }]
  ```
* **Idempotency & Reliability:** Slack interactive payloads must be acknowledged within `< 3000ms`. Modal submissions deduplicate using Slack `view.id` to prevent double-logging on network retries.
* **Security:** All incoming Slack requests verified via HMAC-SHA256 (`X-Slack-Signature`). PostgreSQL protected by Supabase Row-Level Security (RLS).

---

## 5. Technical Architecture & Database Schema

### 5.1 System Topology
```text
[Slack Client] ──(HTTPS Webhooks / Block Kit)──► [Next.js 16.4 API Routes on Vercel]
                                                          │
[Web Browser]  ──(Slack OIDC + Server Actions)───────────┤
                                                          ▼
                                              [Service & Domain Layer]
                                              ├── time-aggregator.ts
                                              ├── standup-service.ts
                                              └── export-service.ts
                                                          │
                                                          ▼
                                              [Supabase PostgreSQL + Drizzle ORM]
```

### 5.2 Database Schema (`src/server/db/schema.ts`)
1. **`users`**
   * `id` (uuid, PK), `slack_user_id` (text, unique, not null), `full_name` (text), `email` (text), `avatar_url` (text), `role` (`admin | manager | member`), `timezone` (text, default `'Europe/Kyiv'`), `daily_norm_hours` (numeric(3,1), default `8.0`), `is_active` (boolean, default `true`), `created_at` (timestamptz).
2. **`projects`**
   * `id` (uuid, PK), `name` (text, not null), `code` (text, unique, e.g., `'DTP'`), `monthly_hour_cap` (numeric(5,1), nullable), `is_billable` (boolean, default `true`), `is_active` (boolean, default `true`).
3. **`time_entries`**
   * `id` (uuid, PK), `user_id` (FK $\rightarrow$ `users.id`), `project_id` (FK $\rightarrow$ `projects.id`, nullable for PTO), `work_date` (date, not null), `hours` (numeric(4,2), not null), `entry_type` (`work | vacation | sick | holiday`), `task_summary` (text), `ticket_refs` (text[], default `'{}'`), `source` (`slack_standup | slack_command | web_ui | sheet_import`), `slack_view_id` (text, unique, nullable), `updated_at` (timestamptz).
4. **`daily_checkins`** *(Reference-only standup log — excluded from hour totals)*
   * `id` (uuid, PK), `user_id` (FK $\rightarrow$ `users.id`), `checkin_date` (date, not null), `planned_today` (text), `blockers` (text), `channel_message_ts` (text), `created_at` (timestamptz).
5. **`company_holidays`**
   * `id` (uuid, PK), `holiday_date` (date, unique, not null), `name` (text, not null).

---

## 6. Repository Blueprint & Documentation Standards

Every engineer and AI agent working on this repository follows a strict domain-driven layout so no file exceeds 400 lines:

```text
├── docs/
│   ├── 01-architecture.md          # Data flows, Slack signature & OIDC auth diagrams
│   ├── 02-database-schema.md       # Drizzle schema, indexes, RLS rules, rollup formulas
│   ├── 03-slack-app-manifest.yaml  # Copy-paste manifest for instant Slack App setup
│   └── 04-deployment-runbook.md    # Vercel env vars, Cron setup, Supabase migrations
├── src/
│   ├── app/                        # Thin App Router pages & API entrypoints (<120 lines)
│   ├── server/
│   │   ├── db/                     # Drizzle schema + domain query files (<200 lines)
│   │   ├── services/               # Pure business logic: rollups, standup split, exports (<220 lines)
│   │   └── slack/                  # Block Kit builders, signature verifier, modal handlers (<220 lines)
│   └── components/                 # Atomic UI: WeeklyMatrix, CellEditor, StandupFeed, AdminTables (<250 lines)
└── scripts/
    └── import-legacy-sheet.ts      # One-time CSV/XLSX parser for Oct–Nov 2026 history (<200 lines)
```

---

## 7. Acceptance Criteria & Definition of Done

1. **Zero-Friction Slack Logging:** A user can complete yesterday's time entry + today's standup plan inside Slack in **under 20 seconds** without opening a browser.
2. **Strict Data Separation:** `Planned Today` and `Blockers` appear in the Slack standup channel and Web Standup Drawer, and **never** add hours to `time_entries` or `Summary` totals.
3. **100% Spreadsheet Parity + Automation:** Given identical entries for November 2026, the `/team` view computes exact matching totals (`Sviatoslav: 152.0h / 19.0d / 2.0 vac`, `Andrii: 58.0h`, etc.) automatically with zero manual formulas.
4. **Export Fidelity:** Clicking **Export CSV** or **Export PDF** downloads an accurate, cleanly formatted file within `< 2 seconds`.
5. **Codebase Hygiene:** `npm run lint` passes with zero files exceeding 400 lines, and `/docs` contains an up-to-date `slack-app-manifest.yaml` and deployment guide.
---

## 8. Amendments (v1.1, 2026-11-26, Orchestrator)

These override the sections above where they conflict. Agents must follow them.

| ID | Section | Change | Reason |
| :--- | :--- | :--- | :--- |
| A1 | §5.2 `time_entries.slack_view_id` | Remove the `unique` constraint from `time_entries`. Add table **`slack_submissions`** (`view_id` text PK, `user_id` FK, `kind` `standup \| log \| pto`, `created_at`). A modal submission inserts its `slack_submissions` row and all its `time_entries` rows in **one transaction**; a duplicate `view_id` aborts the transaction. `time_entries.slack_view_id` stays as a plain, indexed, nullable column for traceability. | One morning modal creates several `time_entries` rows (one per project). A unique column would reject the second row. |
| A2 | §3.3 FR-WEB-04 | `/team` groups by **calendar month**, split into **month-weeks**: Week 1 runs from the 1st to the first Sunday; each next week is Mon–Sun; the last week ends on the month's last day (max 6 weeks). ISO week number is still exported as the `ISO_Week` column in the ledger CSV. | ISO weeks cross month boundaries and cannot sum to a monthly total. Month-weeks match the legacy `Summary` sheet. |
| A3 | Metadata / §3.1 | Slack integration uses `@slack/web-api` plus our own HMAC verifier and route handlers, not the Bolt framework. | Bolt's receiver model fits Vercel route handlers poorly; the PRD already requires our own signature verification. |
| A4 | §3.1 FR-SLACK-01 | The morning-ping cron runs **every 15 minutes** on weekdays and sends to users whose local time is in `[09:30, 09:45)` and who have not been pinged that day. Needs Vercel Pro (Hobby allows daily crons only). Dedup via `daily_pings(user_id, ping_date)` unique. | Per-user local time needs a sub-daily cron. |
| A5 | §4.2 Security | Drizzle connects with a server-side role that bypasses RLS. **Every** server query that reads or writes user data enforces RBAC in the service layer (`member` → own rows only). RLS policies remain as defence in depth for any Supabase-client access. | Direct Postgres connections do not carry the user JWT, so RLS alone does not protect them. |
| A6 | §5.2 | Add indexes: `time_entries(user_id, work_date)`, `time_entries(project_id, work_date)`, `daily_checkins(user_id, checkin_date)` unique. | Needed for rollups and for one check-in per user per day. |
| A7 | §5.2 `users` | Add `auth_user_id` (uuid, unique, nullable): links the Supabase Auth user to the Tempo user. Filled at first Slack sign-in. Users created by "Sync from Slack" start with it null. RLS maps `auth.uid()` through it. | Users exist before they sign in, so `users.id` cannot equal the auth id. Approved 2026-11-26. |
| A8 | §5.2 `time_entries` | DB check constraints: `0 <= hours <= 24`; `work` rows need `project_id`; non-work (PTO) rows have `hours = 0`. The legacy import maps sheet PTO hours to 0. | Mirrors `timeEntryInputSchema`; keeps bad rows out of rollups. Approved 2026-11-26. |
| A9 | §5.2 `users`, FR-SLACK-04, FR-WEB-06 | Add `pto_allowance_days` (numeric(4,1), nullable): yearly **vacation** allowance per user, set by admins in the Team Directory. Remaining = allowance − distinct `vacation` days in the current calendar year (in the user's timezone). Sick days and holidays never reduce it. When null, App Home shows vacation days used only. | App Home must show remaining PTO; the schema had no allowance. Approved 2026-11-26. |
| A10 | A4, hosting | **Supersedes A4's scheduler and window.** The ping endpoint is called every 15 min by **Supabase `pg_cron` + `pg_net`** (secrets in Supabase Vault), not Vercel Cron (Hobby allows daily only). A user is due on the first run where local time is in **[09:30, 11:00)** on a local weekday, not a company holiday, not on PTO, and not yet pinged that local date (`daily_pings`). Late or skipped runs therefore never cause a missed ping. | Vercel Hobby limit; external schedulers can run late. Approved 2026-11-26. |
| A11 | FR-SLACK-03, FR-WEB-06, §2 Admin "channel routing" | **Admin-chosen channels replace `SLACK_STANDUP_CHANNEL_ID`.** (1) `projects.slack_channel_id` (text, nullable, unique): one channel = one project. After a submission, each project that has a channel gets a post with **only that project's lines**: `<Name> · <hours>h · <task summary> (<ticket refs>)`, one line per entry, hours shown. Nothing about other projects, plans or blockers goes there. (2) New table `app_settings(key text PK, value text not null, updated_at timestamptz)`; key `standup_channel_id` = optional general team channel that receives the full standup card (yesterday summary, plan, blockers); its ts is stored in `daily_checkins.channel_message_ts`. No channel set → nothing is posted. (3) In `/admin`, admins pick channels from a dropdown of the workspace's non-archived channels. Picking a public channel the bot is not in makes the bot join it; a private channel shows "invite @Tempo first". Bot scopes add `channels:read`, `groups:read`, `channels:join`. (4) PTO and `/log` submissions also post project lines; the general card is only for the morning standup. | Admin should route posts without a redeploy; channels are all internal (confirmed 2026-11-26). Approved 2026-11-26. |
| A12 | §5.2 `users`, avatar menu | Add `users.title` (text, nullable): the member's Slack profile title ("Product Designer"). Filled at sign-in (bot `users.info`, scope `users:read`) and by "Sync from Slack" (`users.list` `profile.title`); a blank Slack title stores null. The avatar menu shows the title under the name, falling back to the role when null. New service `getMyProfile(actor)` returns name, avatar, title, timezone and role so pages stop guessing (also replaces the Europe/Kyiv assumption in the web UI). | User request 2026-11-26. |
| A13 | §2 Admin, FR-SLACK-03, FR-WEB-06 | **Teams mirror Slack user groups.** Tables `teams` (`id` uuid PK, `slack_usergroup_id` text unique not null, `handle` text not null, `name` text not null, `slack_channel_id` text nullable unique, `is_active` boolean default true, `updated_at`) and `team_members` (`team_id` FK cascade, `user_id` FK restrict, PK both). "Sync from Slack" also reads user groups (`usergroups.list` incl. disabled, `usergroups.users.list`; bot scope `usergroups:read`): creates/updates teams, replaces each team's membership with the group's members who exist in Tempo, marks groups that are disabled or gone as `is_active = false` (memberships kept). A person may be in several teams. Admins pick one channel per team in `/admin` → Teams (suggested: the group's first default channel; same picker/join rules as A11). **Standup routing:** a morning standup card goes to every distinct channel of the member's active teams; members without any team channel fall back to the general standup channel (A11). Project channels are unchanged. Managers still see all users in `/team` (team-scoped managers are out of scope). | User request 2026-11-27. |
| A14 | §4.1, all UI, FR-SLACK | **Localisation: English + Ukrainian.** `users.locale` (`en | uk`, not null, default `uk`). Web: `next-intl`, locale from cookie `NEXT_LOCALE` (no URL prefix); a signed-in user's `users.locale` wins and is copied into the cookie. First visit = Ukrainian. Switcher on the login screen and in the avatar menu (EN / УКР); switching while signed in also saves `users.locale`. All web copy (pages, components, toasts, errors, empty states, metadata) comes from `messages/{en,uk}.json`. Dates, weekdays, months and numbers use `Intl` with the active locale (uk: "Пн", "2,5"); hour inputs accept `2.5` and `2,5`. Slack: personal surfaces (DMs, modals, App Home, /log, /pto replies, error DMs) use the recipient's `users.locale`; unknown users get Ukrainian. Shared-channel posts (project lines, standup cards) stay English. Exports (CSV, PDF) stay English. | User request 2026-11-27. |
| A15 | §2, §3, §5.2 (supersedes A13 and the cap parts of FR-WEB-03/FR-SLACK-04/A11) | **Batch 2026-11-27.** (1) **Teams removed**: tables `teams`/`team_members` dropped with their data; no user-group sync; scope `usergroups:read` removed; morning standup cards go to the general standup channel (A11) again. (2) **Projects = name + Slack channel**: columns `code`, `monthly_hour_cap`, `is_billable` dropped; client-cap tracking removed everywhere (My Time pills, App Home bars, services); hours per project are still shown. New `projects.created_by` (FK users, nullable for old rows). A new project needs a channel. (3) **Project members = members of the project's Slack channel**, cached in `project_members(project_id, user_id)` and refreshed when a project is saved, on "Sync from Slack", and via a "Refresh members" action. Only members can log time to a project (web + Slack); everyone sees all projects, non-members see "Ask {creator} to add you to #channel". Slack modals list only the user's projects. What a user logs for a project is posted to that project's channel (A11). The morning prompt stays a DM; users can also open the bot from Slack's Apps list (App Home "Log time" / "Time off" buttons) anytime. (4) **Offices**: table `offices(id, code unique, name)`; `users.office_id` (FK, nullable); `company_holidays.office_id` (not null) with unique `(office_id, holiday_date)` replacing unique `holiday_date`. Seeded offices `UA` (Ukraine) and `PL` (Poland); all existing users assigned UA. Holiday-aware logic (morning ping, previous business day, PTO day expansion) uses the user's office; users without an office get no holidays. Admins CRUD offices (delete only when empty) and assign people. (5) **Holidays seeded for 2026** per office (UA 7 days, PL 7 days, from the user's list) as a data migration; each year admins add/adjust them in /admin → Holidays per office, with "Copy from {previous year}" (same day/month, then adjust moving feasts). (6) **People page**: admins open a person from Directory → profile, office, role, PTO balance, month totals, hours per project, recent standups, and their week grid (editable on their behalf, PRD §2). (7) UI: inline 3-icon theme row; Directory search + project filter + per-field "Saved ✓" indicator; Team tab search + project filter; export buttons become "Week ▾" / "Month ▾" menus (CSV, PDF). | User request 2026-11-27. |
| A16 | A10, A15, FR-SLACK-01/02, FR-WEB-02 | **Batch 2026-11-27 (2).** (1) **Status prompt per project, in its channel** (replaces the personal morning DM of FR-SLACK-01/A10): `projects.status_prompt_time` (text "HH:MM", default "10:00") and `projects.status_prompt_office_id` (FK offices, nullable → UA). `offices.timezone` (IANA, not null; UA = Europe/Kyiv, PL = Europe/Warsaw). The 15-min cron posts once per project per local day (dedupe table `project_prompts(project_id, prompt_date)` PK) when the office-local time is in [prompt_time, prompt_time + 90 min), on weekdays, not on that office's holidays. The post has a "Log time & status" button that opens the standup modal with the project preselected; non-members get an ephemeral "Ask {creator} to add you". The personal DM ping is removed (`daily_pings` kept only as history). (2) **Bot inputs all required**: project, hours and task summary per row; today's plan; blockers (type "None" if none); PTO end date (may equal start). (3) **Weekend day status** in the web grid: Sat/Sun show "Weekend" by default (display only, no new entry type); switching to "Work" unlocks cells for overtime; weekend hours are normal work entries. (4) **Delete project** (admin, confirmed): allowed only when it has no time entries; otherwise archive. Every destructive action in the UI asks for confirmation. (5) **People page** moves to `/people/[id]` and opens for managers and admins; Team board rows link to it (own row → /my-time). (6) UI copy simplified (uk + en); "Standups" → "Status". | User request 2026-11-27. |
| A17 | FR-SLACK-02/03, FR-WEB-02 | **Artifact links in descriptions.** URLs in task summaries and plans are parsed client/server-side by `src/contracts/links.ts` (no network; private tools can't be fetched): Jira, Confluence, Figma, Asana, Google Docs/Sheets/Slides/Drive, GitHub, Linear, Notion, Loom, else host. Web shows inline chips (provider icon + label, opens in a new tab, `rel="noopener noreferrer"`). Slack shared posts render `<url|Provider · label>` and enable unfurls so installed Slack apps show rich previews. Jira/Linear keys from URLs count as ticket refs. Stored text is unchanged; CSV/PDF keep raw URLs. | User request 2026-11-27. |
| A18 | FR-EXP-01/02, §3.4 | **Project-scoped exports.** On `/team`, a selected project scopes the weekly ledger CSV/PDF and monthly summary CSV, ledger CSV, and PDF. Reports include that project's members and tracked work; PTO and holidays are shown as context and never added to project hours. Other projects' work is excluded. With All projects selected, existing exports remain unchanged. | User request 2026-11-27. |
| A19 | A10, A16, FR-SLACK-01 | **Restore the personal morning time reminder alongside A16 project-channel prompts.** The existing 15-minute Supabase cron sends one localized DM per active user in the `[09:30, 11:00)` window of their timezone, on weekdays, excluding their office holidays and dates with a PTO entry; `daily_pings(user_id, ping_date)` deduplicates local dates. The DM summarizes entries for the previous business day (including vacation, sick and holiday records), says when no entries exist, and includes a button that opens `/log` for that date so the user can log missing time or add more. | User request 2026-11-27. |
| A20 | FR-SLACK-02, FR-WEB-02 | **Shared task/link groups.** Slack logging and the web calendar use the same checklist shape: up to 10 task descriptions (500 characters each), each with one optional link; the serialized summary is limited to 2,000 characters. Web calendar cells show these groups and let an authorized user add, edit, or remove them. When a project/day has multiple time entries, edit the combined task groups while preserving the entries' hours. | User request 2026-11-27. |
| A21 | FR-WEB-MGR | **People profile presentation.** Remove the recent-status section and the visible week title. Put position, email, office, role, and status together as icon-led metadata without visible field labels. Calendar task groups collapse to two lines with a fade and a chevron to reveal the full details. | User request 2026-11-27. |
| A22 | FR-WEB-02 | **Task editor dialog.** Open the project/day task editor in a centered desktop dialog and a full-screen mobile dialog with a fixed action footer and a scrollable form. Keep description inputs wide, make link controls icon-sized, and hide remove on the only task group. | User request 2026-11-27. |
| A23 | FR-WEB-02, FR-WEB-04 | **Calendar navigation and export ranges.** My Time, Team, and person-week views can jump directly to a selected date/month while preserving page filters. CSV/PDF exports can use any inclusive start/end date range up to 366 days. The Team month summary keeps its four monthly-total columns pinned to the right edge while scrolling weeks. | User request 2026-11-27. |
| A24 | A23 | **Period controls and exports.** Replace browser-native date inputs with one token-styled date picker used across time, reports, status, and holiday pages. Remove custom date-range export selection. Use one shared menu hierarchy: `Export → Week/Month → CSV/PDF`. | User request 2026-11-27. |
| A25 | FR-WEB-06, A15 | **Directory sync on entry.** Remove the global Slack sync button from the admin directory. When an admin opens the directory, refresh people from Slack at most once every 12 hours per browser profile. Do not refresh every project's channel membership in this flow; project membership continues to refresh from the project's own controls. Surface sync failures in the directory UI. | User request 2026-11-27. |
| A26 | §2, §5.2, FR-WEB-06 | **Sick leave allowance and project allocation.** Directory settings edit sick-leave allowance alongside vacation allowance; daily norm remains internal for day-equivalent calculations. PTO balances show used and remaining vacation and sick days. Each project member has monthly allocated hours, default 160; admin can choose 25%, 50%, 75%, or 100% of a standard 160-hour month, or enter custom hours/month (0.5–744 in half-hour increments). Member allocations persist when Slack membership is refreshed for members who remain in the channel. | User request 2026-11-27. |
| A27 | A20 | **Unlimited task links.** A task takes any number of links on web and Slack (Slack: one multi-line field, one link per line, up to Slack's 3,000 characters). Each URL is at most 2,000 characters and the serialized task summary at most 10,000 (was 2,000). | User request 2026-11-27. |
| A28 | A17, A20, A27 | **Links keep their place.** A URL pasted or typed inside a task description stays in the stored text and renders as a chip at that position; links added through the link fields render after the text. The 500-character task limit counts text without URLs; the editor never cuts text silently. The 10,000-character summary limit still includes URLs. Slack modal inputs keep Slack's 500-character cap. | User request 2026-11-27. |
| A29 | §2, FR-SLACK-01/02/03, A16 | **Simpler status form, quarter-hour prompts, time zones.** (1) The Slack status modal drops the Today heading, plan and blockers; the standup card then shows yesterday only. (2) Status prompt time is typed or picked and stored rounded to the nearest 15 minutes (23:45 at most), with a bottom notification explaining the scheduler step when a typed time is rounded. (3) A project picks a time zone (`projects.status_prompt_timezone`, nullable; null → its office zone) instead of an office; holidays come from the office in that zone (UA first), else UA. (4) Project and office forms share one searchable time zone list: one entry per distinct clock, Russian cities omitted. | User request 2026-11-27. |
| A30 | A15 | **Office order.** Admins drag offices into order on the Offices tab (keyboard: arrow keys on the handle). The order drives the office tabs on Holidays (the first one opens by default) and office lists elsewhere. Stored in `app_settings.office_order` (no schema change); offices not in it follow by code. | User request 2026-11-27. |
| A31 | A11, A16 | **Private status prompt and confirmations.** (1) The project status prompt is no longer posted publicly: each active project member sees it in the project channel as an "only visible to you" message and gets a copy in the bot DM. (2) After a submission, a project's lines are shown only to the submitter in that channel, and the bot DM gets a "Logged {hours}" copy; nothing is posted publicly to project channels. The admin-chosen general standup channel (A11) is unchanged. (3) Changing a project's prompt time, time zone or office clears its recent `project_prompts` claim, so the new time can send again the same day. | User request 2026-11-27. |
| A32 | A14, A31 | **Bot messages follow the web language.** Private bot messages, including the project status prompt, use the recipient's `users.locale` (chosen in the web portal). The "Logged" confirmation groups hours and tasks by project and links to My Time; saved time off gets a DM confirmation. The general standup channel card stays English. | User request 2026-11-27. |
| A33 | A31, A32 | **Channel first, DM as fallback.** The status prompt and the post-submission confirmation appear only in the project channel as "only visible to you" messages; the bot DM gets them only when Slack refuses the channel message or the project has no channel. The confirmation is one line: hours, project, date, link to My Time. Time off is still confirmed by DM, and the A19 morning reminder stays a DM. Accepted limit: Slack does not guarantee ephemeral delivery to people who are away, and the message does not survive a reload. | User request 2026-11-27. |
| A34 | A19, A33, FR-SLACK-01 | **No personal morning reminder.** A19 is withdrawn: the only scheduled bot message is each project's status prompt at its own time, once per project per local day (re-armed only when its schedule changes, A31). `daily_pings` is kept as unused history. | User request 2026-11-27. |
| A35 | A28 | **Multi-line Slack task field.** The Slack task description is a multi-line field. It now follows the web rule: 500 characters not counting URLs, checked on submit; the input itself allows Slack's 3,000. Replaces A28's "Slack modal inputs keep Slack's 500-character cap". | User request 2026-11-27. |
| A36 | A28 | **Typed links are parsed into link fields in the web editor.** Each URL in a task description shows as a short marker (e.g. `[🔗1 react.dev]`) in the text and as an editable, removable input below, numbered in text order; pasted URLs convert at once, typed ones on leaving the field. A marker is deleted as one unit. Stored text keeps the URL at that position, so task details render chips in the same order; links added with the link button still render after the text. | User request 2026-11-27. |
