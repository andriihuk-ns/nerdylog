import "server-only";
import type { WebClient } from "@slack/web-api";
import { getSlackClient } from "./client";
import type { SlackApi } from "./types";

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
    async postMessage(channel, text, blocks) {
      const res = await client.chat.postMessage({ channel, text, ...(blocks.length > 0 ? { blocks } : {}) });
      return res.ts ?? null;
    },
    async openDm(slackUserId) {
      const res = await client.conversations.open({ users: slackUserId });
      if (!res.channel?.id) throw new Error("conversations.open returned no channel");
      return res.channel.id;
    },
  };
}
