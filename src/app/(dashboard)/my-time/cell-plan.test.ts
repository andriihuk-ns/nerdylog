import { describe, expect, it } from "vitest";
import type { TimeEntryView } from "@/contracts";
import { planCellSave } from "./cell-plan";

const e = (id: string, hours: number): TimeEntryView => ({
  id,
  userId: "u1",
  projectId: "p1",
  projectName: "DogTeamPro",
  workDate: "2026-11-23",
  hours,
  entryType: "work",
  taskSummary: "",
  ticketRefs: [],
  source: "slack_standup",
});

describe("planCellSave", () => {
  it("creates when the cell is empty", () => {
    expect(planCellSave([], 2.5, "Map modal")).toEqual({
      ok: true,
      ops: [{ op: "create", hours: 2.5, taskSummary: "Map modal" }],
    });
    expect(planCellSave([], 0)).toEqual({ ok: true, ops: [] });
  });

  it("updates a single entry and leaves the note alone unless given", () => {
    expect(planCellSave([e("a", 2)], 4)).toEqual({ ok: true, ops: [{ op: "update", id: "a", hours: 4 }] });
    expect(planCellSave([e("a", 2)], 4, "")).toEqual({
      ok: true,
      ops: [{ op: "update", id: "a", hours: 4, taskSummary: "" }],
    });
  });

  it("deletes everything on 0", () => {
    expect(planCellSave([e("a", 2), e("b", 1)], 0)).toEqual({
      ok: true,
      ops: [
        { op: "delete", id: "a" },
        { op: "delete", id: "b" },
      ],
    });
  });

  it("adjusts only the first entry of a multi-entry cell", () => {
    expect(planCellSave([e("a", 2), e("b", 1.5)], 5)).toEqual({
      ok: true,
      ops: [{ op: "update", id: "a", hours: 3.5 }],
    });
    expect(planCellSave([e("a", 2), e("b", 1.5)], 1.5)).toEqual({ ok: true, ops: [{ op: "delete", id: "a" }] });
    const below = planCellSave([e("a", 2), e("b", 1.5)], 1);
    expect(below.ok).toBe(false);
  });
});
