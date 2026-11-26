/** A13: "Sync from Slack" result: people always; teams when the user-group step succeeded. */
export interface TeamSyncCounts {
  created: number;
  updated: number;
  archived: number;
  skippedMembers: number;
}

export interface SlackSyncResult {
  people: { created: number; updated: number };
  teams: TeamSyncCounts | null;
  /** Set when the team step failed; the people result still stands. Key under `admin.directory.teamsError`. */
  teamsError: TeamsErrorCode | null;
}

export type TeamsErrorCode = "missingScope" | "failed";

/** @slack/web-api platform error `missing_scope` (in `data.error` or, when wrapped, in the message). */
export function isMissingScopeError(err: unknown): boolean {
  const data = (err as { data?: { error?: unknown } } | null)?.data;
  if (data && data.error === "missing_scope") return true;
  return err instanceof Error && err.message.includes("missing_scope");
}

/** Team-step failure → message code for the toast. Missing scope names the exact fix. */
export function teamsErrorCode(err: unknown): TeamsErrorCode {
  return isMissingScopeError(err) ? "missingScope" : "failed";
}
