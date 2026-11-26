import type { TimeEntryView } from "@/contracts";
import { buildAppHome, buildUnlinkedHome, type AppHomeInput } from "../blocks/app-home";
import { notLinkedMessage } from "../blocks/common";
import { localIsoDate, mondayOf, yearOf } from "../dates";
import type { SlackDeps } from "../types";

const PTO_LABELS: Record<string, string> = { vacation: "Vacation", sick: "Sick day", holiday: "Holiday" };

/** Today's cell for the Home tab: work hours, else a PTO label, else null (not logged). */
export function todayStatus(entries: TimeEntryView[], today: string): AppHomeInput["today"] {
  const rows = entries.filter((e) => e.workDate === today);
  const work = rows.filter((e) => e.entryType === "work");
  if (work.length > 0) return { hours: work.reduce((sum, e) => sum + e.hours, 0) };
  const pto = rows.find((e) => e.entryType !== "work");
  return pto ? { label: PTO_LABELS[pto.entryType] ?? pto.entryType } : null;
}

function timeLabel(now: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(11, 16);
  }
}

/** FR-SLACK-04: render and publish the App Home tab for one Slack user. */
export async function publishHome(deps: SlackDeps, slackUserId: string): Promise<void> {
  const profile = await deps.tempo.resolveUser(slackUserId);
  if (!profile) {
    await deps.slack.publishHome(slackUserId, buildUnlinkedHome(notLinkedMessage(deps.appBaseUrl), deps.appBaseUrl));
    return;
  }
  const now = deps.now();
  const today = localIsoDate(now, profile.timezone);
  const year = yearOf(today); // A9: PTO year in the user's timezone
  const month = today.slice(0, 7);
  const [entries, caps, pto, holidays, nextYearHolidays] = await Promise.all([
    deps.tempo.listWeekEntries(profile, profile.userId, mondayOf(today)),
    deps.tempo.getProjectCapUsage(profile, month),
    deps.tempo.getPtoBalance(profile, profile.userId, year),
    deps.tempo.listHolidays(profile, year),
    deps.tempo.listHolidays(profile, year + 1),
  ]);
  const nextHoliday =
    [...holidays, ...nextYearHolidays]
      .filter((h) => h.holidayDate >= today)
      .sort((a, b) => a.holidayDate.localeCompare(b.holidayDate))[0] ?? null;
  const weekHours = entries.filter((e) => e.entryType === "work").reduce((sum, e) => sum + e.hours, 0);

  await deps.slack.publishHome(
    slackUserId,
    buildAppHome({
      appBaseUrl: deps.appBaseUrl,
      weekHours,
      today: todayStatus(entries, today),
      month,
      caps,
      pto,
      nextHoliday,
      updatedLabel: timeLabel(now, profile.timezone),
    }),
  );
}
