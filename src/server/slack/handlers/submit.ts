import type { SlackSubmissionInput } from "@/contracts";
import { InvalidInputError } from "@/server/services/errors";
import { buildProjectLinesMessage, groupProjectLines } from "../blocks/project-lines";
import { buildStandupCard } from "../blocks/standup-card";
import { localeOf, t } from "../i18n";
import type { SlackActorProfile, SlackDeps } from "../types";
import { notMemberMessage } from "./project-access";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNotMemberError(error: unknown): boolean {
  return error instanceof InvalidInputError && (error.fieldErrors.projectId ?? []).includes("not_member");
}

/**
 * A14: project-lines and standup-card posts go to SHARED channels and stay English on purpose.
 * A17: both are posted with unfurls on, so linked Jira / Figma / Asana / Drive items preview.
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
        await deps.slack.postMessage(c.slackChannelId, msg.text, msg.blocks, { unfurl: true });
      } catch (error) {
        console.error("slack: project post failed", c.slackChannelId, errorMessage(error));
      }
    });
  await Promise.all(posts);
}

/**
 * FR-SLACK-03 / A11 / A15: the full standup card goes to the general standup channel (teams were
 * removed). No channel configured → no card. The post's ts is stored on daily_checkins.
 */
export async function broadcastStandup(
  deps: SlackDeps,
  profile: SlackActorProfile,
  input: SlackSubmissionInput,
): Promise<string | null> {
  if (input.kind !== "standup" || !input.checkin) return null;
  const channel = await deps.tempo.getStandupChannelId();
  if (!channel) return null;
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
  let ts: string | null;
  try {
    ts = await deps.slack.postMessage(channel, card.text, card.blocks, { unfurl: true });
  } catch (error) {
    console.error("slack: standup post failed", channel, errorMessage(error));
    return null;
  }
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
    await notify(deps, profile, await failureText(deps, profile, input, error));
    return;
  }
  await routeSubmission(deps, profile, input);
}

/**
 * A15: the service rejects work on a project the user is not a member of (InvalidInputError
 * fieldErrors.projectId "not_member"). The synchronous pre-check normally catches this; if
 * membership changed in between, the DM names the creator and channel instead of a generic error.
 */
async function failureText(
  deps: SlackDeps,
  profile: SlackActorProfile,
  input: SlackSubmissionInput,
  error: unknown,
): Promise<string> {
  const locale = localeOf(profile);
  if (!isNotMemberError(error)) return t(locale, "common.saveFailedDm");
  try {
    const projects = await deps.tempo.listProjects(profile);
    const ids = new Set(input.entries.map((e) => e.projectId).filter(Boolean));
    const blocked = projects.find((p) => ids.has(p.id) && !p.isMember);
    if (blocked) return t(locale, "err.notMemberDm", { project: blocked.name, hint: await notMemberMessage(deps, blocked, locale) });
  } catch (lookupError) {
    console.error("slack: not_member lookup failed", errorMessage(lookupError));
  }
  return t(locale, "err.notMemberGeneric");
}

async function notify(deps: SlackDeps, profile: SlackActorProfile, text: string): Promise<void> {
  try {
    const channel = await deps.slack.openDm(profile.slackUserId);
    await deps.slack.postMessage(channel, text, []);
  } catch (error) {
    console.error("slack: failure DM failed", error instanceof Error ? error.message : error);
  }
}
