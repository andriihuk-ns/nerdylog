import { describe, expect, it } from "vitest";
import { clampGridPos, nextGridPos } from "./grid-nav";

const bounds = { rows: 3, cols: 7 };

describe("nextGridPos", () => {
  it("moves with arrows and clamps at the edges", () => {
    expect(nextGridPos({ row: 1, col: 1 }, { key: "ArrowUp" }, bounds)).toEqual({ row: 0, col: 1 });
    expect(nextGridPos({ row: 0, col: 1 }, { key: "ArrowUp" }, bounds)).toEqual({ row: 0, col: 1 });
    expect(nextGridPos({ row: 2, col: 6 }, { key: "ArrowRight" }, bounds)).toEqual({ row: 2, col: 6 });
    expect(nextGridPos({ row: 2, col: 0 }, { key: "ArrowLeft" }, bounds)).toEqual({ row: 2, col: 0 });
    expect(nextGridPos({ row: 0, col: 3 }, { key: "ArrowDown" }, bounds)).toEqual({ row: 1, col: 3 });
  });

  it("supports Home/End and Ctrl+Home/End", () => {
    expect(nextGridPos({ row: 1, col: 4 }, { key: "Home" }, bounds)).toEqual({ row: 1, col: 0 });
    expect(nextGridPos({ row: 1, col: 4 }, { key: "End" }, bounds)).toEqual({ row: 1, col: 6 });
    expect(nextGridPos({ row: 1, col: 4 }, { key: "Home", ctrlKey: true }, bounds)).toEqual({ row: 0, col: 0 });
    expect(nextGridPos({ row: 1, col: 4 }, { key: "End", metaKey: true }, bounds)).toEqual({ row: 2, col: 6 });
  });

  it("ignores other keys and empty grids", () => {
    expect(nextGridPos({ row: 0, col: 0 }, { key: "a" }, bounds)).toBeNull();
    expect(nextGridPos({ row: 0, col: 0 }, { key: "ArrowDown" }, { rows: 0, cols: 7 })).toBeNull();
  });

  it("clamps a stale position", () => {
    expect(clampGridPos({ row: 5, col: 9 }, bounds)).toEqual({ row: 2, col: 6 });
  });
});
