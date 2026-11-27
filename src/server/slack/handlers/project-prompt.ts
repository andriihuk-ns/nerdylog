import type { IsoDate, ProjectView } from "@/contracts";
import { buildProjectPrompt } from "../blocks/project-prompt";
import { sendDm, showOnlyTo } from "../private-delivery";
import type { SlackActorProfile, SlackDeps } from "../types";
import { openModalFast } from "./modal-loader";
import { promptDenial } from "./project-access";

export interface ProjectPromptResult {
  claimed: number;
  posted: number;
  failed: number;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A16/A31 cron: `claimProjectPrompts` returns only projects newly claimed for their office-local day
 * (project_prompts dedup). Each member gets the prompt in the project channel visible only to them,
 * plus a copy in the bot DM; nothing is posted publicly. A project counts as failed when it has no
 * recipient or a DM could not be delivered (not retried until the schedule changes).
 */
export async function runProjectPrompts(deps: Pick<SlackDeps, "slack" | "tempo" | "now">): Promise<ProjectPromptResult> {
  const targets = await deps.tempo.claimProjectPrompts(deps.now());
  const delivered = await Promise.all(
    targets.map(async (target) => {
      const message = buildProjectPrompt(target);
      const results = await Promise.allSettled(
        target.memberSlackIds.map(async (slackUserId) => {
          await showOnlyTo(deps, target.slackChannelId, slackUserId, message);
          await sendDm(deps, slackUserId, message);
        }),
      );
      for (const r of results) {
        if (r.status === "rejected") {
          console.error("cron/morning-ping: project prompt failed", target.slackChannelId, errorMessage(r.reason));
        }
      }
      if (results.length === 0) console.error("cron/morning-ping: project prompt has no members", target.slackChannelId);
      return results.length > 0 && results.every((r) => r.status === "fulfilled");
    }),
  );
  const posted = delivered.filter(Boolean).length;
  return { claimed: targets.length, posted, failed: targets.length - posted };
}

/**
 * Budget for the membership pre-check. Slack wants the ack (and views.open) within 3 s of the
 * click, so a slow lookup falls back to the loading modal, which then shows the same denial.
 */
export const PRECHECK_BUDGET_MS = 1500;

type Precheck = { profile: SlackActorProfile | null; project: ProjectView | undefined };

async function precheck(deps: SlackDeps, slackUserId: string, projectId: string): Promise<Precheck | null> {
  const lookup = (async (): Promise<Precheck> => {
    const profile = await deps.tempo.resolveUser(slackUserId);
    if (!profile) return { profile, project: undefined };
    const projects = await deps.tempo.listProjects(profile);
    return { profile, project: projects.find((p) => p.id === projectId) };
  })().catch((error: unknown) => {
    console.error("slack: prompt pre-check failed", errorMessage(error));
    return null;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), PRECHECK_BUDGET_MS);
  });
  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export interface PromptClick {
  slackUserId: string;
  triggerId: string;
  channelId: string | null;
  projectId: string;
  logDate: IsoDate;
}

/**
 * A16 "Log time & status" click. Members get the standup modal with the project preselected in
 * row 1 and the prompt's log date (in their own locale). Non-members and unknown users get an
 * ephemeral reply in the channel instead. If the pre-check is slow, the modal opens anyway and
 * the deferred fill shows the denial inside it.
 */
export async function handlePromptClick(deps: SlackDeps, click: PromptClick): Promise<void> {
  const checked = await precheck(deps, click.slackUserId, click.projectId);
  const denial = checked ? promptDenial(checked.profile, checked.project, deps.appBaseUrl) : null;
  if (denial) {
    const channel = click.channelId;
    if (!channel) {
      console.error("slack: prompt denial without a channel id");
      return;
    }
    deps.defer(async () => {
      try {
        await deps.slack.postEphemeral(channel, click.slackUserId, denial.text);
      } catch (error) {
        console.error("slack: prompt ephemeral failed", errorMessage(error));
      }
    });
    return;
  }
  await openModalFast(deps, {
    kind: "standup",
    slackUserId: click.slackUserId,
    triggerId: click.triggerId,
    logDate: click.logDate,
    projectId: click.projectId,
  });
}
