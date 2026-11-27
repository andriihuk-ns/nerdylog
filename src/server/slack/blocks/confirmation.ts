import type { IsoDate, Locale, TimeEntryInput } from "@/contracts";
import { formatHours, longDate, shortDate } from "../dates";
import { t, tPlural } from "../i18n";
import { context, escapeMrkdwn, header, mrkdwnSection, type SlackMessage } from "./common";
import { clip, formatTaskForSlack } from "./standup-card";

/** A31/A32: private confirmations after a submission, in the submitter's locale. */

type Entry = Pick<TimeEntryInput, "entryType" | "projectId" | "hours" | "taskSummary" | "workDate">;

const SECTION_MAX = 2900;
/** Slack allows 50 blocks per message; header and footer take two. */
const MAX_SECTIONS = 48;

const total = (entries: readonly Entry[]) => entries.reduce((sum, e) => sum + e.hours, 0);
const dates = (entries: readonly Entry[]): IsoDate[] => [...new Set(entries.map((e) => e.workDate))].sort();

function projectSection(name: string, entries: readonly Entry[], locale: Locale): string {
  const lines = entries.map((e) => {
    const task = formatTaskForSlack(e.taskSummary);
    const hours = formatHours(e.hours, locale);
    if (!task) return `• ${hours}`;
    return task.includes("\n") ? `• ${hours}\n${task}` : `• ${hours} — ${task}`;
  });
  const heading = `*${escapeMrkdwn(name)}* · ${formatHours(total(entries), locale)}`;
  return clip([heading, ...lines].join("\n"), SECTION_MAX);
}

/** "Logged 5h" with one section per project. `entries` are work entries of saved projects. */
export function buildLoggedMessage(
  entries: readonly Entry[],
  projectNames: ReadonlyMap<string, string>,
  locale: Locale,
  appBaseUrl: string,
): SlackMessage {
  const title = t(locale, "logged.title", { hours: formatHours(total(entries), locale) });
  const when = dates(entries).map((d) => longDate(d, locale)).join(", ");
  const sections = [...new Set(entries.map((e) => e.projectId!))].map((id) =>
    projectSection(projectNames.get(id) ?? t(locale, "logged.project"), entries.filter((e) => e.projectId === id), locale),
  );
  return {
    text: `${title} · ${when}`,
    blocks: [
      header(title),
      ...sections.slice(0, MAX_SECTIONS).map((text) => mrkdwnSection(text)),
      context(`${when} · <${appBaseUrl}/my-time|${t(locale, "logged.openWeb")}> · ${t(locale, "common.onlyYou")}`),
    ],
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
