import { createHmac, timingSafeEqual } from "node:crypto";

/** Slack rejects replays older than five minutes; so do we. */
export const SLACK_MAX_SKEW_SECONDS = 300;

export interface VerifySlackSignatureInput {
  signingSecret: string;
  /** Value of the `X-Slack-Request-Timestamp` header (unix seconds). */
  timestamp: string | null;
  /** Value of the `X-Slack-Signature` header (`v0=<hex>`). */
  signature: string | null;
  /** Raw request body, exactly as received. Never a re-serialised parse. */
  rawBody: string;
  nowSeconds: number;
}

const SIGNATURE_PATTERN = /^v0=[0-9a-f]{64}$/;
const TIMESTAMP_PATTERN = /^\d{1,12}$/;

/** Pure HMAC-SHA256 check of `v0:{ts}:{body}`. Returns false on any malformed input. */
export function verifySlackSignature(input: VerifySlackSignatureInput): boolean {
  const { signingSecret, timestamp, signature, rawBody, nowSeconds } = input;
  if (!signingSecret || !timestamp || !signature) return false;
  if (!TIMESTAMP_PATTERN.test(timestamp) || !SIGNATURE_PATTERN.test(signature)) return false;

  const ts = Number(timestamp);
  if (Math.abs(nowSeconds - ts) > SLACK_MAX_SKEW_SECONDS) return false;

  const expected = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export type SlackRequestVerification = { ok: true; rawBody: string } | { ok: false; rawBody: null };

/**
 * Reads the raw body once and verifies it. Call this first in every /api/slack/* handler,
 * then parse `rawBody` (form-encoded or JSON) yourself; the request body is consumed.
 */
export async function verifySlackRequest(
  request: Request,
  signingSecret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<SlackRequestVerification> {
  const rawBody = await request.text();
  const ok = verifySlackSignature({
    signingSecret,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
    rawBody,
    nowSeconds,
  });
  return ok ? { ok: true, rawBody } : { ok: false, rawBody: null };
}
