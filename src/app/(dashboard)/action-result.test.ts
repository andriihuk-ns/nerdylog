import { describe, expect, it, vi } from "vitest";
import { actionError, fieldErrorCode, ok } from "./action-result";

vi.mock("next-intl/server", () => import("./test-intl"));

function named(name: string, message = "") {
  const err = new Error(message);
  err.name = name;
  return err;
}

describe("actionError", () => {
  it("maps service errors to readable messages", async () => {
    expect(await actionError(named("ForbiddenError"))).toEqual({
      ok: false,
      message: "You can't do that.",
    });
    expect((await actionError(named("NotFoundError"))).message).toMatch(/is gone/);
    expect(await actionError(named("InvalidInputError", "Hours must be a multiple of 0.25"))).toEqual({
      ok: false,
      message: "Hours must be a multiple of 0.25",
    });
    expect((await actionError(named("InvalidInputError", "x".repeat(300)))).message).toBe("Check the values and try again.");
  });

  it("hides unknown errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await actionError(new Error("db password leaked"))).message).toBe("Something went wrong. Try again.");
    spy.mockRestore();
  });

  it("wraps data in ok()", () => {
    expect(ok({ created: 1 })).toEqual({ ok: true, data: { created: 1 } });
  });
});

describe("fieldErrorCode", () => {
  it("reads the first code for a field", () => {
    const err = Object.assign(named("InvalidInputError"), { fieldErrors: { projectId: ["not_member"] } });
    expect(fieldErrorCode(err, "projectId")).toBe("not_member");
    expect(fieldErrorCode(err, "hours")).toBeNull();
  });

  it("ignores other errors", () => {
    expect(fieldErrorCode(Object.assign(named("Error"), { fieldErrors: { projectId: ["x"] } }), "projectId")).toBeNull();
    expect(fieldErrorCode(null, "projectId")).toBeNull();
  });
});
