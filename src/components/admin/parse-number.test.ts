import { describe, expect, it } from "vitest";
import { parseBoundedNumber } from "./parse-number";

describe("parseBoundedNumber", () => {
  it("parses, snaps and bounds", () => {
    expect(parseBoundedNumber("7,5", 0.25, 24, 0.25, false)).toBe(7.5);
    expect(parseBoundedNumber("7.3", 0.25, 24, 0.25, false)).toBe(7.25);
    expect(parseBoundedNumber("25", 0.25, 24, 0.25, false)).toBeUndefined();
    expect(parseBoundedNumber("0", 0.25, 24, 0.25, false)).toBeUndefined();
    expect(parseBoundedNumber("abc", 0, 366, 0.5, true)).toBeUndefined();
  });

  it("maps empty to null only when allowed", () => {
    expect(parseBoundedNumber("", 0, 366, 0.5, true)).toBeNull();
    expect(parseBoundedNumber(" ", 0.25, 24, 0.25, false)).toBeUndefined();
    expect(parseBoundedNumber("20.4", 0, 366, 0.5, true)).toBe(20.5);
  });
});
