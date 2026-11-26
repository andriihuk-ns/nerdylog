import { capStatus, type HolidayView, type ProjectCapUsage, type PtoBalance } from "@/contracts";
import { formatHours, formatHoursFixed, monthName, shortDate } from "../dates";
import { ACTION } from "../ids";
import type { HomeView, SlackBlock } from "../types";
import { context, divider, escapeMrkdwn, header, mrkdwnSection, plain } from "./common";

export interface AppHomeInput {
  appBaseUrl: string;
  weekHours: number;
  /** null → nothing logged today; a label like "Vacation" for PTO days. */
  today: { hours: number } | { label: string } | null;
  month: string; // "YYYY-MM"
  caps: ProjectCapUsage[];
  pto: PtoBalance;
  nextHoliday: HolidayView | null;
  updatedLabel: string; // e.g. "09:41"
}

const SEGMENTS = 10;

/** 10-segment text bar, e.g. `▰▰▰▰▰▰▰▰▱▱` for 80 %. */
export function capBar(used: number, cap: number): string {
  const filled = cap > 0 ? Math.min(SEGMENTS, Math.max(0, Math.round((used / cap) * SEGMENTS))) : 0;
  return "▰".repeat(filled) + "▱".repeat(SEGMENTS - filled);
}

function capLine(c: ProjectCapUsage & { capHours: number }): SlackBlock {
  const pct = Math.round((c.usedHours / c.capHours) * 100);
  const status = capStatus(c.usedHours, c.capHours);
  const emoji = status === "over" ? " :red_circle:" : status === "warning" ? " :large_orange_circle:" : "";
  const name = escapeMrkdwn(c.projectName);
  const usage = `${formatHoursFixed(c.usedHours)} / ${formatHoursFixed(c.capHours)} · ${pct}%`;
  return mrkdwnSection(`*${name}*  ${usage}${emoji}\n\`${capBar(c.usedHours, c.capHours)}\``);
}

function days(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

function todayText(today: AppHomeInput["today"]): string {
  if (!today) return "Not logged";
  return "label" in today ? today.label : formatHours(today.hours);
}

function ptoFields(pto: PtoBalance, nextHoliday: HolidayView | null) {
  // Amendment A9: remaining when an allowance is set, otherwise vacation used only.
  const vacation =
    pto.remainingDays !== null && pto.allowanceDays !== null
      ? `*Vacation left (${pto.year})*\n${days(pto.remainingDays)} of ${pto.allowanceDays}`
      : `*Vacation used (${pto.year})*\n${days(pto.vacationUsedDays)}`;
  return [
    { type: "mrkdwn" as const, text: vacation },
    { type: "mrkdwn" as const, text: `*Sick used*\n${days(pto.sickUsedDays)}` },
    {
      type: "mrkdwn" as const,
      text: `*Next holiday*\n${nextHoliday ? `${shortDate(nextHoliday.holidayDate)} · ${escapeMrkdwn(nextHoliday.name)}` : "None planned"}`,
    },
  ];
}

/** Design system 7.4 (FR-SLACK-04). */
export function buildAppHome(input: AppHomeInput): HomeView {
  const capped = input.caps.filter((c): c is ProjectCapUsage & { capHours: number } => c.capHours !== null);
  const blocks: SlackBlock[] = [
    header("Your week"),
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*This week*\n${formatHours(input.weekHours)}` },
        { type: "mrkdwn", text: `*Today*\n${todayText(input.today)}` },
      ],
    },
    {
      type: "actions",
      elements: [
        { type: "button", action_id: ACTION.homeLog, text: plain("Log time"), style: "primary" },
        { type: "button", action_id: ACTION.homePto, text: plain("Quick PTO") },
        { type: "button", action_id: ACTION.openWeb, text: plain("Open Web Panel"), url: `${input.appBaseUrl}/my-time` },
      ],
    },
  ];
  if (capped.length > 0) {
    blocks.push(divider(), header(`Client caps · ${monthName(input.month)}`), ...capped.map(capLine));
  }
  blocks.push(
    divider(),
    header("Time off"),
    { type: "section", fields: ptoFields(input.pto, input.nextHoliday) },
    context(`Updated ${input.updatedLabel} · Hours are tracked from your standups and /log.`),
  );
  return { type: "home", blocks };
}

/** Home tab for Slack users without a Tempo account. */
export function buildUnlinkedHome(message: string, appBaseUrl: string): HomeView {
  return {
    type: "home",
    blocks: [
      header("Tempo"),
      mrkdwnSection(message),
      {
        type: "actions",
        elements: [{ type: "button", action_id: ACTION.openWeb, text: plain("Open Web Panel"), url: appBaseUrl }],
      },
    ],
  };
}
