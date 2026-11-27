import "server-only";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { JoinSlackChannelResult } from "@/contracts";
import { SLACK_CHANNEL_ID_PATTERN } from "@/server/services/validation";
import { joinSlackChannel } from "@/server/slack/channels";
import { channelFailure, fromJoinResult, type ChannelFailure } from "./channel-result";

export const channelIdSchema = z.string().regex(SLACK_CHANNEL_ID_PATTERN).nullable();

/** A14: action copy in the request locale (`admin.server.*`). */
export const serverCopy = () => getTranslations("admin.server");

/** A11: make sure the bot is in the channel before saving it. Slack not configured → inline error. */
export async function ensureBotInChannel(channelId: string): Promise<ChannelFailure | null> {
  let result: JoinSlackChannelResult;
  try {
    result = await joinSlackChannel(channelId);
  } catch {
    return channelFailure((await getTranslations("admin.channel"))("connect"), "error");
  }
  return fromJoinResult(result);
}
