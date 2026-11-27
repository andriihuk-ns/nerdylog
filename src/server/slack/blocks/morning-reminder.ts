import type { MorningReminderTarget } from "@/contracts";
import { ACTION } from "../ids";
import { intlTag, t } from "../i18n";
import { header, plain, type SlackMessage } from "./common";

const PTO_LABELS = {
  vacation: "pto.vacation",
  sick: "pto.sick",
  holiday: "pto.holiday",
} as const;

function workHours(value: number, locale: MorningReminderTarget["locale"]): string {
  const formatted = new Intl.NumberFormat(intlTag(locale), { maximumFractionDigits: 2 }).format(value);
  return t(locale, "unit.hours", { n: formatted });
}

function details(target: MorningReminderTarget): string[] {
  return target.entries.map((entry) => {
    if (entry.entryType !== "work") {
      return `• ${t(target.locale, PTO_LABELS[entry.entryType])}`;
    }
    const project = entry.projectName ?? "";
    const task = entry.taskSummary || t(target.locale, "morning.noTask");
    return `• ${project} — ${workHours(entry.hours, target.locale)} · ${task}`;
  });
}

function dateLabel(target: MorningReminderTarget): string {
  return new Intl.DateTimeFormat(intlTag(target.locale), {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${target.logDate}T12:00:00Z`));
}

function section(text: string) {
  const clipped = Array.from(text).slice(0, 2900).join("");
  return { type: "section" as const, text: { type: "plain_text" as const, text: clipped } };
}

export function buildMorningReminder(target: MorningReminderTarget): SlackMessage {
  const date = dateLabel(target);
  const work = target.entries.filter((entry) => entry.entryType === "work");
  const totalHours = work.reduce((sum, entry) => sum + entry.hours, 0);
  const summary = target.entries.length === 0
    ? t(target.locale, "morning.noEntries", { date })
    : work.length > 0
      ? t(target.locale, "morning.summary", {
          date,
          hours: workHours(totalHours, target.locale),
          count: work.length,
        })
      : t(target.locale, "morning.timeOffOnly", { date });
  const body = [summary, ...details(target)].join("\n");
  const title = t(target.locale, "morning.title", { date });

  return {
    text: `${title}\n${body}`,
    blocks: [
      header(title),
      section(body),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            action_id: ACTION.homeLog,
            text: plain(t(target.locale, target.entries.length ? "morning.logMore" : "morning.logYesterday")),
            value: target.logDate,
            style: "primary",
          },
        ],
      },
    ],
  };
}
