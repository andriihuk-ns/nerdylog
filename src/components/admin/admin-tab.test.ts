import { describe, expect, it } from "vitest";
import { adminHref, parseAdminTab } from "./admin-tab";

describe("admin tabs", () => {
  it("parses known tabs and falls back to directory", () => {
    expect(parseAdminTab("offices")).toBe("offices");
    expect(parseAdminTab("teams")).toBe("directory");
    expect(parseAdminTab(undefined)).toBe("directory");
  });

  it("builds hrefs with an optional office", () => {
    expect(adminHref("holidays", 2026, "o1")).toBe("/admin?tab=holidays&year=2026&office=o1");
    expect(adminHref("projects", 2026)).toBe("/admin?tab=projects&year=2026");
  });
});
