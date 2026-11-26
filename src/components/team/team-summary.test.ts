import { describe, expect, it } from "vitest";
import type { CheckinView, UserMonthRollup } from "@/contracts";
import { bucketValues, groupStandups, teamHref, teamTotals } from "./team-summary";

const row = (userId: string, hours: number[], vacSick = 0): UserMonthRollup => ({
  userId,
  fullName: userId,
  dailyNormHours: 8,
  month: "2026-11",
  weeks: hours.map((h, i) => ({
    weekIndex: i + 1,
    start: "2026-11-01",
    end: "2026-11-01",
    hours: h,
    days: h / 8,
    vacSick: i === 0 ? vacSick : 0,
    holidays: 0,
  })),
  total: {
    hours: hours.reduce((s, h) => s + h, 0),
    days: hours.reduce((s, h) => s + h, 0) / 8,
    vacSick,
    holidays: 0,
  },
});

describe("teamTotals", () => {
  it("sums each month-week and the month", () => {
    const t = teamTotals([row("a", [8, 40]), row("b", [4, 20], 1)], 2);
    expect(t.weeks[0]).toEqual({ hours: 12, days: 1.5, vacSick: 1, holidays: 0 });
    expect(t.weeks[1].hours).toBe(60);
    expect(t.total).toEqual({ hours: 72, days: 9, vacSick: 1, holidays: 0 });
    expect(bucketValues(t.total)).toEqual([72, 9, 1, 0]);
  });

  it("handles an empty team", () => {
    expect(teamTotals([], 3).weeks).toHaveLength(3);
  });
});

describe("teamHref", () => {
  it("builds month and drawer urls", () => {
    expect(teamHref("2026-11")).toBe("/team?month=2026-11");
    expect(teamHref("2026-11", "2026-11-24")).toBe("/team?month=2026-11&date=2026-11-24");
  });
});

describe("groupStandups", () => {
  const c = (userId: string, fullName: string, blockers = ""): CheckinView => ({
    userId,
    fullName,
    avatarUrl: null,
    checkinDate: "2026-11-24",
    plannedToday: "Plan",
    blockers,
    hasBlocker: blockers !== "",
  });

  it("orders blockers, plans and missing teammates", () => {
    const g = groupStandups(
      [c("2", "Zoe", "Waiting on API"), c("1", "Adam")],
      [
        { userId: "1", fullName: "Adam" },
        { userId: "2", fullName: "Zoe" },
        { userId: "3", fullName: "Mia" },
        { userId: "4", fullName: "Bo" },
      ],
    );
    expect(g.blockers.map((x) => x.fullName)).toEqual(["Zoe"]);
    expect(g.plans.map((x) => x.fullName)).toEqual(["Adam", "Zoe"]);
    expect(g.missing.map((x) => x.fullName)).toEqual(["Bo", "Mia"]);
  });
});
