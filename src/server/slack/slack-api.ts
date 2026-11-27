import "server-only";
import type { WebClient } from "@slack/web-api";
import { getSlackClient } from "./client";
import type { SlackApi } from "./types";

/** Budget for the channel-name lookup inside a view_submission (Slack wants the reply within 3 s). */
const CHANNEL_NAME_TIMEOUT_MS = 800;

/** Production SlackApi over @slack/web-api. The Web API client throws on `ok: false`. */
export function createSlackApi(client: WebClient = getSlackClient()): SlackApi {
  return {
    async openView(triggerId, view) {
      const res = await client.views.open({ trigger_id: triggerId, view });
      if (!res.view?.id) throw new Error("views.open returned no view id");
      return res.view.id;
    },
    async updateView(viewId, view, hash) {
      await client.views.update({ view_id: viewId, view, ...(hash ? { hash } : {}) });
    },
    async publishHome(slackUserId, view) {
      await client.views.publish({ user_id: slackUserId, view });
    },
    async postMessage(channel, text, blocks, options) {
      const res = await client.chat.postMessage({
        channel,
        text,
        ...(blocks.length > 0 ? { blocks } : {}),
        ...(options?.unfurl ? { unfurl_links: true, unfurl_media: true } : {}),
      });
      return res.ts ?? null;
    },
    async postEphemeral(channel, slackUserId, text) {
      await client.chat.postEphemeral({ channel, user: slackUserId, text });
    },
    async openDm(slackUserId) {
      const res = await client.conversations.open({ users: slackUserId });
      if (!res.channel?.id) throw new Error("conversations.open returned no channel");
      return res.channel.id;
    },
    async channelName(channelId) {
      const lookup = client.conversations
        .info({ channel: channelId })
        .then((res) => res.channel?.name ?? null)
        .catch(() => null);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), CHANNEL_NAME_TIMEOUT_MS);
      });
      try {
        return await Promise.race([lookup, timeout]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
