import { describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import uk from "../../../messages/uk.json";
import { LOGIN_ERROR_CODES, loginErrorKey, signInHref } from "./login-errors";

describe("login helpers", () => {
  it("maps every known error code to its own message in both languages", () => {
    for (const code of LOGIN_ERROR_CODES) {
      expect(loginErrorKey(code)).toBe(code);
      expect(en.login.errors[code]).toBeTruthy();
      expect(uk.login.errors[code]).toBeTruthy();
    }
  });

  it("falls back for unknown codes and ignores missing ones", () => {
    expect(loginErrorKey("weird")).toBe("unknown");
    expect(en.login.errors.unknown).toBe("Sign-in failed. Please try again.");
    expect(loginErrorKey(undefined)).toBeNull();
    expect(loginErrorKey(["a", "b"])).toBeNull();
  });

  it("builds the sign-in link with a safe next path", () => {
    expect(signInHref("/team?month=2026-11")).toBe("/auth/sign-in?next=%2Fteam%3Fmonth%3D2026-11");
    expect(signInHref("https://evil.example")).toBe("/auth/sign-in");
    expect(signInHref("//evil.example")).toBe("/auth/sign-in");
    expect(signInHref(undefined)).toBe("/auth/sign-in");
  });
});
