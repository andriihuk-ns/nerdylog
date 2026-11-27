import "server-only";
import type { ProjectView } from "@/contracts";
import { replaceProjectMembers } from "@/server/services/project-service";
import { fetchChannelMemberSlackIds } from "@/server/slack/channels";
import type { MemberRefresh, ProjectsRefresh } from "./sync-result";

/**
 * A15: project members = Tempo users in the project's Slack channel. Callers check admin first
 * (ReplaceProjectMembers is a system call).
 */
export async function refreshMembers(projectId: string, channelId: string): Promise<MemberRefresh> {
  const slackIds: string[] = await fetchChannelMemberSlackIds(channelId);
  // [] = bot not in the channel (not_in_channel / channel_not_found): never empty the project.
  if (slackIds.length === 0) return { status: "needsInvite" };
  const counts = await replaceProjectMembers(projectId, slackIds);
  return { status: "ok", ...counts };
}

/** "Sync from Slack": every project with a channel, one at a time (Slack rate limits). Failures and needs-invite are counted, not thrown. */
export async function refreshAllMembers(projects: ProjectView[]): Promise<ProjectsRefresh> {
  const result: ProjectsRefresh = { refreshed: 0, failed: 0, needsInvite: 0, members: 0 };
  for (const p of projects) {
    if (!p.slackChannelId) continue;
    try {
      const outcome = await refreshMembers(p.id, p.slackChannelId);
      if (outcome.status === "needsInvite") {
        result.needsInvite += 1;
        continue;
      }
      result.refreshed += 1;
      result.members += outcome.members;
    } catch (err) {
      result.failed += 1;
      console.warn("project member refresh failed", p.id, err instanceof Error ? err.message : err);
    }
  }
  return result;
}
