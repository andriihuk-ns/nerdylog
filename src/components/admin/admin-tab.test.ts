import { describe, expect, it } from "vitest";
import { adminHref, officeHref, parseAdminTab, parseOfficeTab } from "./admin-tab";

describe("admin tabs", () => {
  it("parses known tabs and falls back to directory", () => {
    expect(parseAdminTab("offices")).toBe("offices");
    expect(parseAdminTab("teams")).toBe("directory");
    expect(parseAdminTab(undefined)).toBe("directory");
  });

  it("sends old holiday links to offices", () => {
    expect(parseAdminTab("holidays")).toBe("offices");
  });

  it("builds admin and office hrefs", () => {
    expect(adminHref("projects")).toBe("/admin?tab=projects");
    expect(officeHref("o1")).toBe("/admin/offices/o1?tab=people");
    expect(officeHref("o1", "holidays", 2026)).toBe("/admin/offices/o1?tab=holidays&year=2026");
    expect(parseOfficeTab("holidays")).toBe("holidays");
    expect(parseOfficeTab("x")).toBe("people");
  });
});
