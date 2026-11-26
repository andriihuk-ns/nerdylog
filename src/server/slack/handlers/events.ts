import { z } from "zod";
import type { SlackDeps } from "../types";
import { publishHome } from "./home";

const urlVerificationSchema = z.object({ type: z.literal("url_verification"), challenge: z.string() });
const appHomeOpenedSchema = z.object({
  type: z.literal("event_callback"),
  event: z.object({ type: z.literal("app_home_opened"), user: z.string().min(1), tab: z.string().optional() }).loose(),
});

/**
 * POST /api/slack/events body (already signature-verified, JSON).
 * Slack retries (X-Slack-Retry-Num) are acked without reprocessing.
 */
export async function handleEvent(rawBody: string, headers: Headers, deps: SlackDeps): Promise<Response> {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return new Response("bad payload", { status: 400 });
  }

  const challenge = urlVerificationSchema.safeParse(json);
  if (challenge.success) return Response.json({ challenge: challenge.data.challenge });

  if (headers.get("x-slack-retry-num")) return new Response(null, { status: 200 });

  const homeOpened = appHomeOpenedSchema.safeParse(json);
  if (homeOpened.success && (homeOpened.data.event.tab ?? "home") === "home") {
    const slackUserId = homeOpened.data.event.user;
    deps.defer(async () => {
      try {
        await publishHome(deps, slackUserId);
      } catch (error) {
        console.error("slack: publish home failed", error instanceof Error ? error.message : error);
      }
    });
  }
  return new Response(null, { status: 200 });
}
