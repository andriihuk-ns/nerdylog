# 05 — Tempo Design System

Owner: Designer. Source of truth for tokens: `src/app/globals.css`. Product rules: `docs/00-prd.md` §4.1 and §8.

## 1. Principles

1. **Less, but better (Rams).** One surface, one ink, four meaning colours. Colour carries state, never decoration.
2. **Numbers first.** Hours, totals, dates and percentages are the content. They are tabular, right-aligned, and never truncated.
3. **Two streams, two looks.** Stream A (tracked time) lives in grids and numbers. Stream B (plan, blockers) lives in prose cards and the drawer. A standup card never shows an hour total next to plan text.
4. **Deference (HIG).** Chrome recedes: hairline borders, no shadows on grids, one elevation (popover/dialog/drawer).
5. **Fast and forgiving.** Every edit is optimistic, every error is recoverable in place, and nothing needs a mouse.

## 2. Colour tokens

All tokens are CSS variables on `:root` / `.dark` and Tailwind colours via `@theme inline` (`bg-work-subtle`, `text-pto`, `border-input`). Dark mode = `.dark` on `<html>` (shadcn convention).

Ratios are WCAG 2.1 relative-luminance contrast, computed from the hex values (script: sRGB → linear → `(L1+0.05)/(L2+0.05)`). Targets: text ≥ 4.5:1, UI edges and focus ≥ 3:1.

### 2.1 Surfaces and ink

| Token | Light | Dark | Measured against | Light | Dark |
| :--- | :--- | :--- | :--- | ---: | ---: |
| `background` | `#FFFFFF` | `#111113` | — | | |
| `foreground` | `#111113` | `#F4F4F5` | background | 18.07 | 17.16 |
| `card` / `popover` | `#FFFFFF` | `#18181B` / `#1C1C1F` | foreground on card | 18.86 | 16.12 |
| `primary` / `-foreground` | `#18181B` / `#FAFAFA` | `#F4F4F5` / `#18181B` | fg on primary | 16.97 | 16.12 |
| `muted` / `secondary` / `accent` | `#F4F4F5` | `#232326` | secondary-fg on muted | 16.12 | 14.26 |
| `muted-foreground` | `#5F5F67` | `#A1A1AA` | background | 6.06 | 7.36 |
| | | | muted | 5.76 | 6.12 |
| | | | card | 6.33 | 6.91 |
| `border` (hairline, decorative) | `#E4E4E7` | `#2A2A2E` | background | 1.22 | 1.32 |
| `input` (control edge) | `#8A8A93` | `#6E6E76` | card | 3.42 | 3.51 |
| | | | background | 3.28 | 3.73 |
| `ring` (focus) | `#71717A` | `#A1A1AA` | background | 4.63 | 7.36 |
| `destructive` | `#C81E1E` | `#F87171` | background | 5.50 | 6.82 |

`border` is below 3:1 on purpose: it separates grid cells, it does not identify a control (WCAG 1.4.11 exempts it). Anything the user must find to operate (inputs, select triggers, editable cells on focus) uses `input` or `ring`.

### 2.2 Semantic tokens

Each meaning has three roles: `<name>` (ink and fills), `<name>-foreground` (text on a solid `<name>` fill), `<name>-subtle` (tinted background; text on it uses `<name>`).

| Meaning | Use | Token | Light | Dark |
| :--- | :--- | :--- | :--- | :--- |
| **work** (emerald) | logged hours, progress fills, success | `work` / `-fg` / `-subtle` | `#047857` / `#FFFFFF` / `#ECFDF5` | `#34D399` / `#04261A` / `#0D2A20` |
| **warning** (amber) | cap 85–99 %, blockers | `warning` / `-fg` / `-subtle` | `#B45309` / `#FFFFFF` / `#FFF8E6` | `#FBBF24` / `#261A00` / `#2B2110` |
| **pto** (rose/coral) | vacation, sick, cap ≥ 100 % | `pto` / `-fg` / `-subtle` | `#BE123C` / `#FFFFFF` / `#FFF1F2` | `#FB7185` / `#2A0A10` / `#2E1519` |
| **holiday** (blue-gray) | public holidays | `holiday` / `-fg` / `-subtle` | `#475569` / `#FFFFFF` / `#F1F5F9` | `#94A3B8` / `#0F172A` / `#1C222C` |

Measured contrast (all pass AA text):

| Pair | work L / D | warning L / D | pto L / D | holiday L / D |
| :--- | ---: | ---: | ---: | ---: |
| ink on `background` | 5.25 / 9.81 | 4.81 / 11.30 | 6.02 / 7.01 | 7.26 / 7.36 |
| ink on `card` | 5.48 / 9.22 | 5.02 / 10.61 | 6.29 / 6.58 | 7.58 / 6.91 |
| ink on `-subtle` | 5.21 / 7.98 | 4.74 / 9.47 | 5.72 / 6.31 | 6.92 / 6.23 |
| `-foreground` on solid | 5.48 / 8.42 | 5.02 / 10.23 | 6.29 / 6.79 | 7.58 / 6.96 |

