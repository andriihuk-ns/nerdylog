import type { DirectoryUser, TeamView } from "@/contracts";
import type { SlackSyncResult } from "@/app/(dashboard)/admin/sync-result";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const byHandle = (a: TeamView, b: TeamView) => a.handle.localeCompare(b.handle);

/** Active teams first list; archived (disabled or gone in Slack) separately. Both by handle. */
export function splitTeams(teams: TeamView[]): { active: TeamView[]; archived: TeamView[] } {
  return {
    active: teams.filter((t) => t.isActive).sort(byHandle),
    archived: teams.filter((t) => !t.isActive).sort(byHandle),
  };
}

/** userId → handles of the user's active teams, sorted (Directory chips). */
export function teamHandlesByUser(teams: TeamView[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const team of [...teams].filter((t) => t.isActive).sort(byHandle)) {
    for (const userId of team.memberIds) {
      const list = map.get(userId);
      if (list) list.push(team.handle);
      else map.set(userId, [team.handle]);
    }
  }
  return map;
}

/** Team member ids → directory users (unknown ids skipped), active people first, then by name. */
export function resolveMembers(memberIds: string[], users: DirectoryUser[]): DirectoryUser[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  return memberIds
    .map((id) => byId.get(id))
    .filter((u): u is DirectoryUser => u !== undefined)
    .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.fullName.localeCompare(b.fullName));
}

/** channelId → `@handle` of the team already using it (one channel per team). */
export function takenTeamChannels(teams: Pick<TeamView, "id" | "handle" | "slackChannelId">[], exceptTeamId?: string): Map<string, string> {
  const taken = new Map<string, string>();
  for (const t of teams) {
    if (t.slackChannelId && t.id !== exceptTeamId) taken.set(t.slackChannelId, `@${t.handle}`);
  }
  return taken;
}

/** Toast copy: "Synced from Slack: 12 people (2 new) · 4 teams (1 archived)." */
export function syncSummary({ people, teams }: SlackSyncResult): string {
  const total = people.created + people.updated;
  const peoplePart = `${total} ${total === 1 ? "person" : "people"}${people.created ? ` (${people.created} new)` : ""}`;
  if (!teams) return `Synced from Slack: ${peoplePart}.`;
  const teamTotal = teams.created + teams.updated;
  const teamPart = `${plural(teamTotal, "team")}${teams.archived ? ` (${teams.archived} archived)` : ""}`;
  return `Synced from Slack: ${peoplePart} · ${teamPart}.`;
}
