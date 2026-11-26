import { describe, expect, it } from "vitest";
import { hasBlocker, toCheckinView } from "./checkin-view";

describe("hasBlocker", () => {
  it.each(["", "   ", "none", "None", " NONE ", "no", "No", "-", " - "])("%j is not a blocker", (text) => {
    expect(hasBlocker(text)).toBe(false);
  });

  it.each(["Waiting on API keys", "no access to staging", "none yet, maybe later", "--"])("%j is a blocker", (text) => {
    expect(hasBlocker(text)).toBe(true);
  });
});

describe("toCheckinView", () => {
  it("maps the Stream B row and flags blockers", () => {
    expect(
      toCheckinView({
        userId: "u1",
        checkinDate: "2026-11-27",
        plannedToday: "Handler mobile flow",
        blockers: "Design review pending",
        fullName: "Sviatoslav",
        avatarUrl: null,
      }),
    ).toEqual({
      userId: "u1",
      checkinDate: "2026-11-27",
      plannedToday: "Handler mobile flow",
      blockers: "Design review pending",
      fullName: "Sviatoslav",
      avatarUrl: null,
      hasBlocker: true,
    });
  });
});
