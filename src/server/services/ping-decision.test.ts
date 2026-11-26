import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  localClock,
  pingDecision,
  selectPingTargets,
  windowCandidates,
  type PingUser,
} from "./ping-decision";

const none = new Set<string>();
const at = (iso: string) => new Date(iso);
const decide = (iso: string, tz: string, holidays = none, off = none) =>
  pingDecision(localClock(at(iso), tz), holidays, off);

describe("localClock", () => {
  it("reads wall time and local date in the user's zone", () => {
    expect(localClock(at("2026-11-27T07:30:15Z"), "Europe/Kyiv")).toEqual({
      timezone: "Europe/Kyiv",
      date: "2026-11-27",
      secondsOfDay: 9 * 3600 + 30 * 60 + 15,
      dayOfWeek: 5,
    });
  });

  it("uses the local date when it differs from the UTC date", () => {
    // Monday 09:30 in Auckland (UTC+13) is still Sunday in UTC.
    const clock = localClock(at("2026-11-29T20:30:00Z"), "Pacific/Auckland");
    expect(clock.date).toBe("2026-11-30");
    expect(clock.dayOfWeek).toBe(1);
  });

  it("falls back to Europe/Kyiv for an unknown or empty zone", () => {
    expect(localClock(at("2026-11-27T07:30:00Z"), "Mars/Olympus").timezone).toBe(DEFAULT_TIMEZONE);
    expect(localClock(at("2026-11-27T07:30:00Z"), "").secondsOfDay).toBe(9 * 3600 + 30 * 60);
  });
});

describe("pingDecision window edges (Europe/Kyiv, UTC+2 in winter)", () => {
  it.each([
    ["2026-11-27T07:29:59Z", "outside_window"], // 09:29:59
    ["2026-11-27T07:30:00Z", "due"], // 09:30:00 inclusive
    ["2026-11-27T07:44:59Z", "due"], // 09:44:59
    ["2026-11-27T07:45:00Z", "outside_window"], // 09:45:00 exclusive
  ])("%s → %s", (iso, expected) => {
    expect(decide(iso, "Europe/Kyiv")).toBe(expected);
  });
});

describe("pingDecision window edges (America/New_York, UTC-5 in winter)", () => {
  it.each([
    ["2026-11-27T14:29:59Z", "outside_window"],
    ["2026-11-27T14:30:00Z", "due"],
    ["2026-11-27T14:44:59Z", "due"],
    ["2026-11-27T14:45:00Z", "outside_window"],
  ])("%s → %s", (iso, expected) => {
    expect(decide(iso, "America/New_York")).toBe(expected);
  });
});

describe("DST transitions", () => {
  it("Kyiv: 09:30 is 07:30Z before the March switch and 06:30Z after it", () => {
    expect(decide("2026-03-27T07:30:00Z", "Europe/Kyiv")).toBe("due"); // Fri, EET
    expect(decide("2026-03-27T06:30:00Z", "Europe/Kyiv")).toBe("outside_window"); // 08:30
    expect(decide("2026-03-30T06:30:00Z", "Europe/Kyiv")).toBe("due"); // Mon, EEST
    expect(decide("2026-03-30T07:30:00Z", "Europe/Kyiv")).toBe("outside_window"); // 10:30
  });

  it("Kyiv: transition day (Sun 2026-03-29) reads 09:30 correctly but is a weekend", () => {
    const clock = localClock(at("2026-03-29T06:30:00Z"), "Europe/Kyiv");
    expect(clock.secondsOfDay).toBe(9 * 3600 + 30 * 60);
    expect(pingDecision(clock, none, none)).toBe("weekend");
  });

  it("Kyiv: October fall-back moves 09:30 back to 07:30Z", () => {
    expect(decide("2026-10-23T06:30:00Z", "Europe/Kyiv")).toBe("due"); // Fri, EEST
    expect(decide("2026-10-26T07:30:00Z", "Europe/Kyiv")).toBe("due"); // Mon, EET
    expect(decide("2026-10-26T06:30:00Z", "Europe/Kyiv")).toBe("outside_window");
  });

  it("New York: March spring-forward (Sun 2026-03-08)", () => {
    expect(decide("2026-03-06T14:30:00Z", "America/New_York")).toBe("due"); // Fri, EST
    expect(decide("2026-03-08T13:30:00Z", "America/New_York")).toBe("weekend"); // 09:30 EDT, Sunday
    expect(decide("2026-03-09T13:30:00Z", "America/New_York")).toBe("due"); // Mon, EDT
    expect(decide("2026-03-09T14:30:00Z", "America/New_York")).toBe("outside_window"); // 10:30
  });

  it("New York: November fall-back (Sun 2026-11-01)", () => {
    expect(decide("2026-10-30T13:30:00Z", "America/New_York")).toBe("due"); // Fri, EDT
    expect(decide("2026-11-02T14:30:00Z", "America/New_York")).toBe("due"); // Mon, EST
    expect(decide("2026-11-02T13:30:00Z", "America/New_York")).toBe("outside_window"); // 08:30
  });
});

