import { describe, expect, it } from "vitest";
import { computePtoBalance, yearRange, type PtoUsageRow } from "./pto-balance";

const vac = (workDate: string): PtoUsageRow => ({ workDate, entryType: "vacation" });
const sick = (workDate: string): PtoUsageRow => ({ workDate, entryType: "sick" });

describe("computePtoBalance (A9)", () => {
  it("returns null remaining when the allowance is not set, but still counts usage", () => {
    const b = computePtoBalance("u1", 2026, null, [vac("2026-03-02"), sick("2026-04-01")]);
    expect(b).toEqual({
      userId: "u1",
      year: 2026,
      allowanceDays: null,
      sickAllowanceDays: null,
      vacationUsedDays: 1,
      sickUsedDays: 1,
      remainingDays: null,
      sickRemainingDays: null,
    });
  });

  it("subtracts distinct vacation days from the allowance", () => {
    const b = computePtoBalance("u1", 2026, 20, [vac("2026-03-02"), vac("2026-03-03"), vac("2026-03-04")]);
    expect(b.vacationUsedDays).toBe(3);
    expect(b.remainingDays).toBe(17);
  });

  it("goes negative when vacation exceeds the allowance", () => {
    const b = computePtoBalance("u1", 2026, 2, [vac("2026-03-02"), vac("2026-03-03"), vac("2026-03-04")]);
    expect(b.remainingDays).toBe(-1);
  });

  it("never reduces the allowance for sick days", () => {
    const b = computePtoBalance("u1", 2026, 10, [sick("2026-01-05"), sick("2026-01-06"), vac("2026-02-02")]);
    expect(b.sickUsedDays).toBe(2);
    expect(b.vacationUsedDays).toBe(1);
    expect(b.remainingDays).toBe(9);
  });

  it("subtracts distinct sick days from the sick allowance", () => {
    const b = computePtoBalance("u1", 2026, 10, [sick("2026-01-05"), sick("2026-01-05"), sick("2026-01-06")], 5);
    expect(b.sickUsedDays).toBe(2);
    expect(b.sickRemainingDays).toBe(3);
  });

  it("counts a date logged twice only once", () => {
    const b = computePtoBalance("u1", 2026, 10, [
      vac("2026-05-01"),
      vac("2026-05-01"),
      sick("2026-06-01"),
      sick("2026-06-01"),
    ]);
    expect(b.vacationUsedDays).toBe(1);
    expect(b.sickUsedDays).toBe(1);
    expect(b.remainingDays).toBe(9);
  });

  it("counts a date with both vacation and sick once in each bucket", () => {
    const b = computePtoBalance("u1", 2026, 5, [vac("2026-07-01"), sick("2026-07-01")]);
    expect(b.vacationUsedDays).toBe(1);
    expect(b.sickUsedDays).toBe(1);
    expect(b.remainingDays).toBe(4);
  });

  it("handles decimal allowances without float noise", () => {
    const b = computePtoBalance("u1", 2026, 20.5, [vac("2026-03-02"), vac("2026-03-03"), vac("2026-03-04")]);
    expect(b.remainingDays).toBe(17.5);
    expect(computePtoBalance("u1", 2026, 0.3, [vac("2026-03-02")]).remainingDays).toBe(-0.7);
  });

  it("returns zero usage and the full allowance with no rows", () => {
    expect(computePtoBalance("u1", 2026, 24, []).remainingDays).toBe(24);
  });
});

describe("yearRange", () => {
  it("returns the calendar year bounds", () => {
    expect(yearRange(2026)).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });

  it("rejects non-integer or out-of-range years", () => {
    expect(() => yearRange(2026.5)).toThrow(RangeError);
    expect(() => yearRange(999)).toThrow(RangeError);
    expect(() => yearRange(10000)).toThrow(RangeError);
  });
});
