import { describe, expect, it } from "vitest";
import { applyOfficeOrder, parseOfficeOrder } from "./offices";

describe("office order (A30)", () => {
  const rows = [{ id: "pl" }, { id: "ua" }, { id: "de" }];

  it("uses the saved order; offices not in it follow in their input order", () => {
    expect(applyOfficeOrder(rows, ["ua", "gone"]).map((o) => o.id)).toEqual(["ua", "pl", "de"]);
    expect(applyOfficeOrder(rows, [])).toEqual(rows);
  });

  it("treats a missing or broken value as no order", () => {
    expect(parseOfficeOrder('["ua",1]')).toEqual(["ua"]);
    for (const value of [null, "nope", '{"a":1}']) expect(parseOfficeOrder(value)).toEqual([]);
  });
});
