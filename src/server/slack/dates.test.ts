import { describe, expect, it } from "vitest";
import { businessDaysInRange, firstName, formatHours, localIsoDate, mondayOf, spanDays } from "./dates";
import { decodeMetadata, encodeMetadata } from "./metadata";
import { toDirectoryMembers } from "./directory-members";

describe("dates", () => {
  it("derives the local date from the user's timezone", () => {
    const now = new Date("2026-11-26T22:30:00Z");
    expect(localIsoDate(now, "Europe/Kyiv")).toBe("2026-11-27");
    expect(localIsoDate(now, "America/New_York")).toBe("2026-11-26");
    expect(localIsoDate(now, "Not/AZone")).toBe("2026-11-27");
  });

  it("week, span and business-day helpers", () => {
    expect(mondayOf("2026-11-29")).toBe("2026-11-23");
    expect(mondayOf("2026-11-23")).toBe("2026-11-23");
    expect(spanDays("2026-11-01", "2026-11-03")).toBe(3);
    expect(businessDaysInRange("2026-11-27", "2026-11-30", new Set())).toEqual(["2026-11-27", "2026-11-30"]);
  });

  it("formats hours and names", () => {
    expect(formatHours(4)).toBe("4h");
    expect(formatHours(2.5)).toBe("2.5h");
    expect(firstName("  Olena Petrenko ")).toBe("Olena");
  });
});

describe("metadata", () => {
  it("round-trips and rejects tampering", () => {
    const meta = {
      kind: "log" as const,
      logDate: "2026-11-25",
      userId: "7f0c1a52-8f1e-4c1b-9a35-3b1f8f0f6a01",
      today: "2026-11-26",
      rows: 2,
    };
    expect(decodeMetadata(encodeMetadata(meta))).toEqual(meta);
    expect(decodeMetadata('{"kind":"admin"}')).toBeNull();
    expect(decodeMetadata("not json")).toBeNull();
    expect(decodeMetadata(undefined)).toBeNull();
  });
});

describe("toDirectoryMembers", () => {
  it("keeps people only and maps profile fields", () => {
    const members = toDirectoryMembers([
      { id: "U1", real_name: "Olena", tz: "Europe/Kyiv", profile: { email: "o@x.io", image_192: "https://i/1.png" } },
      { id: "U2", is_bot: true },
      { id: "U3", deleted: true },
      { id: "USLACKBOT" },
      { id: "U4", is_restricted: true },
      { id: "U5", is_ultra_restricted: true },
      { id: "U6", is_app_user: true },
      { id: "U7", name: "andrii", profile: {} },
    ]);
    expect(members).toEqual([
      { slackUserId: "U1", fullName: "Olena", email: "o@x.io", avatarUrl: "https://i/1.png", timezone: "Europe/Kyiv" },
      { slackUserId: "U7", fullName: "andrii", email: null, avatarUrl: null, timezone: null },
    ]);
  });
});
