import { describe, expect, it } from "vitest";
import {
  addDays,
  dayHead,
  formatDayLong,
  formatMonth,
  formatShortRange,
  formatWeekRange,
  isIsoDate,
  isWeekend,
  lastDayOfMonth,
  mondayOf,
  monthForWeek,
  parseDateParam,
  parseMonthParam,
  parseWeekParam,
  shiftMonth,
  todayIn,
  weekDays,
} from "./dates";

describe("dates", () => {
  it("validates ISO dates strictly", () => {
    expect(isIsoDate("2026-11-26")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-11-2026")).toBe(false);
    expect(isIsoDate(["2026-11-26"])).toBe(false);
  });

  it("finds the Monday and the seven days of a week", () => {
    expect(mondayOf("2026-11-26")).toBe("2026-11-23");
    expect(mondayOf("2026-11-29")).toBe("2026-11-23");
    expect(mondayOf("2026-11-23")).toBe("2026-11-23");
    expect(weekDays("2026-11-30")).toEqual([
      "2026-11-30",
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
      "2026-12-06",
    ]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(isWeekend("2026-11-28")).toBe(true);
    expect(isWeekend("2026-11-27")).toBe(false);
  });

  it("parses search params with safe fallbacks", () => {
    expect(parseWeekParam("2026-11-26", "2026-01-01")).toBe("2026-11-23");
    expect(parseWeekParam("junk", "2026-11-26")).toBe("2026-11-23");
    expect(parseWeekParam(undefined, "2026-11-26")).toBe("2026-11-23");
    expect(parseMonthParam("2026-13", "2026-11-26")).toBe("2026-11");
    expect(parseMonthParam("2026-02", "2026-11-26")).toBe("2026-02");
    expect(parseDateParam("2026-11-24")).toBe("2026-11-24");
    expect(parseDateParam("x")).toBeNull();
  });

  it("picks the cap month for a week", () => {
    expect(monthForWeek("2026-11-30", "2026-12-01")).toBe("2026-12");
    expect(monthForWeek("2026-11-30", "2026-11-30")).toBe("2026-11");
    expect(monthForWeek("2026-11-30", "2027-01-15")).toBe("2026-12");
    expect(monthForWeek("2026-10-26", "2027-01-15")).toBe("2026-10");
  });

  it("shifts months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
  });

  it("computes today in a timezone", () => {
    const lateUtc = new Date("2026-11-26T23:30:00Z");
    expect(todayIn("Europe/Kyiv", lateUtc)).toBe("2026-11-27");
    expect(todayIn("UTC", lateUtc)).toBe("2026-11-26");
  });

  it("formats ranges and labels", () => {
    expect(formatWeekRange("2026-11-23", "2026-11-29")).toBe("Nov 23 – 29, 2026");
    expect(formatWeekRange("2026-11-30", "2026-12-06")).toBe("Nov 30 – Dec 6, 2026");
    expect(formatWeekRange("2026-12-28", "2027-01-03")).toBe("Dec 28, 2026 – Jan 3, 2027");
    expect(formatShortRange("2026-11-01", "2026-11-01")).toBe("Nov 1");
    expect(formatShortRange("2026-11-02", "2026-11-08")).toBe("Nov 2–8");
    expect(formatMonth("2026-11")).toBe("November 2026");
    expect(dayHead("2026-11-24")).toEqual({ weekday: "Tue", day: 24 });
    expect(formatDayLong("2026-11-24")).toBe("Tue, Nov 24");
  });
});
