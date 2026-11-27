import { isoDateSchema, MAX_LINK_LENGTH, MAX_TASK_SUMMARY_LENGTH, serializeChecklist, type ChecklistItem, type Locale, type SlackSubmissionInput, type TimeEntryInput } from "@/contracts";
import { formatNumber } from "../dates";
import { t } from "../i18n";
import { PLAN_MAX_LENGTH } from "../blocks/time-modal";
import { BLOCK, rowBlock } from "../ids";
import { getRowTaskMeta, type ModalMetadata } from "../metadata";
import { dateValue, optionValue, textValue, type FieldErrors, type ParseResult, type ViewStateValues } from "./state";

export interface TimeSubmissionArgs {
  viewId: string;
  meta: ModalMetadata; // kind "standup" or "log"
  values: ViewStateValues;
  locale: Locale; // A14: language of the field errors
}

const MIN_HOURS = 0.25;
const MAX_HOURS = 24;

/** Parses "2.5" or "2,5" (A14: either decimal separator). Returns a localized error message on failure. */
export function parseHours(raw: string, locale: Locale): number | string {
  const trimmed = raw.trim();
  if (/[^0-9.,]/.test(trimmed)) {
    return t(locale, "err.numbersOnly");
  }
  const normalized = trimmed.replace(",", ".");
  const hours = /^\d+(\.\d+)?$|^\.\d+$/.test(normalized) ? Number(normalized) : NaN;
  if (!Number.isFinite(hours) || hours < MIN_HOURS || hours > MAX_HOURS) {
    return t(locale, "err.hoursRange", { min: formatNumber(MIN_HOURS, locale), max: formatNumber(MAX_HOURS, locale) });
  }
  if (Math.round(hours * 4) !== hours * 4) {
    return t(locale, "err.quarterHours", { a: formatNumber(2.5, locale), b: formatNumber(0.75, locale) });
  }
  return hours;
}

/**
 * Parses a time / standup `view_submission` into SlackSubmissionInput (FR-SLACK-02).
 * A16: every rendered row (1..meta.rows) needs a project, valid hours and a task summary; the
 * standup also needs a plan and blockers ("None" when nothing blocks). Each empty field gets its
 * own localized error. Stream B text goes only into `checkin`, never into `entries`.
 */
export function parseTimeSubmission({ viewId, meta, values, locale }: TimeSubmissionArgs): ParseResult<SlackSubmissionInput> {
  const errors: FieldErrors = {};
  const workDate = dateValue(values, BLOCK.workDate);
  if (!workDate || !isoDateSchema.safeParse(workDate).success) errors[BLOCK.workDate] = t(locale, "err.workDateMissing");
  if (workDate && workDate > meta.today) errors[BLOCK.workDate] = t(locale, "err.workDateFuture");

  const source: TimeEntryInput["source"] = meta.kind === "standup" ? "slack_standup" : "slack_command";
  const entries: TimeEntryInput[] = [];
  let total = 0;
  let lastHoursBlock: string | null = null;

  for (let n = 1; n <= meta.rows; n += 1) {
    const projectId = optionValue(values, rowBlock.project(n));
    const rawHours = textValue(values, rowBlock.hours(n));
    const hours = rawHours ? parseHours(rawHours, locale) : t(locale, "err.enterHours");
    const taskMeta = getRowTaskMeta(meta, n);
    const items: ChecklistItem[] = [];
    let taskInvalid = false;

    for (let i = 1; i <= taskMeta.count; i += 1) {
      const text = textValue(values, rowBlock.taskItem(n, i));
      if (!text) {
        errors[rowBlock.taskItem(n, i)] = t(locale, "err.enterTask");
        taskInvalid = true;
      }
      const hasLink = taskMeta.links.includes(i);
      // A27: any number of links, separated by new lines or spaces.
      const links = hasLink ? textValue(values, rowBlock.taskLink(n, i)).split(/\s+/).filter(Boolean) : [];
      const [link, ...additionalLinks] = links;
      if (links.some((url) => url.length > MAX_LINK_LENGTH)) {
        errors[rowBlock.taskLink(n, i)] = t(locale, "err.tooLong", { max: MAX_LINK_LENGTH });
        taskInvalid = true;
      }
      if (hasLink && !link) {
        errors[rowBlock.taskLink(n, i)] = t(locale, "err.enterLink");
        taskInvalid = true;
      }
      items.push({ text, ...(link ? { link } : {}), ...(additionalLinks.length ? { additionalLinks } : {}), done: false });
    }

    const taskSummary = serializeChecklist(items);
    if (!taskInvalid && taskSummary.length > MAX_TASK_SUMMARY_LENGTH) {
      errors[rowBlock.taskItem(n, taskMeta.count)] = t(locale, "err.tooLong", { max: MAX_TASK_SUMMARY_LENGTH });
      taskInvalid = true;
    }

    if (!projectId) {
      errors[rowBlock.project(n)] = t(locale, "err.pickProject");
    }
    if (typeof hours === "string") {
      errors[rowBlock.hours(n)] = hours;
    }
    if (!projectId || typeof hours === "string" || taskInvalid) continue;
    total += hours;
    lastHoursBlock = rowBlock.hours(n);
    entries.push({
      userId: meta.userId,
      projectId,
      workDate: workDate ?? meta.logDate,
      hours,
      entryType: "work",
      taskSummary,
      source,
      slackViewId: viewId,
    });
  }

  if (lastHoursBlock && total > 24) errors[lastHoursBlock] = t(locale, "err.totalOver");
  // rows === 0: the user has no projects, so no rows were rendered; a log has nothing to save.
  if (meta.kind === "log" && meta.rows === 0) errors[BLOCK.workDate] = t(locale, "err.atLeastOne");

  let checkin: SlackSubmissionInput["checkin"] = null;
  if (meta.kind === "standup") {
    const plannedToday = textValue(values, BLOCK.plan);
    const blockers = textValue(values, BLOCK.blockers);
    if (!plannedToday) errors[BLOCK.plan] = t(locale, "err.planRequired");
    if (plannedToday.length > PLAN_MAX_LENGTH) errors[BLOCK.plan] = t(locale, "err.tooLong", { max: PLAN_MAX_LENGTH });
    if (!blockers) errors[BLOCK.blockers] = t(locale, "err.blockersRequired");
    if (blockers.length > PLAN_MAX_LENGTH) errors[BLOCK.blockers] = t(locale, "err.tooLong", { max: PLAN_MAX_LENGTH });
    checkin = { userId: meta.userId, checkinDate: meta.today, plannedToday, blockers };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { viewId, userId: meta.userId, kind: meta.kind, entries, checkin } };
}
