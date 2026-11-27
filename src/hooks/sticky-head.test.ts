import { describe, expect, it } from "vitest";
import { stickyHeadOffset } from "./use-sticky-head";

describe("stickyHeadOffset", () => {
  it("stays put until the table reaches the app header", () => {
    expect(stickyHeadOffset(57, 200, 600, 80)).toBe(0);
  });

  it("follows the scroll and stops before the table ends", () => {
    expect(stickyHeadOffset(57, -43, 600, 80)).toBe(100);
    expect(stickyHeadOffset(57, -900, 600, 80)).toBe(440);
    expect(stickyHeadOffset(57, -900, 100, 80)).toBe(0);
  });
});
