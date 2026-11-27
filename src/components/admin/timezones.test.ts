import { describe, expect, it } from "vitest";
import { cityName, filterTimezones, timezoneOptions } from "./timezones";

const NOW = new Date("2026-11-27T12:00:00Z");
const options = timezoneOptions(null, NOW);

describe("timezoneOptions (A29)", () => {
  it("lists each clock once, west to east, with its cities", () => {
    const kyiv = options.find((o) => o.value === "Europe/Kyiv")!;
    expect(kyiv.offset).toBe("UTC+02:00");
    expect(kyiv.cities.startsWith("Kyiv, ")).toBe(true);
    expect(filterTimezones(options, "athens").map((o) => o.value)).toEqual(["Europe/Kyiv"]);
    // Berlin shares Warsaw's clock, so it is not a second entry.
    expect(filterTimezones(options, "berlin").map((o) => o.value)).toEqual(["Europe/Warsaw"]);
    expect(new Set(options.map((o) => o.value)).size).toBe(options.length);
    expect(options[0].offset.startsWith("UTC-")).toBe(true);
  });

  it("mentions no Russian city", () => {
    const text = options.map((o) => `${o.cities} ${o.search}`).join(" ").toLowerCase();
    for (const city of ["moscow", "kaliningrad", "simferopol", "samara", "yekaterinburg", "novosibirsk", "vladivostok"]) {
      expect(text).not.toContain(city);
    }
  });

  it("keeps a saved zone as its group's value", () => {
    const saved = timezoneOptions("Europe/Berlin", NOW);
    expect(saved.some((o) => o.value === "Europe/Berlin")).toBe(true);
    expect(saved.some((o) => o.value === "Europe/Warsaw")).toBe(false);
    expect(cityName("Europe/Kiev")).toBe("Kyiv");
  });
});
