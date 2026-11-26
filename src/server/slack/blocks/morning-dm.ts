import type { IsoDate } from "@/contracts";
import { firstName, weekdayName } from "../dates";
import { ACTION } from "../ids";
import type { SlackBlock } from "../types";
import { context, escapeMrkdwn, mrkdwnSection, plain } from "./common";

export interface MorningDmInput {
  fullName?: string | null;
  logDate: IsoDate;
}

export interface SlackMessage {
  text: string; // notification / fallback text
  blocks: SlackBlock[];
}

/** Design system 7.1 (FR-SLACK-01). Both buttons carry the log date as their value. */
export function buildMorningDm({ fullName, logDate }: MorningDmInput): SlackMessage {
  const name = firstName(fullName);
  const greeting = name ? `Morning, ${escapeMrkdwn(name)}.` : "Morning.";
  const day = weekdayName(logDate);
  return {
    text: `${greeting} Log ${day} and plan today.`,
    blocks: [
      mrkdwnSection(`${greeting} Log *${day}* and plan today.`),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            action_id: ACTION.openStandup,
            text: plain("Log Yesterday & Plan Today"),
            style: "primary",
            value: logDate,
          },
          { type: "button", action_id: ACTION.openPto, text: plain("Quick PTO (Vacation / Sick)"), value: logDate },
        ],
      },
      context("Takes about 15 seconds. Hours go to your timesheet; plans are shared only as context."),
    ],
  };
}
