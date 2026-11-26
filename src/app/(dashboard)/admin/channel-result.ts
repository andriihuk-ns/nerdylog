import type { JoinSlackChannelResult } from "@/contracts";
import type { ActionResult } from "../action-result";

type JoinFailure = Extract<JoinSlackChannelResult, { ok: false }>;

/** A failed channel save: shown inline under the picker, not as a form-level error. */
export interface ChannelFailure {
  ok: false;
  field: "slackChannelId";
  message: string;
  reason?: JoinFailure["reason"];
}

export type ChannelActionResult<T> = ActionResult<T> | ChannelFailure;

export function channelFailure(message: string, reason?: JoinFailure["reason"]): ChannelFailure {
  return reason ? { ok: false, field: "slackChannelId", message, reason } : { ok: false, field: "slackChannelId", message };
}

/** Join result → null when the bot is in the channel, else an inline failure. */
export function fromJoinResult(result: JoinSlackChannelResult): ChannelFailure | null {
  return result.ok ? null : channelFailure(result.message, result.reason);
}

/** Service InvalidInputError on `slackChannelId` → inline field failure; anything else → null. Matched by name. */
export function channelFieldError(err: unknown): ChannelFailure | null {
  if (!(err instanceof Error) || err.name !== "InvalidInputError") return null;
  const fieldErrors = (err as Error & { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors;
  const message = fieldErrors?.slackChannelId?.[0];
  return message ? channelFailure(message) : null;
}
