import type { SlackSubmissionInput } from "@/contracts";
import { buildStandupCard } from "../blocks/standup-card";
import type { SlackActorProfile, SlackDeps } from "../types";

/**
 * FR-SLACK-03 channel card for a standup submission. Returns the message ts.
 * Contract request: a service to store `daily_checkins.channel_message_ts`; until then
 * the ts is only returned (and logged by nobody).
 */
export async function broadcastStandup(
  deps: SlackDeps,
  profile: SlackActorProfile,
  input: SlackSubmissionInput,
): Promise<string | null> {
  if (!deps.standupChannelId || input.kind !== "standup" || !input.checkin) return null;
  const projects = await deps.tempo.listProjects(profile);
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const card = buildStandupCard({
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    yesterday: input.entries
      .filter((e) => e.entryType === "work")
      .map((e) => ({
        hours: e.hours,
        projectName: (e.projectId && names.get(e.projectId)) || "Project",
        taskSummary: e.taskSummary,
      })),
    plannedToday: input.checkin.plannedToday,
    blockers: input.checkin.blockers,
  });
  return deps.slack.postMessage(deps.standupChannelId, card.text, card.blocks);
}

/**
 * Deferred half of a view_submission (runs inside `after()`): write through the standup
 * service in one transaction (A1), then broadcast. A duplicate view id (Slack retry) is a no-op.
 */
export async function processSubmission(
  deps: SlackDeps,
  profile: SlackActorProfile,
  input: SlackSubmissionInput,
): Promise<void> {
  try {
    const result = await deps.tempo.submit(input);
    if (result.status === "duplicate") return;
  } catch (error) {
    // The modal already closed, so tell the user in a DM instead of failing silently.
    console.error("slack: submission failed", input.kind, error instanceof Error ? error.message : error);
    await notify(deps, profile, "Tempo could not save your last submission. Please try again or use the web panel.");
    return;
  }
  try {
    await broadcastStandup(deps, profile, input);
  } catch (error) {
    console.error("slack: standup broadcast failed", error instanceof Error ? error.message : error);
  }
}

async function notify(deps: SlackDeps, profile: SlackActorProfile, text: string): Promise<void> {
  try {
    const channel = await deps.slack.openDm(profile.slackUserId);
    await deps.slack.postMessage(channel, text, []);
  } catch (error) {
    console.error("slack: failure DM failed", error instanceof Error ? error.message : error);
  }
}
