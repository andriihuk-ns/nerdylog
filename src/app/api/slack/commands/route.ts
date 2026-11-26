import { createSlackDeps } from "@/server/slack/default-deps";
import { handleSlashCommand } from "@/server/slack/handlers/commands";
import { verifiedBody } from "@/server/slack/route-helpers";

/** POST /api/slack/commands — /log and /pto (FR-SLACK-04). Signature-verified. */
export async function POST(request: Request) {
  const body = await verifiedBody(request);
  if (body instanceof Response) return body;
  return handleSlashCommand(new URLSearchParams(body), createSlackDeps());
}
