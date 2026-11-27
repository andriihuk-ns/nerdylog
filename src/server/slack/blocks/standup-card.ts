import { checklistItemLinks, parseChecklist } from "@/contracts";
import { formatHours } from "../dates";
import type { SlackBlock } from "../types";
import { context, escapeMrkdwn, linkifyMrkdwn } from "./common";
import type { SlackMessage } from "./common";

export interface StandupCardInput {
  fullName: string;
  avatarUrl: string | null;
  yesterday: Array<{ hours: number; projectName: string; taskSummary: string }>;
  plannedToday: string;
  blockers: string;
}

/** Slack section fields are capped at 2000 characters. Never cuts a `<url|label>` link in half. */
function clip(text: string, max = 1900): string {
  if (text.length <= max) return text;
  let cut = text.slice(0, max - 1);
  const open = cut.lastIndexOf("<");
  if (open > cut.lastIndexOf(">")) cut = cut.slice(0, open);
  return `${cut}…`;
}

function formatTaskForSlack(raw: string): string {
  const items = parseChecklist(raw);
  if (!items) return linkifyMrkdwn(raw.trim());
  return items
    .filter((i) => i.text.trim() || checklistItemLinks(i).some((link) => link.trim()))
    .map((i) => {
      const box = i.done ? "☑" : "☐";
      const text = i.text.trim() ? linkifyMrkdwn(i.text.trim()) : "";
      const links = checklistItemLinks(i).filter((link) => link.trim()).map((link) => ` ${linkifyMrkdwn(link.trim())}`).join("");
      return `  ${box} ${text}${links}`.trimEnd();
    })
    .join("\n");
}

function yesterdayText(rows: StandupCardInput["yesterday"]): string {
  if (rows.length === 0) return "Nothing logged";
  return rows
    .map((r) => {
      const task = formatTaskForSlack(r.taskSummary);
      const sep = task.includes("\n") ? "\n" : " — ";
      return `${formatHours(r.hours)} ${escapeMrkdwn(r.projectName)}${task ? `${sep}${task}` : ""}`;
    })
    .join("\n");
}

/**
 * Design system 7.3 (FR-SLACK-03). Stream B text is shown as context only.
 * A14: SHARED channel post, so it stays English for everyone (no locale, no i18n).
 * A17: URLs in the task, plan and blockers become `<url|Provider · label>` links.
 */
export function buildStandupCard(input: StandupCardInput): SlackMessage {
  const name = escapeMrkdwn(input.fullName || "Someone");
  const plan = input.plannedToday.trim();
  const blockers = input.blockers.trim();
  const nameSection: SlackBlock = {
    type: "section",
    text: { type: "mrkdwn", text: `*${name}*` },
    ...(input.avatarUrl
      ? { accessory: { type: "image", image_url: input.avatarUrl, alt_text: input.fullName || "avatar" } }
      : {}),
  };
  const yesterday = yesterdayText(input.yesterday);
  return {
    text: `${input.fullName || "Someone"} posted a standup`,
    blocks: [
      nameSection,
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: clip(`*Yesterday*\n${yesterday}`) },
          { type: "mrkdwn", text: clip(`*Today*\n${plan ? linkifyMrkdwn(plan) : "—"}`) },
        ],
      },
      context(blockers ? clip(`:warning: Blocker: ${linkifyMrkdwn(blockers)}`) : "No blockers"),
    ],
  };
}
