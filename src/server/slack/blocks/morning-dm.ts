import type { IsoDate, Locale } from "@/contracts";
import { firstName, weekdayForPrompt } from "../dates";
import { t } from "../i18n";
import { ACTION } from "../ids";
import type { SlackBlock } from "../types";
import { context, escapeMrkdwn, mrkdwnSection, plain } from "./common";

export interface MorningDmInput {
  fullName?: string | null;
  logDate: IsoDate;
  locale: Locale; // A14: recipient's language
}

export interface SlackMessage {
  text: string; // notification / fallback text
  blocks: SlackBlock[];
}

/** Design system 7.1 (FR-SLACK-01). Both buttons carry the log date as their value. */
export function buildMorningDm({ fullName, logDate, locale }: MorningDmInput): SlackMessage {
  const name = firstName(fullName);
  const greeting = name ? t(locale, "dm.greetingNamed", { name: escapeMrkdwn(name) }) : t(locale, "dm.greeting");
  const day = weekdayForPrompt(logDate, locale);
  return {
    text: `${greeting} ${t(locale, "dm.promptPlain", { day })}`,
    blocks: [
      mrkdwnSection(`${greeting} ${t(locale, "dm.prompt", { day })}`),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            action_id: ACTION.openStandup,
            text: plain(t(locale, "dm.openStandup")),
            style: "primary",
            value: logDate,
          },
          { type: "button", action_id: ACTION.openPto, text: plain(t(locale, "dm.openPto")), value: logDate },
        ],
      },
      context(t(locale, "dm.footer")),
    ],
  };
}
