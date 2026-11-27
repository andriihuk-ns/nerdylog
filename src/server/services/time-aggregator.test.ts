import { describe, expect, it } from "vitest";
import { aggregateMonth, computeTotals, projectHours, type RollupEntry } from "./time-aggregator";
import { addDays, isWeekend } from "./calendar";

const P1 = "p-dogteampro";
const P2 = "p-cng";
const sv = { id: "u-sv", fullName: "Sviatoslav", dailyNormHours: 8.0 };
const part = { id: "u-part", fullName: "Part Timer", dailyNormHours: 6.0 };

const work = (userId: string, workDate: string, hours: number, projectId = P1): RollupEntry => ({
  userId,
  workDate,
  hours,
  entryType: "work",
  projectId,
});
const pto = (userId: string, workDate: string, entryType: "vacation" | "sick" | "holiday"): RollupEntry => ({
  userId,
  workDate,
  hours: 0,
  entryType,
  projectId: null,
});

function weekdays(month: string): string[] {
  const out: string[] = [];
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) if (!isWeekend(d)) out.push(d);
  return out;
}

describe("aggregateMonth — parity (PRD §7)", () => {
  // Nov 2026 has 21 weekdays: 19 × 8h work + 2 vacation days.
  const days = weekdays("2026-11");
  const vacation = ["2026-11-19", "2026-11-20"];
  const entries = [
    ...days.filter((d) => !vacation.includes(d)).map((d) => work(sv.id, d, 8)),
    ...vacation.map((d) => pto(sv.id, d, "vacation")),
  ];
  const [row] = aggregateMonth("2026-11", [sv], entries);

  it("152.0h / 19.0d / 2 vac-sick days", () => {
    expect(days).toHaveLength(21);
    expect(row.total).toEqual({ hours: 152, days: 19, vacSick: 2, holidays: 0 });
  });

  it("splits into 6 month-weeks whose sums equal the month total", () => {
    expect(row.weeks.map((w) => w.hours)).toEqual([0, 40, 40, 24, 40, 8]);
    expect(row.weeks.map((w) => w.vacSick)).toEqual([0, 0, 0, 2, 0, 0]);
    expect(row.weeks[0]).toMatchObject({ weekIndex: 1, start: "2026-11-01", end: "2026-11-01" });
    expect(row.weeks.reduce((s, w) => s + w.hours, 0)).toBe(row.total.hours);
    expect(row.weeks.reduce((s, w) => s + w.days, 0)).toBeCloseTo(row.total.days, 10);
  });

  it("carries identity fields", () => {
    expect(row).toMatchObject({ userId: sv.id, fullName: "Sviatoslav", dailyNormHours: 8, month: "2026-11" });
  });
});

describe("aggregateMonth — edge cases", () => {
  it("uses a custom 6.0h norm for day-equivalents", () => {
    const [row] = aggregateMonth("2026-11", [part], [work(part.id, "2026-11-02", 6), work(part.id, "2026-11-03", 3)]);
    expect(row.total.hours).toBe(9);
    expect(row.total.days).toBe(1.5);
  });

  it("sums decimal hours exactly", () => {
    const entries = [
      work(sv.id, "2026-11-02", 2.5),
      work(sv.id, "2026-11-02", 2.5, P2),
      work(sv.id, "2026-11-03", 0.1),
      work(sv.id, "2026-11-03", 0.2),
    ];
    const [row] = aggregateMonth("2026-11", [sv], entries);
    expect(row.total.hours).toBe(5.3);
    expect(row.total.days).toBeCloseTo(0.6625, 10);
  });

  it("counts weekend work, including the single-day Week 1 Sunday", () => {
    const [row] = aggregateMonth("2026-11", [sv], [work(sv.id, "2026-11-01", 4), work(sv.id, "2026-11-07", 3)]);
    expect(row.weeks[0].hours).toBe(4);
    expect(row.weeks[1].hours).toBe(3);
    expect(row.total.hours).toBe(7);
  });

  it("excludes entries just outside the month boundaries", () => {
    const entries = [
      work(sv.id, "2026-10-31", 8),
      work(sv.id, "2026-11-30", 8),
      work(sv.id, "2026-12-01", 8),
      pto(sv.id, "2026-12-01", "sick"),
    ];
    const [row] = aggregateMonth("2026-11", [sv], entries);
    expect(row.total).toEqual({ hours: 8, days: 1, vacSick: 0, holidays: 0 });
    expect(row.weeks[5].hours).toBe(8);
  });

  it("counts distinct dates for PTO, not rows", () => {
    const entries = [
      pto(sv.id, "2026-11-10", "vacation"),
      pto(sv.id, "2026-11-10", "vacation"),
      pto(sv.id, "2026-11-10", "sick"),
      pto(sv.id, "2026-11-11", "sick"),
      pto(sv.id, "2026-11-12", "holiday"),
      pto(sv.id, "2026-11-12", "holiday"),
    ];
    const [row] = aggregateMonth("2026-11", [sv], entries);
    expect(row.total).toEqual({ hours: 0, days: 0, vacSick: 2, holidays: 1 });
  });

  it("returns zero rows for users without entries and ignores unknown users", () => {
    const rows = aggregateMonth("2026-11", [sv, part], [work("u-ghost", "2026-11-02", 8), work(part.id, "2026-11-02", 3)]);
    expect(rows.map((r) => r.userId)).toEqual([sv.id, part.id]);
    expect(rows[0].total).toEqual({ hours: 0, days: 0, vacSick: 0, holidays: 0 });
    expect(rows[0].weeks).toHaveLength(6);
    expect(rows[1].total.hours).toBe(3);
  });

  it("isolates users from each other", () => {
    const rows = aggregateMonth("2026-11", [sv, part], [work(sv.id, "2026-11-02", 8), work(part.id, "2026-11-02", 6)]);
    expect(rows[0].total.days).toBe(1);
    expect(rows[1].total.days).toBe(1);
  });

  it("falls back to the 8.0 default for a zero or invalid norm", () => {
    expect(computeTotals([work(sv.id, "2026-11-02", 4)], 0).days).toBe(0.5);
    expect(computeTotals([work(sv.id, "2026-11-02", 4)], Number.NaN).days).toBe(0.5);
  });
});

describe("projectHours (A15)", () => {
  const projects = [
    { id: P1, name: "DogTeamPro" },
    { id: P2, name: "CNG" },
    { id: "p-quiet", name: "Quiet" },
  ];

  it("sums work hours per project within the month; PTO and other months ignored; zero-hour projects omitted", () => {
    const entries = [
      work(sv.id, "2026-11-02", 3.3),
      work(sv.id, "2026-11-30", 2.5),
      work(sv.id, "2026-12-01", 8), // next month
      work(sv.id, "2026-10-31", 8), // previous month
      work(sv.id, "2026-11-03", 5, P2),
      pto(sv.id, "2026-11-06", "vacation"),
    ];
    expect(projectHours("2026-11", projects, entries)).toEqual([
      { projectId: P2, projectName: "CNG", month: "2026-11", hours: 5 },
      { projectId: P1, projectName: "DogTeamPro", month: "2026-11", hours: 5.8 },
    ]);
  });

  it("returns [] without entries", () => {
    expect(projectHours("2026-11", projects, [])).toEqual([]);
  });
});
