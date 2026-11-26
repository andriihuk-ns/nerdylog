import { describe, expect, it } from "vitest";
import {
  addDays,
  dayOfWeek,
  isInMonth,
  isoWeek,
  monthRange,
  monthWeeks,
  previousBusinessDay,
} from "./calendar";

const spans = (month: string) => monthWeeks(month).map((w) => `${w.start.slice(8)}-${w.end.slice(8)}`);

describe("monthWeeks (amendment A2)", () => {
  it("Nov 2026: the 1st is a Sunday, so Week 1 is a single day", () => {
    expect(monthWeeks("2026-11")).toEqual([
      { weekIndex: 1, start: "2026-11-01", end: "2026-11-01" },
      { weekIndex: 2, start: "2026-11-02", end: "2026-11-08" },
      { weekIndex: 3, start: "2026-11-09", end: "2026-11-15" },
      { weekIndex: 4, start: "2026-11-16", end: "2026-11-22" },
      { weekIndex: 5, start: "2026-11-23", end: "2026-11-29" },
      { weekIndex: 6, start: "2026-11-30", end: "2026-11-30" },
    ]);
  });

  it("month starting on Monday: Week 1 is a full week", () => {
    expect(spans("2026-06")).toEqual(["01-07", "08-14", "15-21", "22-28", "29-30"]);
  });

  it("month starting on Saturday reaches 6 weeks", () => {
    expect(spans("2026-08")).toEqual(["01-02", "03-09", "10-16", "17-23", "24-30", "31-31"]);
  });

  it("28-day February starting Monday is exactly 4 weeks", () => {
    expect(spans("2027-02")).toEqual(["01-07", "08-14", "15-21", "22-28"]);
  });

  it("leap February ends on the 29th", () => {
    expect(spans("2028-02")).toEqual(["01-06", "07-13", "14-20", "21-27", "28-29"]);
  });

  it("holds invariants for every month 2020-2035", () => {
    for (let year = 2020; year <= 2035; year++) {
      for (let m = 1; m <= 12; m++) {
        const month = `${year}-${String(m).padStart(2, "0")}`;
        const weeks = monthWeeks(month);
        const { start, end } = monthRange(month);
        expect(weeks.length).toBeGreaterThanOrEqual(4);
        expect(weeks.length).toBeLessThanOrEqual(6);
        expect(weeks[0].start).toBe(start);
        expect(weeks.at(-1)?.end).toBe(end);
        weeks.forEach((w, i) => {
          expect(w.weekIndex).toBe(i + 1);
          if (w.end !== end) expect(dayOfWeek(w.end)).toBe(0);
          if (i > 0) {
            expect(w.start).toBe(addDays(weeks[i - 1].end, 1));
            expect(dayOfWeek(w.start)).toBe(1);
          }
        });
      }
    }
  });

  it("rejects malformed months", () => {
    expect(() => monthWeeks("2026-13")).toThrow(RangeError);
    expect(() => monthWeeks("2026-1")).toThrow(RangeError);
  });
});

describe("date helpers", () => {
  it("adds days across month and year boundaries without drift", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30"); // EU DST switch day
  });

  it("validates dates", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => addDays("26-11-01", 1)).toThrow(RangeError);
  });

  it("checks month membership", () => {
    expect(isInMonth("2026-11-30", "2026-11")).toBe(true);
    expect(isInMonth("2026-12-01", "2026-11")).toBe(false);
  });
});

describe("previousBusinessDay", () => {
  const none = new Set<string>();

  it("Monday → Friday", () => {
    expect(previousBusinessDay("2026-11-30", none)).toBe("2026-11-27");
  });

  it("Tuesday → Monday", () => {
    expect(previousBusinessDay("2026-11-24", none)).toBe("2026-11-23");
  });

  it("weekend days resolve to Friday", () => {
    expect(previousBusinessDay("2026-11-29", none)).toBe("2026-11-27");
    expect(previousBusinessDay("2026-11-28", none)).toBe("2026-11-27");
  });

  it("skips holidays, including across a year boundary", () => {
    expect(previousBusinessDay("2026-11-30", new Set(["2026-11-27"]))).toBe("2026-11-26");
    expect(previousBusinessDay("2027-01-04", new Set(["2027-01-01"]))).toBe("2026-12-31");
  });
});

describe("isoWeek", () => {
  it.each([
    ["2026-11-26", 48],
    ["2026-01-01", 1],
    ["2025-12-29", 1],
    ["2024-12-30", 1],
    ["2021-01-01", 53],
    ["2027-01-01", 53],
    ["2026-11-01", 44],
    ["2026-11-02", 45],
  ])("%s → week %i", (date, week) => {
    expect(isoWeek(date)).toBe(week);
  });
});
