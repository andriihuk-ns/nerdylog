import { describe, expect, it } from "vitest";
import { loginErrorMessage, signInHref } from "./login-errors";

describe("login helpers", () => {
  it("maps every known error code", () => {
    for (const code of [
      "oauth_denied",
      "exchange_failed",
      "missing_slack_identity",
      "user_link_failed",
      "oauth_start",
      "inactive_user",
    ]) {
      const msg = loginErrorMessage(code);
      expect(msg).toBeTruthy();
      expect(msg).not.toBe("Sign-in failed. Please try again.");
    }
  });

  it("falls back for unknown codes and ignores missing ones", () => {
    expect(loginErrorMessage("weird")).toBe("Sign-in failed. Please try again.");
    expect(loginErrorMessage(undefined)).toBeNull();
    expect(loginErrorMessage(["a", "b"])).toBeNull();
  });

  it("builds the sign-in link with a safe next path", () => {
    expect(signInHref("/team?month=2026-11")).toBe("/auth/sign-in?next=%2Fteam%3Fmonth%3D2026-11");
    expect(signInHref("https://evil.example")).toBe("/auth/sign-in");
    expect(signInHref("//evil.example")).toBe("/auth/sign-in");
    expect(signInHref(undefined)).toBe("/auth/sign-in");
  });
});
