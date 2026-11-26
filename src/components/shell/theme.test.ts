import { describe, expect, it } from "vitest";
import { parseThemePref, resolveDark, THEME_INIT_SCRIPT, THEME_LABEL, THEME_ORDER, THEME_STORAGE_KEY } from "./theme";

describe("theme", () => {
  it("parses stored values", () => {
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref(null)).toBe("system");
    expect(parseThemePref("purple")).toBe("system");
  });

  it("resolves dark mode from preference and system", () => {
    expect(resolveDark("system", true)).toBe(true);
    expect(resolveDark("system", false)).toBe(false);
    expect(resolveDark("light", true)).toBe(false);
    expect(resolveDark("dark", false)).toBe(true);
  });

  it("lists system, light, dark in menu order with labels", () => {
    expect(THEME_ORDER).toEqual(["system", "light", "dark"]);
    expect(THEME_ORDER.map((p) => THEME_LABEL[p])).toEqual(["System", "Light", "Dark"]);
  });

  it("round-trips every choice through parseThemePref", () => {
    for (const p of THEME_ORDER) expect(parseThemePref(p)).toBe(p);
  });

  it("init script reads the same storage key", () => {
    expect(THEME_INIT_SCRIPT).toContain(THEME_STORAGE_KEY);
  });
});
