import { describe, expect, it } from "vitest";
import { capStatus, extractTicketRefs, timeEntryInputSchema } from "./index";

describe("contracts", () => {
  it("extracts unique ticket refs", () => {
    expect(extractTicketRefs("Map modal DOG-1364, CNG-009 and DOG-1364 again")).toEqual(["DOG-1364", "CNG-009"]);
    expect(extractTicketRefs("no tickets here, e-mail dog-12")).toEqual([]);
  });

  it("maps cap ratios to states", () => {
    expect(capStatus(32, 40)).toBe("neutral");
    expect(capStatus(34, 40)).toBe("warning");
    expect(capStatus(40, 40)).toBe("over");
    expect(capStatus(10, null)).toBe("neutral");
  });

  it("rejects work entries without a project and PTO with hours", () => {
    const base = {
      userId: "7f0c1a52-8f1e-4c1b-9a35-3b1f8f0f6a01",
      workDate: "2026-11-25",
      source: "web_ui" as const,
    };
    expect(timeEntryInputSchema.safeParse({ ...base, projectId: null, hours: 4, entryType: "work" }).success).toBe(false);
    expect(timeEntryInputSchema.safeParse({ ...base, projectId: null, hours: 8, entryType: "sick" }).success).toBe(false);
    expect(timeEntryInputSchema.safeParse({ ...base, projectId: null, hours: 0, entryType: "vacation" }).success).toBe(true);
  });
});
