import { type EntryType, type IsoDate, type TimeEntryView } from "@/contracts";

/** Pure model for the /my-time weekly matrix (docs/05 §6.2). Stream A only. */

export interface MatrixCell {
  hours: number;
  notes: string[];
  entryCount: number;
}

export interface MatrixRow {
  projectId: string;
  projectName: string;
  cells: MatrixCell[]; // one per day, Mon–Sun
  total: number;
}

export interface WeekMatrix {
  days: IsoDate[];
  rows: MatrixRow[];
  dayStatus: EntryType[]; // "work" unless a PTO row exists that day
  dayTotals: number[];
  weekTotal: number;
}

export interface ProjectRef {
  id: string;
  name: string;
}

/** A15 add-project picker entry: non-members see it disabled with the reason ("Ask {creator}…"). */
export interface ProjectOption extends ProjectRef {
  disabledReason: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Day status for one date: the first non-work entry type wins, else "work". */
export function statusForDay(entries: readonly TimeEntryView[], date: IsoDate): EntryType {
  return entries.find((e) => e.workDate === date && e.entryType !== "work")?.entryType ?? "work";
}

export function buildWeekMatrix(
  days: readonly IsoDate[],
  entries: readonly TimeEntryView[],
  pinned: readonly ProjectRef[] = [],
): WeekMatrix {
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const rowsById = new Map<string, MatrixRow>();
  const ensureRow = (id: string, name: string) => {
    let row = rowsById.get(id);
    if (!row) {
      row = {
        projectId: id,
        projectName: name,
        cells: days.map(() => ({ hours: 0, notes: [], entryCount: 0 })),
        total: 0,
      };
      rowsById.set(id, row);
    }
    return row;
  };

  for (const e of entries) {
    const i = dayIndex.get(e.workDate);
    if (i === undefined || e.entryType !== "work" || !e.projectId) continue;
    const cell = ensureRow(e.projectId, e.projectName ?? "" /* the grid shows myTime.unknownProject */).cells[i];
    cell.hours = round2(cell.hours + e.hours);
    cell.entryCount += 1;
    if (e.taskSummary.trim()) cell.notes.push(e.taskSummary);
  }
  for (const p of pinned) ensureRow(p.id, p.name);

  const rows = [...rowsById.values()].sort((a, b) => a.projectName.localeCompare(b.projectName));
  for (const row of rows) row.total = round2(row.cells.reduce((s, c) => s + c.hours, 0));
  const dayTotals = days.map((_, i) => round2(rows.reduce((s, r) => s + r.cells[i].hours, 0)));

  return {
    days: [...days],
    rows,
    dayStatus: days.map((d) => statusForDay(entries, d)),
    dayTotals,
    weekTotal: round2(dayTotals.reduce((s, n) => s + n, 0)),
  };
}

export type OptimisticEntryAction =
  | { type: "cell"; date: IsoDate; project: ProjectRef; hours: number; note?: string }
  | { type: "status"; date: IsoDate; status: EntryType };

/**
 * useOptimistic reducer: mirrors the server semantics closely enough for display.
 * A cell edit collapses that cell into one synthetic entry; a PTO status clears the day's work.
 */
export function applyOptimisticEntry(entries: TimeEntryView[], action: OptimisticEntryAction): TimeEntryView[] {
  if (action.type === "status") {
    const others = entries.filter((e) => e.workDate !== action.date);
    const sameDay = entries.filter((e) => e.workDate === action.date);
    if (action.status === "work") return [...others, ...sameDay.filter((e) => e.entryType === "work")];
    const userId = sameDay[0]?.userId ?? entries[0]?.userId ?? "";
    return [...others, synthetic(userId, action.date, null, null, 0, action.status, "")];
  }
  const inCell = (e: TimeEntryView) =>
    e.workDate === action.date && e.entryType === "work" && e.projectId === action.project.id;
  const previous = entries.filter(inCell);
  const rest = entries.filter((e) => !inCell(e));
  if (action.hours === 0) return rest;
  const note = action.note ?? previous.map((e) => e.taskSummary).filter(Boolean).join("\n");
  const userId = previous[0]?.userId ?? entries[0]?.userId ?? "";
  return [...rest, synthetic(userId, action.date, action.project.id, action.project.name, action.hours, "work", note)];
}

function synthetic(
  userId: string,
  workDate: IsoDate,
  projectId: string | null,
  projectName: string | null,
  hours: number,
  entryType: EntryType,
  taskSummary: string,
): TimeEntryView {
  return {
    id: `optimistic-${workDate}-${projectId ?? entryType}`,
    userId,
    projectId,
    projectName,
    workDate,
    hours,
    entryType,
    taskSummary,
    ticketRefs: [],
    source: "web_ui",
  };
}
