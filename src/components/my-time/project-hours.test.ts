import { describe, expect, it } from "vitest";
import { summarizeProjectHours } from "./project-hours";

const row = (projectName: string, hours: number) => ({ projectId: projectName, projectName, month: "2026-11", hours });

describe("summarizeProjectHours", () => {
  it("drops zero rows, sorts by hours then name, sums the total", () => {
    const { rows, total } = summarizeProjectHours([row("B", 2.5), row("A", 2.5), row("C", 10), row("Z", 0)]);
    expect(rows.map((r) => r.projectName)).toEqual(["C", "A", "B"]);
    expect(total).toBe(15);
  });

  it("handles an empty month", () => {
    expect(summarizeProjectHours([])).toEqual({ rows: [], total: 0 });
  });
});
