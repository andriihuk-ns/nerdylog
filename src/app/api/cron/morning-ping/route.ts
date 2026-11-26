import { serverEnv } from "@/lib/env";
import { createSlackDeps } from "@/server/slack/default-deps";
import { runMorningPings } from "@/server/slack/handlers/morning-ping";
import { hasBearer } from "@/server/slack/route-helpers";

/**
 * GET /api/cron/morning-ping — called by Supabase pg_cron (pg_net) every 15 minutes (amendment A10).
 * The caller sends `Authorization: Bearer ${CRON_SECRET}` (see scripts/setup-pg-cron.sql).
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
