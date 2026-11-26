import { createSlackDeps } from "@/server/slack/default-deps";
import { handleEvent } from "@/server/slack/handlers/events";
import { verifiedBody } from "@/server/slack/route-helpers";

/** POST /api/slack/events — url_verification and app_home_opened. Signature-verified. */
export async function POST(request: Request) {
  const body = await verifiedBody(request);
  if (body instanceof Response) return body;
  return handleEvent(body, request.headers, createSlackDeps());
}
