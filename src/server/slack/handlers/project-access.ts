import type { Locale, ProjectView } from "@/contracts";
import { t } from "../i18n";
import { rowBlock } from "../ids";
import { optionValue, type FieldErrors, type ViewStateValues } from "../parse/state";
import type { SlackActorProfile, SlackDeps } from "../types";

/** A15: Slack modals list only active projects whose channel the user is in. */
export function selectableProjects(projects: ProjectView[]): ProjectView[] {
  return projects.filter((p) => p.isActive && p.isMember);
}

/**
 * "You're not in #channel. Ask {creator} to add you." Channel name comes from Slack (short
 * timeout); a missing name falls back to a neutral phrase, a missing creator to "an admin".
 */
export async function notMemberMessage(
  deps: Pick<SlackDeps, "slack">,
  project: ProjectView,
  locale: Locale,
): Promise<string> {
  const name = project.slackChannelId ? await deps.slack.channelName(project.slackChannelId) : null;
  const channel = name ? `#${name}` : t(locale, "err.projectChannel", { project: project.name });
  const creator = project.createdBy?.fullName || t(locale, "err.anAdmin");
  return t(locale, "err.notMember", { channel, creator });
}

/**
 * Synchronous A15 access check for a time / standup submission (field errors must be returned
 * in the view_submission response). Rows whose project the user is not a member of get a
 * localized error on their project select. Returns null when every picked project is allowed.
 */
export async function projectAccessErrors(
  deps: Pick<SlackDeps, "slack" | "tempo">,
  profile: SlackActorProfile,
  values: ViewStateValues,
  rows: number,
  locale: Locale,
): Promise<FieldErrors | null> {
  const picked: Array<{ n: number; projectId: string }> = [];
  for (let n = 1; n <= rows; n += 1) {
    const projectId = optionValue(values, rowBlock.project(n));
    if (projectId) picked.push({ n, projectId });
  }
  if (picked.length === 0) return null;
  const byId = new Map((await deps.tempo.listProjects(profile)).map((p) => [p.id, p]));
  const errors: FieldErrors = {};
  const messages = new Map<string, Promise<string>>();
  for (const { n, projectId } of picked) {
    const project = byId.get(projectId);
    if (!project) {
      errors[rowBlock.project(n)] = t(locale, "err.pickProject");
      continue;
    }
    if (project.isMember) continue;
    if (!messages.has(projectId)) messages.set(projectId, notMemberMessage(deps, project, locale));
    errors[rowBlock.project(n)] = await messages.get(projectId)!;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}
