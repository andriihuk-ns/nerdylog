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

/** Parse quick-enter `/log 2.5 Fix login` or `/log Fix login`. */
function parseLogArgs(raw: string): { initialHours?: string; initialTask?: string } {
  const text = raw.trim();
  if (!text) return {};
  const match = text.match(/^([0-9]+(?:[.,][0-9]+)?)(?:\s+([\s\S]+))?$/);
  if (match) {
    return { initialHours: match[1], ...(match[2]?.trim() ? { initialTask: match[2].trim() } : {}) };
  }
  return { initialTask: text };
}

/**
 * POST /api/slack/commands body (already signature-verified, form-encoded).
 * Opens the modal with the trigger id right away; data loading happens after the ack.
 */
export async function handleSlashCommand(form: URLSearchParams, deps: SlackDeps): Promise<Response> {
  const command = form.get("command") ?? "";
  const triggerId = form.get("trigger_id");
  const slackUserId = form.get("user_id");
  const text = (form.get("text") ?? "").trim();
  const kind = COMMAND_KINDS[command as keyof typeof COMMAND_KINDS];
  if (!kind) return ephemeral(t(await callerLocale(deps, slackUserId), "cmd.unknown", { command }));
  if (kind === "log" && text.toLowerCase() === "help") {
    return ephemeral(t(await callerLocale(deps, slackUserId), "cmd.logHelp"));
  }
  if (!triggerId || !slackUserId) return ephemeral(t(await callerLocale(deps, slackUserId), "cmd.noTrigger"));

  const quick = kind === "log" ? parseLogArgs(text) : {};
  const opened = await openModalFast(deps, { kind, slackUserId, triggerId, ...quick });
  if (!opened) return ephemeral(t(await callerLocale(deps, slackUserId), "cmd.openFailed"));
  return new Response(null, { status: 200 });
}
