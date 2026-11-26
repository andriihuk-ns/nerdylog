import type { SlackDeps } from "../types";
import { openModalFast } from "./modal-loader";

const COMMAND_KINDS = { "/log": "log", "/pto": "pto" } as const;

function ephemeral(text: string): Response {
  return Response.json({ response_type: "ephemeral", text });
}

/**
 * POST /api/slack/commands body (already signature-verified, form-encoded).
 * Opens the modal with the trigger id right away; data loading happens after the ack.
 */
export async function handleSlashCommand(form: URLSearchParams, deps: SlackDeps): Promise<Response> {
  const command = form.get("command") ?? "";
  const triggerId = form.get("trigger_id");
  const slackUserId = form.get("user_id");
  const kind = COMMAND_KINDS[command as keyof typeof COMMAND_KINDS];
  if (!kind) return ephemeral(`Unknown command ${command}. Try /log or /pto.`);
  if (!triggerId || !slackUserId) return ephemeral("Slack did not send a trigger. Please try again.");

  const opened = await openModalFast(deps, { kind, slackUserId, triggerId });
  if (!opened) return ephemeral("Tempo could not open the form. Please try again.");
  return new Response(null, { status: 200 });
}
