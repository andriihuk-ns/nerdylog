import type { HolidayView, Locale, ProjectHours, PtoBalance } from "@/contracts";
import { formatHours, formatHoursFixed, formatNumber, shortDate } from "../dates";
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
  projectHours: ProjectHours[]; // A15: the viewer's hours per project this month
  pto: PtoBalance;
  nextHoliday: Pick<HolidayView, "holidayDate" | "name"> | null; // from the viewer's own office (A15)
  updatedLabel: string; // e.g. "09:41" (already locale-formatted)
}

/** Keeps the section under Slack's 3000-character text limit. */
const MAX_PROJECT_LINES = 20;

/** A15: one line per project with hours this month, most hours first (caps were removed). */
function projectHoursBlocks(rows: ProjectHours[], locale: Locale): SlackBlock[] {
  const withHours = rows.filter((r) => r.hours > 0).sort((a, b) => b.hours - a.hours || a.projectName.localeCompare(b.projectName));
  if (withHours.length === 0) return [context(t(locale, "home.noProjectHours"))];
  const lines = withHours
    .slice(0, MAX_PROJECT_LINES)
    .map((r) => `*${escapeMrkdwn(r.projectName)}*  ${formatHoursFixed(r.hours, locale)}`);
  return [mrkdwnSection(lines.join("\n"))];
}

function days(n: number, locale: Locale): string {
  return tPlural(locale, "plural.days", n, formatNumber(n, locale));
}

function todayText(today: AppHomeInput["today"], locale: Locale): string {
  if (!today) return t(locale, "home.notLogged");
  return "label" in today ? today.label : formatHours(today.hours, locale);
}

function ptoFields(pto: PtoBalance, nextHoliday: AppHomeInput["nextHoliday"], locale: Locale) {
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
        // A15: open the same modals as /log and /pto from the Apps list, anytime.
        { type: "button", action_id: ACTION.homeLog, text: plain(t(locale, "home.logTime")), style: "primary" },
        { type: "button", action_id: ACTION.homePto, text: plain(t(locale, "home.timeOffButton")), style: "primary" },
        {
          type: "button",
          action_id: ACTION.openWeb,
          text: plain(t(locale, "common.openWeb")),
          url: `${input.appBaseUrl}/my-time`,
        },
      ],
    },
  ];
  blocks.push(
    divider(),
    header(t(locale, "home.byProject")),
    ...projectHoursBlocks(input.projectHours, locale),
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
