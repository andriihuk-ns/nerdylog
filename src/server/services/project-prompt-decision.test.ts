import { describe, expect, it } from "vitest";
import {
  DEFAULT_TIMEZONE,
  localClock,
  promptDecision,
  promptTimeSeconds,
  promptWindowCandidates,
  resolvePromptOffice,
  selectPromptTargets,
  type PromptOffice,
  type PromptProject,
} from "./project-prompt-decision";

const none = new Set<string>();
const at = (iso: string) => new Date(iso);
const decide = (iso: string, tz: string, time = "10:00", holidays: ReadonlySet<string> = none) =>
  promptDecision(localClock(at(iso), tz), time, holidays);

const UA: PromptOffice = { id: "ua", code: "UA", timezone: "Europe/Kyiv" };
const PL: PromptOffice = { id: "pl", code: "PL", timezone: "Europe/Warsaw" };
const offices = [UA, PL];
const project = (id: string, officeId: string | null, statusPromptTime = "10:00"): PromptProject => ({
  projectId: id,
  projectName: `P ${id}`,
  slackChannelId: `C${id.toUpperCase()}`,
  statusPromptTime,
  officeId,
});

describe("localClock", () => {
  it("reads wall time, local date and weekday in the zone", () => {
    expect(localClock(at("2026-11-27T08:00:15Z"), "Europe/Kyiv")).toEqual({
      timezone: "Europe/Kyiv",
      date: "2026-11-27",
      secondsOfDay: 10 * 3600 + 15,
      dayOfWeek: 5,
    });
  });

  it("uses the local date when it differs from the UTC date", () => {
    const clock = localClock(at("2026-11-29T22:30:00Z"), "Europe/Kyiv"); // Mon 00:30 Kyiv, Sun in UTC
    expect([clock.date, clock.dayOfWeek]).toEqual(["2026-11-30", 1]);
  });

  it("falls back to Europe/Kyiv for an unknown or empty zone", () => {
    expect(localClock(at("2026-11-27T08:00:00Z"), "Mars/Olympus").timezone).toBe(DEFAULT_TIMEZONE);
    expect(localClock(at("2026-11-27T08:00:00Z"), "").secondsOfDay).toBe(10 * 3600);
  });
});

describe("promptTimeSeconds", () => {
  it("parses HH:MM and falls back to 10:00 for malformed values", () => {
    expect(promptTimeSeconds("00:00")).toBe(0);
    expect(promptTimeSeconds("23:59")).toBe(23 * 3600 + 59 * 60);
    expect(promptTimeSeconds("9:15")).toBe(10 * 3600);
    expect(promptTimeSeconds("24:00")).toBe(10 * 3600);
  });
});

describe("window edges [10:00, 11:30) in Europe/Kyiv (UTC+2 in winter)", () => {
  it.each([
    ["2026-11-27T07:59:59Z", "outside_window"], // 09:59:59
    ["2026-11-27T08:00:00Z", "due"], // 10:00:00 inclusive
    ["2026-11-27T08:45:00Z", "due"], // later cron run catches up
    ["2026-11-27T09:29:59Z", "due"], // 11:29:59
    ["2026-11-27T09:30:00Z", "outside_window"], // 11:30:00 exclusive
  ])("%s → %s", (iso, expected) => {
    expect(decide(iso, "Europe/Kyiv")).toBe(expected);
  });
});

describe("custom prompt times", () => {
  it("09:15 → [09:15, 10:45)", () => {
    expect(decide("2026-11-27T07:14:59Z", "Europe/Kyiv", "09:15")).toBe("outside_window");
    expect(decide("2026-11-27T07:15:00Z", "Europe/Kyiv", "09:15")).toBe("due");
    expect(decide("2026-11-27T08:44:59Z", "Europe/Kyiv", "09:15")).toBe("due");
    expect(decide("2026-11-27T08:45:00Z", "Europe/Kyiv", "09:15")).toBe("outside_window");
  });

  it("a late prompt closes at local midnight instead of spilling into the next day", () => {
    expect(decide("2026-11-26T21:59:59Z", "Europe/Kyiv", "23:30")).toBe("due"); // Thu 23:59:59
    expect(decide("2026-11-26T22:00:00Z", "Europe/Kyiv", "23:30")).toBe("outside_window"); // Fri 00:00
  });

  it("00:00 → [00:00, 01:30)", () => {
    expect(decide("2026-11-26T22:00:00Z", "Europe/Kyiv", "00:00")).toBe("due"); // Fri 00:00 Kyiv
    expect(decide("2026-11-26T23:30:00Z", "Europe/Kyiv", "00:00")).toBe("outside_window"); // 01:30
  });
});

