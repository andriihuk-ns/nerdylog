import { describe, expect, it } from "vitest";
import type { LedgerRow } from "@/server/db/queries/ledger";
import { buildReportModel } from "./report-model";
import { renderReportPdf } from "./render";

const row = (over: Partial<LedgerRow>): LedgerRow => ({
  workDate: "2026-11-02",
  userId: "u1",
  fullName: "Zed",
  dailyNormHours: 8,
  projectId: "p1",
  projectName: "DogTeamPro",
  entryType: "work",
  hours: 4,
  taskSummary: "Task",
  ticketRefs: [],
  source: "web_ui",
  ...over,
});

const opts = { from: "2026-10-26", to: "2026-11-30", generatedOn: "2026-11-26", projectNames: [] };

const rows: LedgerRow[] = [
  row({ workDate: "2026-11-03", hours: 6, ticketRefs: ["DOG-1", "DOG-2"] }),
  row({ workDate: "2026-10-30", hours: 2 }),
  row({ workDate: "2026-11-04", entryType: "vacation", hours: 0, projectId: null, projectName: null }),
  row({ workDate: "2026-11-04", entryType: "vacation", hours: 0, projectId: null, projectName: null }),
  row({ workDate: "2026-11-05", entryType: "sick", hours: 0, projectId: null, projectName: null }),
  row({ userId: "u2", fullName: "Ann", dailyNormHours: 4, hours: 4 }),
];

describe("buildReportModel", () => {
  it("groups by employee (sorted by name) with entries sorted by date", () => {
    const model = buildReportModel(rows, opts);
    expect(model.employees.map((e) => e.fullName)).toEqual(["Ann", "Zed"]);
    expect(model.employees[1].entries.map((e) => e.date)).toEqual([
      "2026-10-30",
      "2026-11-03",
      "2026-11-04",
      "2026-11-04",
      "2026-11-05",
    ]);
    expect(model.employees[1].entries[1].tickets).toBe("DOG-1, DOG-2");
  });

  it("computes monthly totals with the rollup math and a distinct-day PTO summary", () => {
    const zed = buildReportModel(rows, opts).employees[1];
    expect(zed.months).toEqual([
      { month: "2026-10", hours: 2, days: 0.25, vacSick: 0, holidays: 0 },
      { month: "2026-11", hours: 6, days: 0.75, vacSick: 2, holidays: 0 },
    ]);
    expect(zed.total).toEqual({ hours: 8, days: 1, vacSick: 2, holidays: 0 });
    expect(zed.pto).toEqual({ vacation: 1, sick: 1, holiday: 0 });
  });

  it("sums grand totals using each employee's own norm", () => {
    const model = buildReportModel(rows, opts);
    expect(model.totalHours).toBe(12);
    expect(model.totalDays).toBe(2); // Zed 8h/8 + Ann 4h/4
    expect(model.scope).toBe("All projects");
    expect(buildReportModel([], { ...opts, projectNames: ["A", "B"] }).scope).toBe("A, B");
  });
});

describe("renderReportPdf", () => {
  it("renders a PDF document (smoke test)", async () => {
    const bytes = await renderReportPdf(buildReportModel(rows, opts));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(1000);
  }, 20_000);

  it("renders an empty report", async () => {
    const bytes = await renderReportPdf(buildReportModel([], opts));
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  }, 20_000);
});