Rules:
- Light-mode amber is the tightest pair (4.74:1 on its subtle tint). Do not lighten `warning` or darken `warning-subtle`; do not put amber text on `muted`.
- Colour is never the only signal: cap pills carry the percentage, PTO cells carry a label (`Vac`, `Sick`, `Hol`), blockers carry an icon + the word "Blocker".
- Charts use `chart-1..5` = work, holiday, warning, pto, neutral.

## 3. Typography

Stack: `Inter` (via `next/font`, variable `--font-inter`) → `-apple-system` / SF Pro → Segoe UI → system-ui. Mono: Geist Mono → SF Mono.

| Role | Size / line | Weight | Use |
| :--- | :--- | :--- | :--- |
| Display | 24 / 32 px | 600, tracking −0.01em | page title (`My time`, `Team`) |
| Title | 18 / 24 px | 600 | drawer title, section heads |
| Body | 14 / 20 px | 400 | default text, cells |
| Body-strong | 14 / 20 px | 500 | row labels, totals |
| Callout | 15 / 22 px | 400 | standup prose in the drawer |
| Caption | 12 / 16 px | 500 | column heads, pill text, metadata |
| Numeric | 14 / 20 px | 500, `tabular` | every hour, total, %, date |

Rules: body never under 14 px (caption only for labels). Use the `tabular` utility (or Tailwind `tabular-nums`) on every number; `<time>` and `<data>` get tabular figures by default. Hours render with one decimal (`2.5`, `8.0`), days with up to two decimals, trailing zeros trimmed to one (`19.0`, `7.25`), percentages as integers (`80%`).

## 4. Spacing, layout, shape

- 4 px base grid. Scale: 4, 8, 12, 16, 24, 32, 48.
- Interactive targets ≥ 44 × 44 px (`hit-target` utility). Grid cells are 44 px tall; the hit area is the whole cell.
- Select triggers are 44 px high by default; option rows have a 44 px minimum height. Menus align below the trigger, start-aligned, at the trigger's width.
- Page: max width 1280 px, gutters 24 px (16 px under 640 px). Section gap 32 px.
- Radius: `--radius` 10 px for cards and popovers; full for buttons, switches, and dots; 6 px for cells' focus outline and compact pills (`rounded-sm`).
- Borders: 1 px `border` hairlines. Grids have no broad card shadows. Pinned table columns are marked by a 1 px `border` rule on their inner edge (`PINNED_EDGE_LEFT` / `PINNED_EDGE_RIGHT`), drawn as a pseudo-element so it stays put while the grid scrolls. Popovers and drawers use one shadow `0 8px 24px rgb(0 0 0 / 0.08)` (dark: 0.4).

## 5. Motion

| Token | Value | Use |
| :--- | :--- | :--- |
| `--ease-spring` (`ease-spring`) | `cubic-bezier(0.22, 1, 0.36, 1)` | drawers, modals, sheets |
| `--ease-standard` (`ease-standard`) | `cubic-bezier(0.2, 0, 0, 1)` | hover, pills, popovers |
| `--duration-fast` | 120 ms | hover, press, focus |
| `--duration-base` | 200 ms | pill change, optimistic-save flash |
| `--duration-slow` | 320 ms | drawer/modal enter (exit at 70 %) |

`transition-spring` = transform + opacity, spring, slow. Animate only `transform` and `opacity`. `prefers-reduced-motion: reduce` zeroes all durations: state still changes, nothing moves.

## 6. Components

Shared states vocabulary:
- **Loading:** skeleton rows with the final geometry (no spinners in grids). Skeleton = `muted` blocks, no shimmer under reduced motion.
- **Optimistic save:** value commits locally at once (< 50 ms), cell background flashes `work-subtle` for `--duration-base`. On failure the old value returns, the cell gets a 1 px `destructive` inset ring and an inline toast "Couldn't save 4.0h on Tue. Retry". Retry re-sends; Esc dismisses.
- **Error (load):** inline panel in place of the grid: one sentence + `Retry` button. Never a blank page.

### 6.1 Cap pill

Input: `capStatus(usedHours, capHours)` from `src/contracts/rollup.ts`.

| Status | Rule | Track / fill | Text |
| :--- | :--- | :--- | :--- |
| `neutral` | < 85 % or no cap | `muted` / `foreground` at 60 % | `foreground` |
| `warning` | 85–99 % | `warning-subtle` / `warning` | `warning` |
| `over` | ≥ 100 % | `pto-subtle` / `pto` | `pto` |

