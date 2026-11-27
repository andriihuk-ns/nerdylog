import { describe, expect, it } from "vitest";
import { displayDayStatus } from "./day-status";

describe("displayDayStatus (A16 weekend)", () => {
  it("shows Weekend for an empty Sat/Sun work day", () => {
    expect(displayDayStatus("work", true, 0, false)).toBe("weekend");
  });
  it("shows Work once unlocked or once hours exist", () => {
    expect(displayDayStatus("work", true, 0, true)).toBe("work");
    expect(displayDayStatus("work", true, 2, false)).toBe("work");
  });
  it("keeps time-off statuses and weekdays as they are", () => {
    expect(displayDayStatus("vacation", true, 0, false)).toBe("vacation");
    expect(displayDayStatus("work", false, 0, false)).toBe("work");
  });
});
