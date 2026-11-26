import { isoDateSchema, type SlackSubmissionInput, type TimeEntryInput } from "@/contracts";
import { PLAN_MAX_LENGTH, TASK_MAX_LENGTH } from "../blocks/time-modal";
import { BLOCK, rowBlock } from "../ids";
import type { ModalMetadata } from "../metadata";
import { dateValue, optionValue, textValue, type FieldErrors, type ParseResult, type ViewStateValues } from "./state";

export interface TimeSubmissionArgs {
  viewId: string;
  meta: ModalMetadata; // kind "standup" or "log"
  values: ViewStateValues;
}

const HOURS_RANGE = "Hours must be between 0.25 and 24";

function parseHours(raw: string): number | string {
  const hours = Number(raw.replace(",", "."));
  if (!Number.isFinite(hours) || hours < 0.25 || hours > 24) return HOURS_RANGE;
  if (Math.round(hours * 4) !== hours * 4) return "Use quarter hours, e.g. 2.5 or 0.75";
  return hours;
}

/**
 * Parses a time / standup `view_submission` into SlackSubmissionInput (FR-SLACK-02).
 * Empty rows are ignored. A row with hours or a task but no project, or a project
 * without valid hours, yields a field error on that block. Stream B text goes only
 * into `checkin`, never into `entries`.
 */
export function parseTimeSubmission({ viewId, meta, values }: TimeSubmissionArgs): ParseResult<SlackSubmissionInput> {
  const errors: FieldErrors = {};
  const workDate = dateValue(values, BLOCK.workDate);
  if (!workDate || !isoDateSchema.safeParse(workDate).success) errors[BLOCK.workDate] = "Pick a work date";
  if (workDate && workDate > meta.today) errors[BLOCK.workDate] = "Work date cannot be in the future";

  const source: TimeEntryInput["source"] = meta.kind === "standup" ? "slack_standup" : "slack_command";
  const entries: TimeEntryInput[] = [];
  let total = 0;
  let lastHoursBlock: string | null = null;

  for (let n = 1; n <= meta.rows; n += 1) {
    const projectId = optionValue(values, rowBlock.project(n));
    const rawHours = textValue(values, rowBlock.hours(n));
    const task = textValue(values, rowBlock.task(n));
    if (!projectId && !rawHours && !task) continue;

    if (!projectId) {
      errors[rowBlock.project(n)] = "Pick a project for this row";
      continue;
    }
    if (!rawHours) {
      errors[rowBlock.hours(n)] = "Enter hours for this project";
      continue;
    }
    const hours = parseHours(rawHours);
    if (typeof hours === "string") {
      errors[rowBlock.hours(n)] = hours;
      continue;
    }
    if (task.length > TASK_MAX_LENGTH) {
      errors[rowBlock.task(n)] = `Keep it under ${TASK_MAX_LENGTH} characters`;
      continue;
    }
    total += hours;
    lastHoursBlock = rowBlock.hours(n);
    entries.push({
      userId: meta.userId,
      projectId,
      workDate: workDate ?? meta.logDate,
      hours,
      entryType: "work",
      taskSummary: task,
      source,
      slackViewId: viewId,
    });
  }

  if (lastHoursBlock && total > 24) errors[lastHoursBlock] = "Total hours for one day cannot exceed 24";
  if (meta.kind === "log" && entries.length === 0 && Object.keys(errors).length === 0) {
    errors[rowBlock.hours(1)] = "Add at least one project with hours";
  }

  let checkin: SlackSubmissionInput["checkin"] = null;
  if (meta.kind === "standup") {
    const plannedToday = textValue(values, BLOCK.plan);
    const blockers = textValue(values, BLOCK.blockers);
    if (!plannedToday) errors[BLOCK.plan] = "Share at least one line about today";
    if (plannedToday.length > PLAN_MAX_LENGTH) errors[BLOCK.plan] = `Keep it under ${PLAN_MAX_LENGTH} characters`;
    if (blockers.length > PLAN_MAX_LENGTH) errors[BLOCK.blockers] = `Keep it under ${PLAN_MAX_LENGTH} characters`;
    checkin = { userId: meta.userId, checkinDate: meta.today, plannedToday, blockers };
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { viewId, userId: meta.userId, kind: meta.kind, entries, checkin } };
}
