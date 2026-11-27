/** A15 result shapes shared by the admin actions and the client toasts. */
export interface MemberCounts {
  members: number;
  skipped: number; // channel members unknown to nerdylog
}

/**
 * One project's refresh. `needsInvite`: Slack returned no members (bot not in the channel);
 * existing members were kept and the admin is told to invite @nerdylog.
 */
export type MemberRefresh = ({ status: "ok" } & MemberCounts) | { status: "needsInvite" };

export interface ProjectsRefresh {
  refreshed: number;
  failed: number;
  needsInvite: number;
  members: number;
}

/** "Sync from Slack": people always; then members of every project with a channel. */
export interface SlackSyncResult {
  people: { created: number; updated: number };
  projects: ProjectsRefresh;
}
