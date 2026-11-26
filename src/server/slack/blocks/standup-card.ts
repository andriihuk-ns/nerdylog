import { formatHours } from "../dates";
import type { SlackBlock } from "../types";
import { context, escapeMrkdwn } from "./common";
import type { SlackMessage } from "./morning-dm";

export interface StandupCardInput {
  fullName: string;
  avatarUrl: string | null;
  yesterday: Array<{ hours: number; projectName: string; taskSummary: string }>;
  plannedToday: string;
  blockers: string;
}

/** Slack section fields are capped at 2000 characters. */
function clip(text: string, max = 1900): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function yesterdayText(rows: StandupCardInput["yesterday"]): string {
  if (rows.length === 0) return "Nothing logged";
  return rows
    .map((r) => {
      const task = r.taskSummary.trim();
      return `${formatHours(r.hours)} ${escapeMrkdwn(r.projectName)}${task ? ` — ${escapeMrkdwn(task)}` : ""}`;
    })
    .join("\n");
}

/** Design system 7.3 (FR-SLACK-03). Stream B text is shown as context only. */
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
          { type: "mrkdwn", text: clip(`*Today*\n${plan ? escapeMrkdwn(plan) : "—"}`) },
        ],
      },
      context(blockers ? clip(`:warning: Blocker: ${escapeMrkdwn(blockers)}`) : "No blockers"),
    ],
  };
}
