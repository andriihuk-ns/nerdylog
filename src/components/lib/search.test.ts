import { describe, expect, it } from "vitest";
import { matchesQuery } from "./search";

describe("matchesQuery", () => {
  it("matches every word in any field, case-insensitive", () => {
    expect(matchesQuery(["Olena Koval", "olena@x.io", "Designer"], "olena design")).toBe(true);
    expect(matchesQuery(["Olena Koval", null], "KOVAL")).toBe(true);
    expect(matchesQuery(["Olena Koval"], "olena petrenko")).toBe(false);
  });

  it("treats an empty query as a match", () => {
    expect(matchesQuery(["anything"], "   ")).toBe(true);
  });

  it("ignores accents and works with Cyrillic", () => {
    expect(matchesQuery(["José"], "jose")).toBe(true);
    expect(matchesQuery(["Андрій Гук"], "андрій")).toBe(true);
  });
});
