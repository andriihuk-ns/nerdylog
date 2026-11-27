import { describe, expect, it } from "vitest";
import { exportHref, rangeExports } from "./export-href";

describe("export links", () => {
  it("builds a query string", () => {
    expect(exportHref("/api/export/summary.csv", { month: "2026-11" })).toBe("/api/export/summary.csv?month=2026-11");
  });

  it("gives week and month CSV + PDF", () => {
    const groups = rangeExports({ from: "2026-11-23", to: "2026-11-29" }, "2026-11");
    expect(groups.week.map((i) => i.kind)).toEqual(["csv", "pdf"]);
    expect(groups.week[0].href).toBe("/api/export/ledger.csv?from=2026-11-23&to=2026-11-29");
    expect(groups.month[1].href).toBe("/api/export/report.pdf?from=2026-11-01&to=2026-11-30");
  });
});
