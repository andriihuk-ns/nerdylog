import { serverEnv } from "@/lib/env";
import { createSlackDeps } from "@/server/slack/default-deps";
import { runMorningReminders } from "@/server/slack/handlers/morning-reminder";
import { runProjectPrompts } from "@/server/slack/handlers/project-prompt";
import { hasBearer } from "@/server/slack/route-helpers";

/**
 * GET /api/cron/morning-ping — called by Supabase pg_cron (pg_net) every 15 minutes (amendment A10).
 * A16/A19: posts due project-channel prompts and personal time reminders; the path stays for pg_cron.
 * The caller sends `Authorization: Bearer ${CRON_SECRET}` (see scripts/setup-pg-cron.sql).
 */
export async function GET(request: Request) {
  if (!hasBearer(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const deps = createSlackDeps();
    const [reminders, projectPrompts] = await Promise.allSettled([
      runMorningReminders(deps),
      runProjectPrompts(deps),
    ]);
    if (reminders.status === "rejected") throw reminders.reason;
    if (projectPrompts.status === "rejected") throw projectPrompts.reason;
    return Response.json({ reminders: reminders.value, projectPrompts: projectPrompts.value });
  } catch (error) {
    console.error("cron/morning-ping: failed", error instanceof Error ? error.message : error);
    return Response.json({ error: "morning_ping_failed" }, { status: 500 });
  }
}
