import { TZDate } from "@date-fns/tz";
import { canonicalTimezone, type IsoDate, type ProjectPromptTarget } from "@/contracts";
import { previousBusinessDay } from "./calendar";
import { isValidTimeZone } from "./validation";

/**
 * Pure project status-prompt rules (amendment A16; these channel prompts run alongside A19 DMs).
 * No DB, no clock: `now` is passed in. Supabase pg_cron calls the endpoint every 15 minutes; a
 * project is due on the first run where its office-local time is in [prompt, prompt + 90 min) on a
 * local weekday that is not a holiday of that office. The 90-minute window lets late or skipped
 * runs catch up; the project_prompts claim keeps it to one post per project per local date.
 * The window never crosses local midnight: a late prompt time (e.g. 23:00) closes at 24:00.
 */

export const DEFAULT_TIMEZONE = "Europe/Kyiv";
/** A project without a prompt office uses this office (its timezone and holidays). */
export const DEFAULT_PROMPT_OFFICE_CODE = "UA";
export const DEFAULT_PROMPT_TIME = "10:00";
export const PROMPT_WINDOW_SEC = 90 * 60;
const DAY_SEC = 24 * 3600;
const PROMPT_TIME_RE = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

export interface LocalClock {
  /** Effective IANA zone (given zone, or the default when it is unknown). */
  timezone: string;
  date: IsoDate;
  secondsOfDay: number;
  /** 0 = Sunday … 6 = Saturday, in that zone. */
  dayOfWeek: number;
}

export type PromptDecision = "due" | "outside_window" | "weekend" | "holiday";

const pad = (n: number) => String(n).padStart(2, "0");

/** Wall-clock reading of `now` in `timezone` (DST-aware via @date-fns/tz). */
export function localClock(now: Date, timezone: string): LocalClock {
  const tz = isValidTimeZone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const d = new TZDate(now.getTime(), tz);
  return {
    timezone: tz,
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    secondsOfDay: d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(),
    dayOfWeek: d.getDay(),
  };
}

/** "HH:MM" → seconds after local midnight; a malformed value falls back to 10:00. */
export function promptTimeSeconds(promptTime: string): number {
  const m = PROMPT_TIME_RE.exec(promptTime) ?? PROMPT_TIME_RE.exec(DEFAULT_PROMPT_TIME)!;
  return Number(m[1]) * 3600 + Number(m[2]) * 60;
}

export function inPromptWindow(clock: LocalClock, promptTime: string): boolean {
  const start = promptTimeSeconds(promptTime);
  const end = Math.min(start + PROMPT_WINDOW_SEC, DAY_SEC);
  return clock.secondsOfDay >= start && clock.secondsOfDay < end;
}

/** Is the project due at this local clock? Checks run cheapest first; the reason helps logs/tests. */
export function promptDecision(clock: LocalClock, promptTime: string, holidays: ReadonlySet<IsoDate>): PromptDecision {
  if (!inPromptWindow(clock, promptTime)) return "outside_window";
  if (clock.dayOfWeek === 0 || clock.dayOfWeek === 6) return "weekend";
  if (holidays.has(clock.date)) return "holiday";
  return "due";
}

export interface PromptProject {
  projectId: string;
  projectName: string;
  slackChannelId: string;
  statusPromptTime: string;
  officeId: string | null;
  timezone?: string | null; // A29
}

export interface PromptOffice {
  id: string;
  code: string;
  timezone: string;
}

/**
 * Clock and holiday office of a prompt. A29: a project time zone sets the clock, and holidays come
 * from the office in that zone (UA first when several share it), else the UA office. Without one,
 * A16 applies: the project's office, else the UA office. No office at all → Europe/Kyiv zone or
 * the project zone, without holidays.
 */
export function resolvePromptOffice(
  officeId: string | null,
  offices: readonly PromptOffice[],
  timezone?: string | null,
): { officeId: string | null; timezone: string } {
  const fallback = offices.find((o) => o.code === DEFAULT_PROMPT_OFFICE_CODE);
  if (timezone && isValidTimeZone(timezone)) {
    const zone = canonicalTimezone(timezone);
    const [match] = offices
      .filter((o) => canonicalTimezone(o.timezone) === zone)
      .sort((a, b) => Number(b === fallback) - Number(a === fallback) || a.code.localeCompare(b.code));
    return { officeId: (match ?? fallback)?.id ?? null, timezone };
  }
  const office = (officeId ? offices.find((o) => o.id === officeId) : undefined) ?? fallback;
  return office ? { officeId: office.id, timezone: office.timezone } : { officeId: null, timezone: DEFAULT_TIMEZONE };
}

export interface PromptCandidate {
  project: PromptProject;
  officeId: string | null;
  clock: LocalClock;
}

/** Stage 1 (before any holiday lookup): projects in their window on an office-local weekday. */
export function promptWindowCandidates(
  now: Date,
  projects: readonly PromptProject[],
  offices: readonly PromptOffice[],
): PromptCandidate[] {
  const none = new Set<IsoDate>();
  return projects
    .map((project) => {
      const { officeId, timezone } = resolvePromptOffice(project.officeId, offices, project.timezone);
      return { project, officeId, clock: localClock(now, timezone) };
    })
    .filter((c) => promptDecision(c.clock, c.project.statusPromptTime, none) === "due");
}

/** Stage 2: drop projects on a holiday of their office and attach the log date (previous business day). */
export function selectPromptTargets(
  candidates: readonly PromptCandidate[],
  holidaysByOffice: ReadonlyMap<string, ReadonlySet<IsoDate>>,
): Array<Omit<ProjectPromptTarget, "recipients">> {
  const none = new Set<IsoDate>();
  return candidates.flatMap(({ project, officeId, clock }) => {
    const holidays = (officeId && holidaysByOffice.get(officeId)) || none;
    if (promptDecision(clock, project.statusPromptTime, holidays) !== "due") return [];
    return [
      {
        projectId: project.projectId,
        projectName: project.projectName,
        slackChannelId: project.slackChannelId,
        localDate: clock.date,
        logDate: previousBusinessDay(clock.date, holidays),
      },
    ];
  });
}
