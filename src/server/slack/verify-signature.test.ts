import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySlackRequest, verifySlackSignature } from "./verify-signature";

const SECRET = "test-signing-secret-not-real";
const NOW = 1_764_150_000;
const BODY = "token=x&team_id=T1&command=%2Flog&text=2.5+ACME";

function sign(body: string, ts: number, secret = SECRET): string {
  return `v0=${createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex")}`;
}

function input(overrides: Partial<Parameters<typeof verifySlackSignature>[0]> = {}) {
  return {
    signingSecret: SECRET,
    timestamp: String(NOW),
    signature: sign(BODY, NOW),
    rawBody: BODY,
    nowSeconds: NOW,
    ...overrides,
  };
}

describe("verifySlackSignature", () => {
  it("accepts a valid signature", () => {
    expect(verifySlackSignature(input())).toBe(true);
  });

  it("accepts a timestamp exactly at the 300 s edge", () => {
    expect(verifySlackSignature(input({ nowSeconds: NOW + 300 }))).toBe(true);
  });

  it("rejects a tampered body", () => {
    expect(verifySlackSignature(input({ rawBody: `${BODY}&hours=24` }))).toBe(false);
  });

  it("rejects a signature made with the wrong secret", () => {
    expect(verifySlackSignature(input({ signature: sign(BODY, NOW, "other-secret") }))).toBe(false);
  });

  it("rejects a stale timestamp (> 300 s old)", () => {
    const ts = NOW - 301;
    expect(verifySlackSignature(input({ timestamp: String(ts), signature: sign(BODY, ts) }))).toBe(false);
  });

  it("rejects a timestamp too far in the future", () => {
    const ts = NOW + 301;
    expect(verifySlackSignature(input({ timestamp: String(ts), signature: sign(BODY, ts) }))).toBe(false);
  });

  it.each([
    ["missing signature", { signature: null }],
    ["missing timestamp", { timestamp: null }],
    ["wrong version prefix", { signature: sign(BODY, NOW).replace("v0=", "v1=") }],
    ["truncated hex", { signature: sign(BODY, NOW).slice(0, -2) }],
    ["non-numeric timestamp", { timestamp: "abc" }],
    ["empty secret", { signingSecret: "" }],
  ])("rejects a malformed header: %s", (_label, overrides) => {
    expect(verifySlackSignature(input(overrides))).toBe(false);
  });
});

describe("verifySlackRequest", () => {
  function request(body: string, headers: Record<string, string>): Request {
    return new Request("https://example.test/api/slack/commands", { method: "POST", body, headers });
  }

  it("returns the raw body when the signature is valid", async () => {
    const req = request(BODY, { "x-slack-request-timestamp": String(NOW), "x-slack-signature": sign(BODY, NOW) });
    await expect(verifySlackRequest(req, SECRET, NOW)).resolves.toEqual({ ok: true, rawBody: BODY });
  });

  it("returns ok: false when headers are missing", async () => {
    await expect(verifySlackRequest(request(BODY, {}), SECRET, NOW)).resolves.toEqual({ ok: false, rawBody: null });
  });
});
