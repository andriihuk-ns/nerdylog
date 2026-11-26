import type { TimeEntryView } from "@/contracts";
import { formatHours } from "@/components/lib/format";

/**
 * Turns "this cell should now hold N hours" into service calls. A cell can hold several
 * entries (e.g. two Slack submissions); we keep their provenance and only adjust the first.
 * `note` undefined = leave task notes untouched.
 */
export type CellOp =
  | { op: "create"; hours: number; taskSummary: string }
  | { op: "update"; id: string; hours: number; taskSummary?: string }
  | { op: "delete"; id: string };

export type CellPlan = { ok: true; ops: CellOp[] } | { ok: false; message: string };

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
    return {
      ok: false,
      message: `This cell combines ${existing.length} entries. Enter at least ${formatHours(othersSum)}h, or 0 to clear it.`,
    };
  }
  if (firstHours === 0) return { ok: true, ops: [{ op: "delete", id: first.id }] };
  const update: CellOp = { op: "update", id: first.id, hours: firstHours };
  if (note !== undefined) update.taskSummary = note;
  return { ok: true, ops: [update] };
}
