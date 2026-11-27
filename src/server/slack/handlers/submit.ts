import type { SlackSubmissionInput } from "@/contracts";
import { InvalidInputError } from "@/server/services/errors";
import { buildProjectLinesMessage, groupProjectLines } from "../blocks/project-lines";
import { buildStandupCard } from "../blocks/standup-card";
import { formatHours } from "../dates";
import { localeOf, t } from "../i18n";
import { sendDm, showOnlyTo } from "../private-delivery";
import type { SlackActorProfile, SlackDeps } from "../types";
import { notMemberMessage } from "./project-access";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNotMemberError(error: unknown): boolean {
  return error instanceof InvalidInputError && (error.fieldErrors.projectId ?? []).includes("not_member");
}

/**
 * A31: the submitter's own work lines are never posted publicly. Each project channel shows that
 * project's lines only to the submitter, and the bot DM gets one "Logged Xh" copy of all of them.
 * One failing delivery never blocks the others.
 */
export async function sendLoggedLines(
  deps: SlackDeps,
  profile: SlackActorProfile,
  input: SlackSubmissionInput,
): Promise<void> {
  const work = input.entries.filter((e) => e.entryType === "work" && e.projectId);
  if (work.length === 0) return;
  const locale = localeOf(profile);
  const projects = await deps.tempo.listProjects(profile);
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const header = (entries: typeof work) =>
    t(locale, "common.loggedHeader", { hours: formatHours(entries.reduce((sum, e) => sum + e.hours, 0), locale) });
  const byProject = [...new Set(work.map((e) => e.projectId!))].map((projectId) => {
    const entries = work.filter((e) => e.projectId === projectId);
    const lines = groupProjectLines(names.get(projectId) ?? "Project", entries).get(projectId)!;
    return { projectId, entries, lines };
  });
  const channels = new Map((await deps.tempo.listProjectChannels()).map((c) => [c.projectId, c.slackChannelId]));
  const ephemerals = byProject.map(async ({ projectId, entries, lines }) => {
    const channel = channels.get(projectId);
    if (channel) await showOnlyTo(deps, channel, profile.slackUserId, buildProjectLinesMessage([header(entries), ...lines]));
  });
  const dm = buildProjectLinesMessage([header(work), ...byProject.flatMap((p) => p.lines)]);
  await Promise.all([
    ...ephemerals,
    sendDm(deps, profile.slackUserId, dm, { unfurl: true }).catch((error) => {
      console.error("slack: logged DM failed", errorMessage(error));
    }),
  ]);
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
  const { checkin } = input;
  if (input.kind !== "standup") return null;
  if (!checkin && !input.entries.some((e) => e.entryType === "work")) return null;
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
    plannedToday: checkin?.plannedToday,
    blockers: checkin?.blockers,
  });
  let ts: string | null;
  try {
    ts = await deps.slack.postMessage(channel, card.text, card.blocks, { unfurl: true });
  } catch (error) {
    console.error("slack: standup post failed", channel, errorMessage(error));
    return null;
  }
  if (ts && checkin) await deps.tempo.setCheckinChannelTs(checkin.userId, checkin.checkinDate, ts);
  return ts;
}

/** All messages for a saved submission; each branch fails on its own. */
export async function routeSubmission(
  deps: SlackDeps,
  profile: SlackActorProfile,
  input: SlackSubmissionInput,
): Promise<void> {
  await Promise.all([
    sendLoggedLines(deps, profile, input).catch((error) => {
      console.error("slack: logged lines failed", errorMessage(error));
    }),
    broadcastStandup(deps, profile, input).catch((error) => {
      console.error("slack: standup broadcast failed", errorMessage(error));
    }),
  ]);
}

/**
 * Deferred half of a view_submission (runs inside `after()`): write through the standup
 * service in one transaction (A1), then send the messages (A11/A31). A duplicate view id (Slack retry) is a no-op.
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
