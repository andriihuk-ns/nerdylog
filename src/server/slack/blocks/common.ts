import { CALLBACK } from "../ids";
import type { ModalView, SlackBlock } from "../types";

type PlainTextElement = ModalView["title"];

/** Small Block Kit helpers. Pure functions; no Slack calls. */

export function plain(text: string): PlainTextElement {
  return { type: "plain_text", text, emoji: true };
}

export function mrkdwnSection(text: string, blockId?: string): SlackBlock {
  return { type: "section", text: { type: "mrkdwn", text }, ...(blockId ? { block_id: blockId } : {}) };
}

export function header(text: string): SlackBlock {
  return { type: "header", text: plain(text) };
}

export function context(text: string): SlackBlock {
  return { type: "context", elements: [{ type: "mrkdwn", text }] };
}

export function divider(): SlackBlock {
  return { type: "divider" };
}

/** Escape user text for mrkdwn (Slack only requires &, <, >). */
export function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Slack caps modal titles at 24 characters. */
function title(text: string): PlainTextElement {
  return plain(text.slice(0, 24));
}

/** Placeholder opened instantly with the trigger_id, then replaced via views.update. */
export function loadingModal(heading: string): ModalView {
  return {
    type: "modal",
    callback_id: CALLBACK.loading,
    title: title(heading),
    close: plain("Cancel"),
    blocks: [mrkdwnSection("Loading…")],
  };
}

/** Read-only modal for "not set up" and error states. */
export function noticeModal(heading: string, message: string): ModalView {
  return {
    type: "modal",
    callback_id: CALLBACK.notice,
    title: title(heading),
    close: plain("Close"),
    blocks: [mrkdwnSection(message)],
  };
}

export function notLinkedMessage(appBaseUrl: string): string {
  return `You are not set up in nerdylog yet. Sign in once at <${appBaseUrl}|nerdylog> or ask an admin to sync the team from Slack.`;
}

export { title as modalTitle };