Layout: `DogTeamPro  32.0h / 40.0h · 80%` on one line (Body-strong name, Numeric values), 4 px bar below, full width, fill clamped at 100 %. Over-cap shows `+3.5h over` in caption. No cap → `12.0h · no cap`, no bar. Status text is in the `aria-label` ("DogTeamPro, 32 of 40 hours, 80 percent, within cap").

### 6.2 `/my-time` weekly matrix

Layout:
- Header: week switcher (`‹`, `Nov 23 – 29, 2026`, `›`, `Today`), right: weekly total `32.5h` (Display, tabular).
- Day-status row: one pill per day (`Work`, `Vac`, `Sick`, `Hol`) above the grid.
- Grid: rows = projects (sticky first column, 200 px), columns = Mon–Sun (min 240 px, right-aligned) + `Total` (bold). Footer row = daily totals. Weekend columns use `muted` background at 50 %.
- The `Add project` control stays in the sticky project column while the day columns scroll horizontally on phones.
- PTO day: whole column tinted `pto-subtle` (`holiday-subtle` for holidays), cells show `—` and are read-only; the pill shows the label.
- Cap pills for the user's projects sit below the grid (6.1).
- Under 768 px: one day per card, swipe/arrow between days.

Keyboard (grid uses `role="grid"`, roving tabindex):
- Arrows move focus; Home/End = first/last day; Ctrl+Home/End = first/last cell.
- Enter or typing a digit starts editing; Enter commits and moves down; Tab commits and moves right; Esc cancels.
- `.` or `,` accepted as decimal; values snap to 0.25 h; > 24 → inline error "Max 24h a day".
- Shift+Enter opens the centered task editor dialog; it fills the screen under 640 px. Cancel/save actions stay pinned below the scrollable form.
- Clicking an editable project/day cell opens the task editor dialog; Enter, F2, and typing a digit still start direct hours entry.
- The week grid, team summary and People directory headers stay under the app header while the page scrolls, as a CSS-sticky copy of the head over the real one (`shell/floating-head`); the week grid floats the day names only. Once it moves, the copy has square corners and no top border (the app header’s line is enough).
- Prompt time (A29): a typed field with an hours + quarter-minutes popover; a typed value rounds to the nearest quarter on blur and a bottom notification says why (nothing is shown otherwise). Time zones: one searchable combobox for projects and offices (offset above city names).
- Icon-only buttons (no visible label) are always fully round and show a muted circle on hover.
- Task editor: “Add link” is a ghost button below the description.
- Task editor: each task is one card with a borderless, multi-line description (three lines by default, grows with the text, no resize handle) (no outline on hover or focus). Pasted URLs stay in the text where they were and render as chips at that position; links added with “Add link” render after the text. Text over 500 characters (links not counted) is never cut: it shows an error and blocks save. The editor shows no detected-ticket chips.
- Each work cell shows up to two lines of its task/link groups below the hours, with a card-colored fade and chevron to expand longer details. “Add tasks” / “Edit tasks” opens a group editor with up to 10 tasks, one optional link per task, and a save that preserves the hours. When several time entries share a project/day cell, their groups are combined for editing and saved together.
- `[` / `]` previous / next week. `T` today.
- Use the calendar icon to jump directly to any date's week; export actions share the `Export → Week/Month → CSV/PDF` menu.
- Day pill: Space cycles Work → Vac → Sick → Hol; changing to PTO with logged hours asks once "Clear 6.0h on Wed?".

States: loading = skeleton grid 5 rows; empty week = grid with the user's active projects and a muted line "No hours yet. Type a number in any cell, or log from Slack with /log."; optimistic and error as shared.

### 6.3 `/team` summary grid (amendment A2)

Layout:
- Header: month switcher (`‹ November 2026 ›`), team filter, `Export CSV`, `Export PDF`, `Standups` toggle (opens 6.4).
- Columns: grouped by month-week (Week 1 = 1st to first Sunday; then Mon–Sun; last ends on month end; up to 6), each group shows its date range in caption (`Nov 1–2`), then `Monthly total`. Each group has four sub-columns: `Hours`, `Days`, `Vac/Sick`, `Holidays`.
- Rows: one per teammate (sticky name column with avatar, 220 px). Footer: team totals.
- Values: Hours 1 decimal, Days 1–2 decimals (`hours ÷ dailyNormHours`), counts as integers or `.5`. Zero shows as `·` in `muted-foreground` to cut noise.
- `Vac/Sick > 0`: cell `pto-subtle`, text `pto`. Holidays > 0: text `holiday`. Monthly total group has a 1 px `foreground` at 20 % left rule and Body-strong numbers.
- Under 1024 px: month-week groups collapse to Hours only, with a toggle "Show all columns"; horizontal scroll with sticky name column.
- The four monthly-total columns stay pinned to the right edge while weeks scroll. The calendar picker jumps directly to any month; exports use the shared `Export → Week/Month → CSV/PDF` menu.

