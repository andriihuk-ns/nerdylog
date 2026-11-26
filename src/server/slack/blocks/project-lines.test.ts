import { describe, expect, it } from "vitest";
import { buildProjectLinesMessage, formatProjectLine, groupProjectLines } from "./project-lines";

const P1 = "1a2b3c4d-8f1e-4c1b-9a35-3b1f8f0f6a03";
const P2 = "2b3c4d5e-8f1e-4c1b-9a35-3b1f8f0f6a04";
const work = (projectId: string, hours: number, taskSummary: string) => ({ entryType: "work" as const, projectId, hours, taskSummary });

describe("formatProjectLine", () => {
  it("joins ticket refs in parentheses", () => {
    expect(formatProjectLine("Olena Petrenko", { hours: 4, taskSummary: "Map modal DOG-1364, DOG-1365" })).toBe(
      "Olena Petrenko · 4h · Map modal DOG-1364, DOG-1365 (DOG-1364, DOG-1365)",
    );
  });

  it("omits parentheses without refs and shows decimal hours", () => {
    expect(formatProjectLine("Olena Petrenko", { hours: 2.5, taskSummary: "  Code review  " })).toBe("Olena Petrenko · 2.5h · Code review");
    expect(formatProjectLine("Olena Petrenko", { hours: 0.25, taskSummary: "Sync" })).toBe("Olena Petrenko · 0.25h · Sync");
  });
});

describe("groupProjectLines", () => {
  it("groups several entries per project in order and drops PTO", () => {
    const grouped = groupProjectLines("Olena", [
      work(P1, 4, "Map modal DOG-1"),
      work(P2, 1.5, "Swap flow CNG-9"),
      work(P1, 2, "Code review"),
      { entryType: "vacation", projectId: null, hours: 0, taskSummary: "" },
    ]);
    expect([...grouped.keys()]).toEqual([P1, P2]);
    expect(grouped.get(P1)).toEqual(["Olena · 4h · Map modal DOG-1 (DOG-1)", "Olena · 2h · Code review"]);
    expect(grouped.get(P2)).toEqual(["Olena · 1.5h · Swap flow CNG-9 (CNG-9)"]);
  });

  it("PTO-only input yields no groups", () => {
    expect(groupProjectLines("Olena", [{ entryType: "sick", projectId: null, hours: 0, taskSummary: "" }]).size).toBe(0);
  });
});

describe("buildProjectLinesMessage", () => {
  it("one line per entry, mrkdwn-escaped, no blocks", () => {
    expect(buildProjectLinesMessage(["A · 1h · x <y> & z", "A · 2h · w"])).toEqual({
      text: "A · 1h · x &lt;y&gt; &amp; z\nA · 2h · w",
      blocks: [],
    });
  });
});
