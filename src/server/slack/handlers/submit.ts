import type { SlackSubmissionInput } from "@/contracts";
import { buildProjectLinesMessage, groupProjectLines } from "../blocks/project-lines";
import { buildStandupCard } from "../blocks/standup-card";
import { localeOf, t } from "../i18n";
import type { SlackActorProfile, SlackDeps } from "../types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A14: project-lines and standup-card posts go to SHARED channels and stay English on purpose.
 * Only the personal failure DM below uses the recipient's locale.
 *
 * A11 project channels: each project that has a channel gets one message with only that
 * project's work lines. Posts run independently; one failure never blocks the others.
 */
export async function postProjectLines(
  deps: SlackDeps,
  profile: SlackActorProfile,
  input: SlackSubmissionInput,
): Promise<void> {
  const grouped = groupProjectLines(profile.fullName, input.entries);
  if (grouped.size === 0) return;
  const channels = await deps.tempo.listProjectChannels();
  const posts = channels
    .filter((c) => grouped.has(c.projectId))
    .map(async (c) => {
      const msg = buildProjectLinesMessage(grouped.get(c.projectId)!);
      try {
        await deps.slack.postMessage(c.slackChannelId, msg.text, msg.blocks);
      } catch (error) {
        console.error("slack: project post failed", c.slackChannelId, errorMessage(error));
      }
    });
  await Promise.all(posts);
}

/**
 * FR-SLACK-03 / A11 / A13: the full standup card goes to every distinct channel of the member's
 * active teams (the service falls back to the general standup channel; empty → no card). Posts
 * fail independently; the FIRST successful post's ts is stored on daily_checkins.
 */
export async function broadcastStandup(
  deps: SlackDeps,
  profile: SlackActorProfile,
  input: SlackSubmissionInput,
): Promise<string | null> {
  if (input.kind !== "standup" || !input.checkin) return null;
  const channels = [...new Set(await deps.tempo.listStandupChannelsForUser(input.checkin.userId))];
  if (channels.length === 0) return null;
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
  // Posts run in parallel; results keep channel order, so "first" is the first listed channel that succeeded.
  const results = await Promise.all(
    channels.map(async (channel) => {
      try {
        return await deps.slack.postMessage(channel, card.text, card.blocks);
      } catch (error) {
        console.error("slack: standup post failed", channel, errorMessage(error));
        return null;
      }
    }),
  );
  const ts = results.find((t): t is string => Boolean(t)) ?? null;
  if (ts) await deps.tempo.setCheckinChannelTs(input.checkin.userId, input.checkin.checkinDate, ts);
  return ts;
}

/** All channel posts for a saved submission; each branch fails on its own. */
export async function routeSubmission(
  deps: SlackDeps,
  profile: SlackActorProfile,
  input: SlackSubmissionInput,
): Promise<void> {
  await Promise.all([
    postProjectLines(deps, profile, input).catch((error) => {
      console.error("slack: project routing failed", errorMessage(error));
    }),
    broadcastStandup(deps, profile, input).catch((error) => {
      console.error("slack: standup broadcast failed", errorMessage(error));
    }),
  ]);
}

/**
 * Deferred half of a view_submission (runs inside `after()`): write through the standup
 * service in one transaction (A1), then route channel posts (A11). A duplicate view id (Slack retry) is a no-op.
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
    await notify(deps, profile, t(localeOf(profile), "common.saveFailedDm"));
    return;
  }
  await routeSubmission(deps, profile, input);
}

async function notify(deps: SlackDeps, profile: SlackActorProfile, text: string): Promise<void> {
  try {
    const channel = await deps.slack.openDm(profile.slackUserId);
    await deps.slack.postMessage(channel, text, []);
  } catch (error) {
    console.error("slack: failure DM failed", error instanceof Error ? error.message : error);
  }
}