Keyboard: grid navigation as 6.2 (read-only; Enter on a row opens that person's `/my-time` for the week, for managers). `[` / `]` previous / next month. `S` toggles the Standup drawer.

States: loading = skeleton with real column geometry; empty team = "No teammates in this view. Admins can sync from Slack in Admin."; partial month = future weeks shown with `muted` header and `·` cells; error as shared.

### 6.4 Standup & Blocker drawer (Stream B only)

- Right-side drawer, 400 px (full screen under 640 px), enters with `transition-spring` from x = 100 %. Does not cover the name column on wide screens (grid reflows).
- Header: Title "Standups", date picker (defaults to today), close button (44 px).
- Sections in order: **Blockers** (only people with blockers; each card has `warning-subtle` background, `warning` 2 px left rule, alert icon, word "Blocker"), then **Plans** (all teammates, alphabetical). Card = avatar, name, submitted time (`09:34`, tabular), Callout text, preserved line breaks, ticket refs as mono chips.
- No hours, totals or caps in the drawer. Ever.
- Keyboard: focus moves to the drawer title on open, focus is trapped; Esc closes and returns focus to the trigger; ↑/↓ move between cards; `←`/`→` change date.
- States: loading = three card skeletons; empty date = "No standups for Tue, Nov 24."; not-yet-submitted people listed at the end in `muted-foreground` ("No standup yet"); error = inline retry.

## 7. Slack surfaces (Block Kit structure)

Slack renders its own colours; we control structure, copy and emoji only. Keep labels short; hours always as `4h` / `2.5h`.

### 7.1 Morning DM (FR-SLACK-01)

1. `section` — mrkdwn "Morning, {first name}. Log *{yesterday weekday}* and plan today."
2. `actions` — `button` "Log Yesterday & Plan Today" (style `primary`), `button` "Quick PTO (Vacation / Sick)".
3. `context` — "Takes about 15 seconds. Hours go to your timesheet; plans are shared only as context."

### 7.2 Morning modal (FR-SLACK-02)

`modal`, title "Daily standup", submit "Submit", close "Cancel". Blocks in order:

1. `header` — "Yesterday's work".
2. `input` — `datepicker` "Work date", initial = previous business day.
3. For each project row *n* (start with 1, max 6):
   - `input` — `static_select` "Project" (active projects).
   - `input` — `number_input` (decimal allowed, min 0.25, max 24) "Hours".
   - `input` — `plain_text_input` "What did you do?" (single line, optional). Hint: "Ticket IDs like DOG-1364 are picked up automatically."
   - `divider` between rows.
4. `actions` — `button` "+ Add project" (updates the view with another row; `button` "Remove last" once n > 1).
5. `context` — "Off yesterday? Use Quick PTO instead."
6. `divider`.
7. `header` — "Today (shared as context, not tracked)".
8. `input` — `plain_text_input` multiline "What are you planning today?"
9. `input` — `plain_text_input` multiline, optional, "Any blockers?"

Validation errors return `response_action: errors` on the specific block ("Hours must be between 0.25 and 24"). Submitting is idempotent via `slack_submissions` (A1).

### 7.3 Channel standup card (FR-SLACK-03)

1. `section` — "*{Name}*" with avatar `image` accessory.
2. `section` with two `fields` — "*Yesterday*\n4h DogTeamPro — Map modal iterations" and "*Today*\nHandler mobile flow".
3. `context` — ":warning: Blocker: {text}" or "No blockers".

### 7.4 App Home (FR-SLACK-04)

1. `header` — "Your week".
2. `section` — fields: "*This week*\n32.5h" and "*Today*\nNot logged" (or "6.0h").
3. `actions` — `button` "Log time" (primary), `button` "Quick PTO", `button` "Open Web Panel" (url).
4. `divider`.
5. `header` — "Client caps · November".
6. Per capped project, one `section`: "*DogTeamPro*  32.0h / 40.0h · 80%\n`▰▰▰▰▰▰▰▰▱▱`" (10-segment bar), plus status emoji: none for neutral, :large_orange_circle: at 85–99 %, :red_circle: at ≥ 100 %.
7. `divider`.
8. `header` — "Time off".
9. `section` — fields: "*Vacation used ({year})*\n8 days", "*Sick used*\n2 days", "*Next holiday*\nDec 25". (PRD asks for *remaining* PTO days, but the schema has no allowance field; show "used" until the Orchestrator adds one.)
10. `context` — "Updated {time} · Hours are tracked from your standups and /log."

Empty states: no projects → section "No projects assigned yet. Ask an admin."; no caps → hide steps 5–6.
