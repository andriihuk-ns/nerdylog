import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { verifySlackRequest } from "./verify-signature";

/** Reads and verifies a Slack request. Returns the raw body, or a 401 Response. */
export async function verifiedBody(request: Request): Promise<string | Response> {
  const verified = await verifySlackRequest(request, serverEnv().SLACK_SIGNING_SECRET);
  if (!verified.ok) return new Response("invalid signature", { status: 401 });
  return verified.rawBody;
}

/** Timing-safe check of `Authorization: Bearer ${secret}` for cron routes. */
export function hasBearer(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(`Bearer ${secret}`, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
