import { isoDateSchema, type IsoDate, type SlackSubmissionInput } from "@/contracts";
import { PTO_TYPES } from "../blocks/pto-modal";
import { businessDaysInRange, spanDays } from "../dates";
import { BLOCK, MAX_PTO_BUSINESS_DAYS } from "../ids";
import type { ModalMetadata } from "../metadata";
import { dateValue, optionValue, type FieldErrors, type ParseResult, type ViewStateValues } from "./state";

export interface PtoSubmissionArgs {
  viewId: string;
  meta: ModalMetadata;
  values: ViewStateValues;
  /** Company holidays covering the selected range (skipped like weekends). */
  holidays: ReadonlySet<IsoDate>;
}

/** Guards the day loop against absurd ranges before counting business days. */
const MAX_CALENDAR_SPAN = 31;

type PtoType = (typeof PTO_TYPES)[number]["value"];

function isPtoType(value: string | null): value is PtoType {
  return PTO_TYPES.some((t) => t.value === value);
}

/** The start/end dates picked in the PTO modal, before holidays are known. */
export function ptoRange(values: ViewStateValues): { start: string | null; end: string | null } {
  const start = dateValue(values, BLOCK.ptoStart);
  return { start, end: dateValue(values, BLOCK.ptoEnd) ?? start };
}

/**
 * Quick PTO: one 0h `vacation` / `sick` entry per business day in [start, end],
 * skipping weekends and company holidays, at most 10 business days.
 */
export function parsePtoSubmission(args: PtoSubmissionArgs): ParseResult<SlackSubmissionInput> {
  const { viewId, meta, values, holidays } = args;
  const errors: FieldErrors = {};
  const type = optionValue(values, BLOCK.ptoType);
  const { start, end } = ptoRange(values);

  if (!isPtoType(type)) errors[BLOCK.ptoType] = "Pick vacation or sick day";
  if (!start || !isoDateSchema.safeParse(start).success) errors[BLOCK.ptoStart] = "Pick a date";
  if (!end || !isoDateSchema.safeParse(end).success) errors[BLOCK.ptoEnd] = "Pick a valid end date";
  if (Object.keys(errors).length > 0 || !start || !end || !isPtoType(type)) return { ok: false, errors };

  const span = spanDays(start, end);
  if (span < 1) return { ok: false, errors: { [BLOCK.ptoEnd]: "End date must be on or after the start date" } };
  if (span > MAX_CALENDAR_SPAN) {
    return { ok: false, errors: { [BLOCK.ptoEnd]: `Up to ${MAX_PTO_BUSINESS_DAYS} business days at a time` } };
  }

  const days = businessDaysInRange(start, end, holidays);
  if (days.length === 0) {
    return { ok: false, errors: { [BLOCK.ptoStart]: "That range has only weekends or company holidays" } };
  }
  if (days.length > MAX_PTO_BUSINESS_DAYS) {
    return { ok: false, errors: { [BLOCK.ptoEnd]: `Up to ${MAX_PTO_BUSINESS_DAYS} business days at a time` } };
  }

  const entries = days.map((workDate) => ({
    userId: meta.userId,
    projectId: null,
    workDate,
    hours: 0,
    entryType: type,
    taskSummary: "",
    source: "slack_command" as const,
    slackViewId: viewId,
  }));
  return { ok: true, value: { viewId, userId: meta.userId, kind: "pto", entries, checkin: null } };
}
