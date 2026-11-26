import { capStatus, type HolidayView, type Locale, type ProjectCapUsage, type PtoBalance } from "@/contracts";
import { formatHours, formatHoursFixed, formatNumber, monthName, shortDate } from "../dates";
import { t, tPlural } from "../i18n";
import { ACTION } from "../ids";
import type { HomeView, SlackBlock } from "../types";
import { context, divider, escapeMrkdwn, header, mrkdwnSection, plain } from "./common";

export interface AppHomeInput {
  appBaseUrl: string;
  weekHours: number;
  locale: Locale; // A14: viewer's language
  /** null → nothing logged today; an already-translated label like "Відпустка" for PTO days. */
  today: { hours: number } | { label: string } | null;
  month: string; // "YYYY-MM"
  caps: ProjectCapUsage[];
  pto: PtoBalance;
  nextHoliday: HolidayView | null;
  updatedLabel: string; // e.g. "09:41" (already locale-formatted)
}

const SEGMENTS = 10;

/** 10-segment text bar, e.g. `▰▰▰▰▰▰▰▰▱▱` for 80 %. */
export function capBar(used: number, cap: number): string {
  const filled = cap > 0 ? Math.min(SEGMENTS, Math.max(0, Math.round((used / cap) * SEGMENTS))) : 0;
  return "▰".repeat(filled) + "▱".repeat(SEGMENTS - filled);
}

function capLine(c: ProjectCapUsage & { capHours: number }, locale: Locale): SlackBlock {
  const pct = Math.round((c.usedHours / c.capHours) * 100);
  const status = capStatus(c.usedHours, c.capHours);
  const emoji = status === "over" ? " :red_circle:" : status === "warning" ? " :large_orange_circle:" : "";
  const name = escapeMrkdwn(c.projectName);
  const usage = `${formatHoursFixed(c.usedHours, locale)} / ${formatHoursFixed(c.capHours, locale)} · ${pct}%`;
  return mrkdwnSection(`*${name}*  ${usage}${emoji}\n\`${capBar(c.usedHours, c.capHours)}\``);
}

function days(n: number, locale: Locale): string {
  return tPlural(locale, "plural.days", n, formatNumber(n, locale));
}

function todayText(today: AppHomeInput["today"], locale: Locale): string {
  if (!today) return t(locale, "home.notLogged");
  return "label" in today ? today.label : formatHours(today.hours, locale);
}

function ptoFields(pto: PtoBalance, nextHoliday: HolidayView | null, locale: Locale) {
  // Amendment A9: remaining when an allowance is set, otherwise vacation used only.
  const vacation =
    pto.remainingDays !== null && pto.allowanceDays !== null
      ? `*${t(locale, "home.vacationLeft", { year: pto.year })}*\n${t(locale, "home.ofAllowance", {
          days: days(pto.remainingDays, locale),
          allowance: formatNumber(pto.allowanceDays, locale),
        })}`
      : `*${t(locale, "home.vacationUsed", { year: pto.year })}*\n${days(pto.vacationUsedDays, locale)}`;
  const holiday = nextHoliday
    ? `${shortDate(nextHoliday.holidayDate, locale)} · ${escapeMrkdwn(nextHoliday.name)}`
    : t(locale, "home.noHoliday");
  return [
    { type: "mrkdwn" as const, text: vacation },
    { type: "mrkdwn" as const, text: `*${t(locale, "home.sickUsed")}*\n${days(pto.sickUsedDays, locale)}` },
    { type: "mrkdwn" as const, text: `*${t(locale, "home.nextHoliday")}*\n${holiday}` },
  ];
}

/** Design system 7.4 (FR-SLACK-04). A14: rendered in the viewer's locale. */
export function buildAppHome(input: AppHomeInput): HomeView {
  const { locale } = input;
  const capped = input.caps.filter((c): c is ProjectCapUsage & { capHours: number } => c.capHours !== null);
  const blocks: SlackBlock[] = [
    header(t(locale, "home.yourWeek")),
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*${t(locale, "home.thisWeek")}*\n${formatHours(input.weekHours, locale)}` },
        { type: "mrkdwn", text: `*${t(locale, "home.today")}*\n${todayText(input.today, locale)}` },
      ],
    },
    {
      type: "actions",
      elements: [
        { type: "button", action_id: ACTION.homeLog, text: plain(t(locale, "home.logTime")), style: "primary" },
        { type: "button", action_id: ACTION.homePto, text: plain(t(locale, "home.quickPto")) },
        {
          type: "button",
          action_id: ACTION.openWeb,
          text: plain(t(locale, "common.openWeb")),
          url: `${input.appBaseUrl}/my-time`,
        },
      ],
    },
  ];
  if (capped.length > 0) {
    blocks.push(
      divider(),
      header(t(locale, "home.clientCaps", { month: monthName(input.month, locale) })),
      ...capped.map((c) => capLine(c, locale)),
    );
  }
  blocks.push(
    divider(),
    header(t(locale, "home.timeOff")),
    { type: "section", fields: ptoFields(input.pto, input.nextHoliday, locale) },
    context(t(locale, "home.footer", { time: input.updatedLabel })),
  );
  return { type: "home", blocks };
}

/** Home tab for Slack users without a Tempo account (no locale known → DEFAULT_LOCALE). */
export function buildUnlinkedHome(message: string, appBaseUrl: string, locale: Locale): HomeView {
  return {
    type: "home",
    blocks: [
      header("nerdylog"),
      mrkdwnSection(message),
      {
        type: "actions",
        elements: [
          { type: "button", action_id: ACTION.openWeb, text: plain(t(locale, "common.openWeb")), url: appBaseUrl },
        ],
      },
    ],
  };
}
