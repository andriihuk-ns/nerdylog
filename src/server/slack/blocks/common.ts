import { PROVIDER_NAMES, segmentTextWithLinks, type Locale } from "@/contracts";
import { t } from "../i18n";
import { CALLBACK } from "../ids";
import type { ModalView, SlackBlock } from "../types";

type PlainTextElement = ModalView["title"];

/** Small Block Kit helpers. Pure functions; no Slack calls. */

/** A channel or DM message: notification / fallback text plus Block Kit blocks. */
export interface SlackMessage {
  text: string;
  blocks: SlackBlock[];
}

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

/**
 * A17: user text for a SHARED channel post. Plain parts are mrkdwn-escaped; URLs become
 * `<url|Provider · label>` (label parsed from the URL, no network) so Slack can unfurl them.
 */
export function linkifyMrkdwn(text: string): string {
  return segmentTextWithLinks(text)
    .map((segment) => {
      if (segment.type === "text") return escapeMrkdwn(segment.text);
      const { url, provider, label } = segment.link;
      const href = escapeMrkdwn(url).replace(/\|/g, "%7C");
      const name = escapeMrkdwn(`${PROVIDER_NAMES[provider]} · ${label}`).replace(/\|/g, "/");
      return `<${href}|${name}>`;
    })
    .join("");
}

/** Slack caps modal titles at 24 characters. */
function title(text: string): PlainTextElement {
  return plain(text.slice(0, 24));
}

/**
 * Placeholder opened instantly with the trigger_id, then replaced via views.update.
 * A14: the user (and so their locale) is not resolved yet inside the 3 s window, so this
 * view is language-neutral: brand title, an hourglass, and a "✕" close button.
 */
export function loadingModal(): ModalView {
  return {
    type: "modal",
    callback_id: CALLBACK.loading,
    title: title("nerdylog"),
    close: plain("✕"),
    blocks: [mrkdwnSection(":hourglass_flowing_sand:")],
  };
}

/** Read-only modal for "not set up" and error states. */
export function noticeModal(heading: string, message: string, locale: Locale): ModalView {
  return {
    type: "modal",
    callback_id: CALLBACK.notice,
    title: title(heading),
    close: plain(t(locale, "common.close")),
    blocks: [mrkdwnSection(message)],
  };
}

/** Shown to Slack users without a Tempo account; they have no locale, so callers pass DEFAULT_LOCALE (uk). */
export function notLinkedMessage(appBaseUrl: string, locale: Locale): string {
  return t(locale, "common.notLinked", { url: appBaseUrl });
}

export { title as modalTitle };
