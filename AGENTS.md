<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — Tempo Engineering Playbook

Every agent and engineer reads this file before writing code. Role prompts live in `.claude/agents/*.md`.

## 1. Global invariants (all agents)

1. **Source of truth:** `docs/00-prd.md`. Section 8 (Amendments) overrides earlier sections. Do not invent features, SaaS dependencies, or schema fields beyond it.
2. **400-line ceiling:** every `.ts`/`.tsx` file stays under 400 lines (target 100–250). ESLint `max-lines` enforces it. Split by domain early.
3. **Dual-stream separation (critical):**
   - **Stream A — tracked time (`time_entries`):** yesterday's hours, project, ticket refs, PTO (`work | vacation | sick | holiday`). Feeds rollups, day-equivalents, client caps.
   - **Stream B — standup context (`daily_checkins`):** `planned_today`, `blockers`. Shown in Slack and the Standup Drawer. **Never** counted in hours, days, or caps.
4. **Type safety end to end:** Drizzle schema → Zod (`src/contracts`) → services/actions → UI. No `any`.
5. **Shared contracts:** cross-agent types and Zod schemas live in `src/contracts/**` (Orchestrator-owned). Import from there; never redefine an enum or a shared shape locally. Need a change? Report it; the Orchestrator edits contracts.
6. **Dependencies:** only the Orchestrator edits `package.json` / lockfile. Need a package? Say which and why in your report.
7. **Scope isolation:** only create or modify files in your ownership paths (section 2). Anything else → report it, do not edit it.
8. **Verify before reporting done:** run `npm run check` (lint + typecheck + tests). Report exact file paths with line counts (`wc -l`), assumptions, and anything not verified.
9. **No secrets** in code, tests, logs, or commits. Use env vars listed in `.env.example`.

## 2. Ownership map

| Role | Owns (exclusive) |
| :--- | :--- |
| **0. Orchestrator** (main session) | `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `package.json`, `package-lock.json`, `*.config.*`, `components.json`, `.env.example`, `.gitignore`, `docs/00-prd.md`, `docs/01-architecture.md`, `src/contracts/**`, `src/lib/utils.ts`, `src/lib/env.ts`, `src/i18n/**` |
| **1. Designer** | `docs/05-design-system.md`, `src/app/globals.css`, `src/styles/**` |
| **2. Backend** | `docs/02-database-schema.md`, `docs/04-deployment-runbook.md`, `src/server/db/**`, `src/server/services/**`, `src/app/api/cron/**` (except `morning-ping`), `src/app/api/export/**`, `scripts/**`, `drizzle/**`, `supabase/**` |
| **3. Slack & Auth** | `docs/03-slack-app-manifest.yaml`, `src/server/slack/**`, `src/server/auth/**`, `src/app/api/slack/**`, `src/app/api/cron/morning-ping/**`, `src/app/auth/**`, `src/proxy.ts` |
| **4. Frontend** | `messages/**` (web copy, en + uk), `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/(auth)/**`, `src/app/(dashboard)/**`, `src/components/**`, `src/hooks/**` |
| **5. QA** | `tests/**`, `.github/workflows/**` |

Unit tests next to the code (`src/**/*.test.ts`) belong to the owner of that code. `tests/**` is for cross-cutting, parity, and E2E tests.

**Layer rules:** UI never imports `src/server/db/**` directly; it calls server actions/services. Slack handlers write through `src/server/services/**`, not raw queries. Services never import from `src/components/**` or `src/server/slack/**`.

## 3. Workflow

- One task = one branch (`wave<N>/<role>-<topic>`) = one PR into `main`.
- Parallel agents work in separate git worktrees. In a fresh worktree run `npm ci` first and copy `.env.local` if needed.
- CI must pass (`lint`, `typecheck`, `test`). The Orchestrator reviews every PR for contract mismatches, boundary violations, Stream B leaks, and file sizes, then merges.
- Commit messages: imperative, scoped (`backend: add rollup service`).

## 4. Waves

| Wave | Work | Gate |
| :--- | :--- | :--- |
| 0 | Orchestrator: scaffold, configs, CI, contracts, agent files | `npm run check` green |
| 1a | Backend: Drizzle schema, migrations, RLS, `docs/02` | Human schema review |
| 1b | Designer: tokens + `docs/05`. Backend: rollup + standup services. Slack: manifest + Slack OIDC. QA: parity + isolation tests | CI green, parity test passes |
| 2 | Slack: modals, `/log`, `/pto`, App Home, morning ping. Frontend: `/my-time`, `/team`, drawer, `/admin`. Backend: exports + legacy import | CI green |
| 3 | QA: RBAC, idempotency, E2E, line-count & security audit | Release checklist |

## 5. Edge cases every agent must consider

Weekends; company holidays; active PTO days; previous business day (Mon → Fri); user timezones (default `Europe/Kyiv`); months starting mid-week (month-weeks, amendment A2); client cap thresholds (neutral < 85%, amber 85–99%, coral ≥ 100%); Slack 3-second ack and retries (`slack_submissions`, amendment A1); decimal hours (`2.5`); custom `daily_norm_hours`.
