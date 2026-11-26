import type { JoinSlackChannelResult, ProjectView, SlackChannelOption } from "@/contracts";

type JoinFailureReason = Extract<JoinSlackChannelResult, { ok: false }>["reason"];

/** channelId → name of the project already linked to it (A11: one channel = one project). */
export function takenChannelMap(
  projects: Pick<ProjectView, "id" | "name" | "slackChannelId">[],
  exceptProjectId?: string,
): Map<string, string> {
  const taken = new Map<string, string>();
  for (const p of projects) {
    if (p.slackChannelId && p.id !== exceptProjectId) taken.set(p.slackChannelId, p.name);
  }
  return taken;
}

/** Case-insensitive name search; a leading `#` is ignored; prefix matches sort first. */
export function filterChannels(channels: SlackChannelOption[], query: string): SlackChannelOption[] {
  const q = query.trim().replace(/^#/, "").toLowerCase();
  if (!q) return channels;
  const prefix: SlackChannelOption[] = [];
  const inner: SlackChannelOption[] = [];
  for (const c of channels) {
    const name = c.name.toLowerCase();
    if (name.startsWith(q)) prefix.push(c);
    else if (name.includes(q)) inner.push(c);
  }
  return [...prefix, ...inner];
}

export function findChannel(channels: SlackChannelOption[] | null, id: string | null): SlackChannelOption | undefined {
  if (!channels || !id) return undefined;
  return channels.find((c) => c.id === id);
}

/** `#name` when the channel is visible to the bot, else the raw id so the admin can still see it. */
export function channelLabel(channels: SlackChannelOption[] | null, id: string): string {
  const c = findChannel(channels, id);
  return c ? `#${c.name}` : id;
}

export type ChannelErrorCopy =
  | { kind: "privateInvite"; channel: string | undefined }
  | { kind: "notFound" }
  | { kind: "message"; message: string };

/**
 * Which copy a failed channel save shows inline. The private-channel case names the exact fix;
 * other messages already come translated from the action (A14) and pass through.
 */
export function channelErrorCopy(
  failure: { message: string; reason?: JoinFailureReason },
  channelName: string | undefined,
): ChannelErrorCopy {
  if (failure.reason === "private_needs_invite") return { kind: "privateInvite", channel: channelName };
  if (failure.reason === "not_found") return { kind: "notFound" };
  return { kind: "message", message: failure.message };
}
