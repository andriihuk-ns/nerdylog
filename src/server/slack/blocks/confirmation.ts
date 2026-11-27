import type { IsoDate, Locale, TimeEntryInput } from "@/contracts";
import { formatHours, longDate, shortDate } from "../dates";
import { t, tPlural } from "../i18n";
import { context, escapeMrkdwn, header, mrkdwnSection, type SlackMessage } from "./common";

/** A31–A33: private confirmations after a submission, in the submitter's locale. */

type Entry = Pick<TimeEntryInput, "entryType" | "hours" | "workDate">;

const dates = (entries: readonly Entry[]): IsoDate[] => [...new Set(entries.map((e) => e.workDate))].sort();

/** One quick line for one project: "✅ Logged 5h · DogTeamPro · <date> · Open My Time". */
export function buildLoggedMessage(
  entries: readonly Entry[],
  projectName: string | undefined,
  locale: Locale,
  appBaseUrl: string,
): SlackMessage {
  const hours = formatHours(entries.reduce((sum, e) => sum + e.hours, 0), locale);
  const title = t(locale, "logged.title", { hours });
  const rest = [projectName ?? t(locale, "logged.project"), dates(entries).map((d) => longDate(d, locale)).join(", ")];
  const link = `<${appBaseUrl}/my-time|${t(locale, "logged.openWeb")}>`;
  return {
    text: [title, ...rest].join(" · "),
    blocks: [mrkdwnSection([title, ...rest.map(escapeMrkdwn), link].join(" · "))],
  };
}

/** Confirms saved vacation / sick days; one entry per day. */
export function buildTimeOffMessage(entries: readonly Entry[], locale: Locale, appBaseUrl: string): SlackMessage {
  const days = dates(entries);
  const kind = entries[0].entryType === "sick" ? "pto.sick" : entries[0].entryType === "holiday" ? "pto.holiday" : "pto.vacation";
  const first = shortDate(days[0], locale);
  const range = days.length === 1 ? first : `${first} – ${shortDate(days[days.length - 1], locale)}`;
  const title = t(locale, "timeOff.title");
  const body = `*${t(locale, kind)}* · ${range} · ${tPlural(locale, "plural.days", days.length)}`;
  return {
    text: `${title}: ${body.replace(/\*/g, "")}`,
    blocks: [header(title), mrkdwnSection(body), context(`<${appBaseUrl}/my-time|${t(locale, "logged.openWeb")}>`)],
  };
}
