import { describe, expect, it } from "vitest";
import { formatCount, formatDays, formatHours, formatPercent, initials, orDot, parseHoursInput } from "./format";

describe("format", () => {
  it("formats hours with one decimal", () => {
    expect(formatHours(2.5)).toBe("2.5");
    expect(formatHours(8)).toBe("8.0");
    expect(formatHours(0)).toBe("0.0");
    expect(formatHours(32.25)).toBe("32.3");
  });

  it("formats days with up to two decimals, at least one", () => {
    expect(formatDays(19)).toBe("19.0");
    expect(formatDays(7.25)).toBe("7.25");
    expect(formatDays(7.5)).toBe("7.5");
    expect(formatDays(1 / 3)).toBe("0.33");
  });

  it("formats counts and percents", () => {
    expect(formatCount(2)).toBe("2");
    expect(formatCount(0.5)).toBe("0.5");
    expect(formatPercent(0.8)).toBe("80%");
    expect(formatPercent(1.087)).toBe("109%");
  });

  it("shows zero as a dot", () => {
    expect(orDot(0, formatHours)).toBe("·");
    expect(orDot(4, formatHours)).toBe("4.0");
  });

  it("builds initials", () => {
    expect(initials("Jane Doe")).toBe("JD");
    expect(initials("  cher ")).toBe("C");
    expect(initials("")).toBe("?");
  });

  it("parses hour input", () => {
    expect(parseHoursInput("2,5")).toEqual({ ok: true, value: 2.5 });
    expect(parseHoursInput("1.1")).toEqual({ ok: true, value: 1 });
    expect(parseHoursInput("1.13")).toEqual({ ok: true, value: 1.25 });
    expect(parseHoursInput("")).toEqual({ ok: true, value: 0 });
    expect(parseHoursInput("25")).toEqual({ ok: false, message: "Max 24h a day" });
    expect(parseHoursInput("-1").ok).toBe(false);
    expect(parseHoursInput("abc").ok).toBe(false);
    expect(parseHoursInput(".").ok).toBe(false);
  });
});