describe("pingDecision skip rules", () => {
  it("skips Saturday and Sunday in local time", () => {
    expect(decide("2026-11-28T07:30:00Z", "Europe/Kyiv")).toBe("weekend");
    expect(decide("2026-11-29T07:30:00Z", "Europe/Kyiv")).toBe("weekend");
  });

  it("judges the weekday by local date, not UTC", () => {
    // Saturday 09:30 in Auckland is Friday 20:30Z: weekend for the user.
    expect(decide("2026-11-27T20:30:00Z", "Pacific/Auckland")).toBe("weekend");
    expect(decide("2026-11-29T20:30:00Z", "Pacific/Auckland")).toBe("due");
  });

  it("skips company holidays", () => {
    expect(decide("2026-12-25T07:30:00Z", "Europe/Kyiv", new Set(["2026-12-25"]))).toBe("holiday");
  });

  it("skips users with a PTO row that local day", () => {
    expect(decide("2026-11-27T07:30:00Z", "Europe/Kyiv", none, new Set(["2026-11-27"]))).toBe("pto");
    expect(decide("2026-11-27T07:30:00Z", "Europe/Kyiv", none, new Set(["2026-11-26"]))).toBe("due");
  });

  it("checks the window before the calendar (outside window wins)", () => {
    expect(decide("2026-11-28T10:00:00Z", "Europe/Kyiv", new Set(["2026-11-28"]))).toBe("outside_window");
  });
});

describe("windowCandidates + selectPingTargets", () => {
  const users: PingUser[] = [
    { userId: "kyiv", slackUserId: "U1", fullName: "Name U1", timezone: "Europe/Kyiv" },
    { userId: "ny", slackUserId: "U2", fullName: "Name U2", timezone: "America/New_York" },
    { userId: "kyiv-pto", slackUserId: "U3", fullName: "Name U3", timezone: "Europe/Kyiv" },
  ];

  it("keeps only users inside their local window", () => {
    const ids = windowCandidates(at("2026-11-30T07:30:00Z"), users).map((c) => c.user.userId);
    expect(ids).toEqual(["kyiv", "kyiv-pto"]);
  });

  it("drops PTO users and logs the previous business day (Mon → Fri)", () => {
    const candidates = windowCandidates(at("2026-11-30T07:30:00Z"), users);
    const targets = selectPingTargets(candidates, none, new Map([["kyiv-pto", new Set(["2026-11-30"])]]));
    expect(targets).toEqual([
      { userId: "kyiv", slackUserId: "U1", fullName: "Name U1", timezone: "Europe/Kyiv", localDate: "2026-11-30", logDate: "2026-11-27" },
    ]);
  });

  it("skips a Friday holiday when computing the log date", () => {
    const candidates = windowCandidates(at("2026-11-30T07:30:00Z"), users.slice(0, 1));
    const [target] = selectPingTargets(candidates, new Set(["2026-11-27"]), new Map());
    expect(target.logDate).toBe("2026-11-26");
  });
});
