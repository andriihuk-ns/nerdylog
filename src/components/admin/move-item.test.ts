import { describe, expect, it } from "vitest";
import { moveItem } from "./move-item";

describe("moveItem (A30)", () => {
  const ids = ["a", "b", "c"];

  it("moves up and down, clamping to the ends", () => {
    expect(moveItem(ids, "c", 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(ids, "a", 9)).toEqual(["b", "c", "a"]);
  });

  it("returns the same array when nothing moves", () => {
    expect(moveItem(ids, "a", -1)).toBe(ids);
    expect(moveItem(ids, "b", 1)).toBe(ids);
    expect(moveItem(ids, "x", 0)).toBe(ids);
  });
});
