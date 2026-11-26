import type { TimeEntryView } from "@/contracts";

/**
 * Turns "this cell should now hold N hours" into service calls. A cell can hold several
 * entries (e.g. two Slack submissions); we keep their provenance and only adjust the first.
 * `note` undefined = leave task notes untouched.
 */
export type CellOp =
  | { op: "create"; hours: number; taskSummary: string }
  | { op: "update"; id: string; hours: number; taskSummary?: string }
  | { op: "delete"; id: string };

/** `below`: the other entries already exceed the target; the caller turns it into copy (A14). */
export type CellPlan = { ok: true; ops: CellOp[] } | { ok: false; reason: "below"; entryCount: number; minHours: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function planCellSave(existing: readonly TimeEntryView[], hours: number, note?: string): CellPlan {
  const [first, ...others] = existing;
  if (!first) {
    return { ok: true, ops: hours > 0 ? [{ op: "create", hours, taskSummary: note ?? "" }] : [] };
  }
  if (hours === 0) return { ok: true, ops: existing.map((e) => ({ op: "delete", id: e.id }) as const) };

  const othersSum = round2(others.reduce((s, e) => s + e.hours, 0));
  const firstHours = round2(hours - othersSum);
  if (firstHours < 0) {
    return { ok: false, reason: "below", entryCount: existing.length, minHours: othersSum };
  }
  if (firstHours === 0) return { ok: true, ops: [{ op: "delete", id: first.id }] };
  const update: CellOp = { op: "update", id: first.id, hours: firstHours };
  if (note !== undefined) update.taskSummary = note;
  return { ok: true, ops: [update] };
}
