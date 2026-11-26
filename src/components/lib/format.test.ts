import { describe, expect, it } from "vitest";
import { formatCount, formatDays, formatHours, formatPercent, initials, normalizeDecimal, orDot, parseHoursInput } from "./format";

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

  it("uses the Ukrainian decimal comma (A14)", () => {
    expect(formatHours(2.5, "uk")).toBe("2,5");
    expect(formatHours(8, "uk")).toBe("8,0");
    expect(formatDays(7.25, "uk")).toBe("7,25");
    expect(formatCount(0.5, "uk")).toBe("0,5");
    expect(formatHours(1234.5, "uk")).toBe("1234,5"); // no grouping: the value can be typed back
    expect(formatHours(1234.5, "en")).toBe("1234.5");
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

  it("parses hour input with a dot or a comma", () => {
    expect(parseHoursInput("2.5")).toEqual({ ok: true, value: 2.5 });
    expect(parseHoursInput("2,5")).toEqual({ ok: true, value: 2.5 });
    expect(parseHoursInput(" 7,75 ")).toEqual({ ok: true, value: 7.75 });
    expect(parseHoursInput(",5")).toEqual({ ok: true, value: 0.5 });
    expect(parseHoursInput(formatHours(2.5, "uk"))).toEqual({ ok: true, value: 2.5 });
    expect(parseHoursInput("2,5,1")).toEqual({ ok: false, error: "invalid" });
    expect(parseHoursInput("1.1")).toEqual({ ok: true, value: 1 });
    expect(parseHoursInput("1.13")).toEqual({ ok: true, value: 1.25 });
    expect(parseHoursInput("")).toEqual({ ok: true, value: 0 });
    expect(parseHoursInput("25")).toEqual({ ok: false, error: "max" });
    expect(parseHoursInput("24,5")).toEqual({ ok: false, error: "max" });
    expect(parseHoursInput("-1").ok).toBe(false);
    expect(parseHoursInput("abc").ok).toBe(false);
    expect(parseHoursInput(".").ok).toBe(false);
    expect(parseHoursInput(",").ok).toBe(false);
  });

  it("normalises decimal input", () => {
    expect(normalizeDecimal("2,5")).toBe("2.5");
    expect(normalizeDecimal("1\u00a0234,5")).toBe("1234.5");
    expect(normalizeDecimal(" 8 ")).toBe("8");
  });
});
