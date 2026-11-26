@AGENTS.md

## Orchestrator notes (main Claude Code session)

- The main session is the Orchestrator (role 0). Delegate role work to the subagents in `.claude/agents/` and give each one a single task with exact file paths and the contracts it must use.
- Parallel writers run with `isolation: "worktree"`. Never run two writers on overlapping paths.
- After each subagent report: check its diff, run `npm run check`, review against AGENTS.md section 3, then commit/merge.
- Commands: `npm run dev`, `npm run check`, `npm run db:generate`, `npm run db:migrate`, `supabase start` (needs Docker).
