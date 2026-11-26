import { DEFAULT_LOCALE, type Locale } from "@/contracts";
import { localeOf, t } from "../i18n";
import type { SlackDeps } from "../types";
import { openModalFast } from "./modal-loader";

const COMMAND_KINDS = { "/log": "log", "/pto": "pto" } as const;

function ephemeral(text: string): Response {
  return Response.json({ response_type: "ephemeral", text });
}

/**
 * A14: ephemeral replies use the caller's locale. Only resolved on these failure paths, so the
 * happy path still opens the modal before any DB work. Unknown users / lookup errors → uk.
 */
async function callerLocale(deps: SlackDeps, slackUserId: string | null): Promise<Locale> {
  if (!slackUserId) return DEFAULT_LOCALE;
  try {
    return localeOf(await deps.tempo.resolveUser(slackUserId));
  } catch {
    return DEFAULT_LOCALE;
  }
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
  if (!kind) return ephemeral(t(await callerLocale(deps, slackUserId), "cmd.unknown", { command }));
  if (!triggerId || !slackUserId) return ephemeral(t(await callerLocale(deps, slackUserId), "cmd.noTrigger"));

  const opened = await openModalFast(deps, { kind, slackUserId, triggerId });
  if (!opened) return ephemeral(t(await callerLocale(deps, slackUserId), "cmd.openFailed"));
  return new Response(null, { status: 200 });
}
