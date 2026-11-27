import { describe, expect, it } from "vitest";
import { parseTimeOfDay, roundToQuarter } from "./prompt-time";

describe("prompt time (A29)", () => {
  it("accepts common ways of typing a time", () => {
    expect(["9", "930", "9:30", "09.30", " 23:59 "].map(parseTimeOfDay)).toEqual(["09:00", "09:30", "09:30", "09:30", "23:59"]);
    expect(["", "24:00", "10:60", "ab", "10:3"].map(parseTimeOfDay)).toEqual([null, null, null, null, null]);
  });

  it("rounds to the nearest quarter without leaving the day", () => {
    expect(["10:23", "10:22", "14:14", "10:00", "10:53", "23:59"].map(roundToQuarter)).toEqual([
      "10:30", "10:15", "14:15", "10:00", "11:00", "23:45",
    ]);
  });
});
