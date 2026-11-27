import "server-only";
import { getTranslations } from "next-intl/server";
import type { ProjectView } from "@/contracts";
import type { ProjectOption } from "@/components/my-time/week-matrix";
import { loadChannelNames } from "../channel-names";

/** Who the hint addresses: the signed-in user ("Ask {creator}…") or a person an admin edits. */
export type AccessAudience = { kind: "self" } | { kind: "other"; name: string };

/**
 * A15: everyone sees all active projects; non-members get a disabled option with the hint
 * "Ask {creator} to add you to #channel" (or "{name} isn't in #channel" on the people page).
 */
export async function projectOptions(
  projects: ProjectView[],
  isMember: (p: ProjectView) => boolean,
  audience: AccessAudience,
): Promise<ProjectOption[]> {
  const active = projects.filter((p) => p.isActive);
  const outsiders = active.filter((p) => !isMember(p));
  const names = await loadChannelNames(outsiders.flatMap((p) => (p.slackChannelId ? [p.slackChannelId] : [])));
  const hint = await accessHint(audience, names);
  return active.map((p) => ({ id: p.id, name: p.name, disabledReason: isMember(p) ? null : hint(p) }));
}

/** Copy for one non-member project; `names` maps channel id → name (may be empty). */
export async function accessHint(audience: AccessAudience, names: Map<string, string>): Promise<(p: ProjectView) => string> {
  const t = await getTranslations("myTime.access");
  return (p) => {
    const name = p.slackChannelId ? names.get(p.slackChannelId) : undefined;
    const channel = name ? `#${name}` : t("projectChannel");
    return audience.kind === "self"
      ? t("askToJoin", { creator: p.createdBy?.fullName ?? t("anAdmin"), channel })
      : t("notInChannel", { name: audience.name, channel });
  };
}
