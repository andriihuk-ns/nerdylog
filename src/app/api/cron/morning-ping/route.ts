import { serverEnv } from "@/lib/env";
import { createSlackDeps } from "@/server/slack/default-deps";
import { runMorningPings } from "@/server/slack/handlers/morning-ping";
import { hasBearer } from "@/server/slack/route-helpers";

/**
 * GET /api/cron/morning-ping — Vercel Cron every 15 minutes on weekdays (amendment A4).
 * Vercel sends `Authorization: Bearer ${CRON_SECRET}`.
 */
export async function GET(request: Request) {
  if (!hasBearer(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const result = await runMorningPings(createSlackDeps());
    return Response.json(result);
  } catch (error) {
    console.error("cron/morning-ping: failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "morning_ping_failed" }, { status: 500 });
  }
}
