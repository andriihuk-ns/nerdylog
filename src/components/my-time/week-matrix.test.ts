import { describe, expect, it } from "vitest";
import type { TimeEntryView } from "@/contracts";
import { weekDays } from "@/components/lib/dates";
import { applyOptimisticEntry, buildWeekMatrix } from "./week-matrix";

const days = weekDays("2026-11-23");
let seq = 0;
function entry(p: Partial<TimeEntryView>): TimeEntryView {
  seq += 1;
  return {
    id: `e${seq}`,
    userId: "u1",
    projectId: "p1",
    projectName: "DogTeamPro",
    workDate: "2026-11-23",
    hours: 4,
    entryType: "work",
    taskSummary: "",
    ticketRefs: [],
    source: "web_ui",
    ...p,
  };
}

describe("buildWeekMatrix", () => {
  it("sums entries per project and day, with totals", () => {
    const m = buildWeekMatrix(days, [
      entry({ hours: 2.5, taskSummary: "Map modal" }),
      entry({ hours: 1.5, taskSummary: "Review" }),
      entry({ projectId: "p2", projectName: "Acme", workDate: "2026-11-24", hours: 8 }),
      entry({ projectId: null, projectName: null, workDate: "2026-11-25", hours: 0, entryType: "sick" }),
      entry({ workDate: "2026-12-01", hours: 3 }), // outside the week
    ]);
    expect(m.rows.map((r) => r.projectName)).toEqual(["Acme", "DogTeamPro"]);
    const dog = m.rows[1];
    expect(dog.cells[0]).toEqual({ hours: 4, notes: ["Map modal", "Review"], entryCount: 2 });
    expect(dog.total).toBe(4);
    expect(m.dayTotals).toEqual([4, 8, 0, 0, 0, 0, 0]);
    expect(m.weekTotal).toBe(12);
    expect(m.dayStatus[2]).toBe("sick");
    expect(m.dayStatus[0]).toBe("work");
  });

  it("keeps pinned projects as empty rows", () => {
    const m = buildWeekMatrix(days, [], [{ id: "p9", name: "Internal" }]);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].total).toBe(0);
    expect(m.weekTotal).toBe(0);
  });
});

describe("applyOptimisticEntry", () => {
  const base = [entry({ hours: 2 }), entry({ hours: 1, taskSummary: "x" }), entry({ workDate: "2026-11-24" })];

  it("collapses a cell edit into one entry", () => {
    const next = applyOptimisticEntry(base, {
      type: "cell",
      date: "2026-11-23",
      project: { id: "p1", name: "DogTeamPro" },
      hours: 5,
    });
    const m = buildWeekMatrix(days, next);
    expect(m.rows[0].cells[0].hours).toBe(5);
    expect(m.rows[0].cells[0].notes).toEqual(["x"]);
    expect(m.rows[0].cells[1].hours).toBe(4);
  });

  it("clears a cell with 0 hours", () => {
    const next = applyOptimisticEntry(base, {
      type: "cell",
      date: "2026-11-23",
      project: { id: "p1", name: "DogTeamPro" },
      hours: 0,
    });
    expect(next.filter((e) => e.workDate === "2026-11-23")).toHaveLength(0);
  });

  it("PTO status removes the day's work and adds one 0h row; work removes PTO", () => {
    const vac = applyOptimisticEntry(base, { type: "status", date: "2026-11-23", status: "vacation" });
    const day = vac.filter((e) => e.workDate === "2026-11-23");
    expect(day).toHaveLength(1);
    expect(day[0]).toMatchObject({ entryType: "vacation", hours: 0, projectId: null });
    const back = applyOptimisticEntry(vac, { type: "status", date: "2026-11-23", status: "work" });
    expect(back.filter((e) => e.workDate === "2026-11-23")).toHaveLength(0);
  });
});
