import { describe, expect, it } from "vitest";
import { sortRanks, type SortDirection } from "./sort";

const rows = [
  { id: "a", n: 2 as number | null },
  { id: "b", n: null },
  { id: "c", n: 10 },
  { id: "d", n: 2 },
];
const order = (direction: SortDirection) =>
  [...sortRanks(rows, (r) => r.id, (r) => r.n, direction)].sort((a, b) => a[1] - b[1]).map(([id]) => id);

describe("sortRanks", () => {
  it("sorts numbers both ways with empty values last and stable ties", () => {
    expect(order("asc")).toEqual(["a", "d", "c", "b"]);
    expect(order("desc")).toEqual(["c", "a", "d", "b"]);
  });

  it("compares text with numbers inside it naturally", () => {
    const ranks = sortRanks(["Item 10", "Item 2"], (s) => s, (s) => s, "asc");
    expect(ranks.get("Item 2")).toBe(0);
  });
});
