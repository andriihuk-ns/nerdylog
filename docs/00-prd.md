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
