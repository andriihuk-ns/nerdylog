import { describe, expect, it, vi } from "vitest";
import { actionError, ok } from "./action-result";

function named(name: string, message = "") {
  const err = new Error(message);
  err.name = name;
  return err;
}

describe("actionError", () => {
  it("maps service errors to readable messages", () => {
    expect(actionError(named("ForbiddenError"))).toEqual({
      ok: false,
      message: "You don't have permission to do that.",
    });
    expect(actionError(named("NotFoundError")).message).toMatch(/no longer exists/);
    expect(actionError(named("InvalidInputError", "Hours must be a multiple of 0.25"))).toEqual({
      ok: false,
      message: "Hours must be a multiple of 0.25",
    });
    expect(actionError(named("InvalidInputError", "x".repeat(300))).message).toBe("Check the values and try again.");
  });

  it("hides unknown errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(actionError(new Error("db password leaked")).message).toBe("Something went wrong. Try again.");
    spy.mockRestore();
  });

  it("wraps data in ok()", () => {
    expect(ok({ created: 1 })).toEqual({ ok: true, data: { created: 1 } });
  });
});
