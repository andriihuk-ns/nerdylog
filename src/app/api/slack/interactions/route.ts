import { createSlackDeps } from "@/server/slack/default-deps";
import { handleInteraction } from "@/server/slack/handlers/interactions";
import { verifiedBody } from "@/server/slack/route-helpers";

/** POST /api/slack/interactions — buttons and modal submissions. Signature-verified. */
export async function POST(request: Request) {
  const body = await verifiedBody(request);
  if (body instanceof Response) return body;
  return handleInteraction(new URLSearchParams(body), createSlackDeps());
}