describe("PL vs UA timezone", () => {
  it("08:00Z is 10:00 in Kyiv but 09:00 in Warsaw (winter)", () => {
    expect(decide("2026-11-27T08:00:00Z", "Europe/Kyiv")).toBe("due");
    expect(decide("2026-11-27T08:00:00Z", "Europe/Warsaw")).toBe("outside_window");
    expect(decide("2026-11-27T09:00:00Z", "Europe/Warsaw")).toBe("due");
    expect(decide("2026-11-27T09:30:00Z", "Europe/Kyiv")).toBe("outside_window");
  });
});

describe("DST", () => {
  it("spring forward (29 Mar 2026): 10:00 Kyiv moves from 08:00Z to 07:00Z", () => {
    expect(decide("2026-03-27T08:00:00Z", "Europe/Kyiv")).toBe("due"); // Fri, UTC+2
    expect(decide("2026-03-27T07:00:00Z", "Europe/Kyiv")).toBe("outside_window"); // 09:00
    expect(decide("2026-03-30T07:00:00Z", "Europe/Kyiv")).toBe("due"); // Mon, UTC+3
    expect(decide("2026-03-30T06:59:59Z", "Europe/Kyiv")).toBe("outside_window");
    expect(decide("2026-03-30T08:30:00Z", "Europe/Kyiv")).toBe("outside_window"); // 11:30
  });

  it("fall back (25 Oct 2026): 10:00 Warsaw moves from 08:00Z to 09:00Z", () => {
    expect(decide("2026-10-23T08:00:00Z", "Europe/Warsaw")).toBe("due"); // Fri, UTC+2
    expect(decide("2026-10-26T08:00:00Z", "Europe/Warsaw")).toBe("outside_window"); // Mon 09:00, UTC+1
    expect(decide("2026-10-26T09:00:00Z", "Europe/Warsaw")).toBe("due");
  });
});

describe("weekend and holiday", () => {
  it("Saturday and Sunday are never due", () => {
    expect(decide("2026-11-28T08:00:00Z", "Europe/Kyiv")).toBe("weekend");
    expect(decide("2026-11-29T08:00:00Z", "Europe/Kyiv")).toBe("weekend");
  });

  it("a holiday on the local date is skipped", () => {
    expect(decide("2026-11-27T08:00:00Z", "Europe/Kyiv", "10:00", new Set(["2026-11-27"]))).toBe("holiday");
    expect(decide("2026-11-27T08:00:00Z", "Europe/Kyiv", "10:00", new Set(["2026-11-26"]))).toBe("due");
  });
});

describe("resolvePromptOffice", () => {
  it("project office wins; null or unknown → UA; no UA office → Kyiv with no holidays", () => {
    expect(resolvePromptOffice("pl", offices)).toEqual({ officeId: "pl", timezone: "Europe/Warsaw" });
    expect(resolvePromptOffice(null, offices)).toEqual({ officeId: "ua", timezone: "Europe/Kyiv" });
    expect(resolvePromptOffice("gone", offices)).toEqual({ officeId: "ua", timezone: "Europe/Kyiv" });
    expect(resolvePromptOffice(null, [PL])).toEqual({ officeId: null, timezone: DEFAULT_TIMEZONE });
  });
});

describe("promptWindowCandidates + selectPromptTargets", () => {
  const projects = [project("a", "ua"), project("b", "pl"), project("c", null), project("d", "pl", "09:00")];

  it("picks projects in their office-local window (null office → UA)", () => {
    const c = promptWindowCandidates(at("2026-11-27T08:00:00Z"), projects, offices); // 10:00 Kyiv, 09:00 Warsaw
    expect(c.map((x) => [x.project.projectId, x.officeId])).toEqual([
      ["a", "ua"],
      ["c", "ua"],
      ["d", "pl"],
    ]);
  });

  it("drops projects on their own office's holiday and computes logDate per office", () => {
    const c = promptWindowCandidates(at("2026-11-30T08:00:00Z"), projects, offices); // Mon
    const holidays = new Map([
      ["ua", new Set(["2026-11-27"])], // Friday off in UA
      ["pl", new Set(["2026-11-30"])], // today off in PL
    ]);
    expect(selectPromptTargets(c, holidays)).toEqual([
      { projectId: "a", projectName: "P a", slackChannelId: "CA", localDate: "2026-11-30", logDate: "2026-11-26" },
      { projectId: "c", projectName: "P c", slackChannelId: "CC", localDate: "2026-11-30", logDate: "2026-11-26" },
    ]);
  });

  it("Monday logDate is Friday when there are no holidays", () => {
    const c = promptWindowCandidates(at("2026-11-30T09:00:00Z"), [project("b", "pl")], offices); // 10:00 Warsaw
    expect(selectPromptTargets(c, new Map()).map((t) => [t.localDate, t.logDate])).toEqual([["2026-11-30", "2026-11-27"]]);
  });

  it("nothing on a weekend", () => {
    expect(promptWindowCandidates(at("2026-11-28T08:00:00Z"), projects, offices)).toEqual([]);
  });
});
