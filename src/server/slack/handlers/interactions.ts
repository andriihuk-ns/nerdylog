import { isoDateSchema } from "@/contracts";
import { decodePromptValue } from "../blocks/project-prompt";
import { ACTION, MAX_PROJECT_ROWS } from "../ids";
import { decodeMetadata } from "../metadata";
import {
  isBlockActions,
  isViewSubmission,
  parseInteractionPayload,
  type BlockActionsPayload,
} from "../payloads";
import type { SlackDeps } from "../types";
import { openModalFast, resizeTimeModal } from "./modal-loader";
import { handlePromptClick } from "./project-prompt";
import { handleViewSubmission } from "./view-submission";

const OK = () => new Response(null, { status: 200 });

function dateOrNull(value: string | undefined): string | null {
  return value && isoDateSchema.safeParse(value).success ? value : null;
}

async function handleBlockActions(payload: BlockActionsPayload, deps: SlackDeps): Promise<Response> {
  const action = payload.actions[0];
  const slackUserId = payload.user.id;
  const triggerId = payload.trigger_id;

  switch (action.action_id) {
    case ACTION.projectStatusOpen: {
      const value = decodePromptValue(action.value);
      if (!triggerId || !value) return OK();
      const channelId = payload.channel?.id ?? payload.container?.channel_id ?? null;
      await handlePromptClick(deps, { slackUserId, triggerId, channelId, ...value });
      return OK();
    }
    // openStandup / openPto: legacy buttons in pre-A16 morning DMs that users may still click.
    case ACTION.openStandup:
    case ACTION.openPto:
    case ACTION.homeLog:
    case ACTION.homePto: {
      if (!triggerId) return OK();
      const kind =
        action.action_id === ACTION.openStandup
          ? "standup"
          : action.action_id === ACTION.homeLog
            ? "log"
            : "pto";
      await openModalFast(deps, { kind, slackUserId, triggerId, logDate: dateOrNull(action.value) });
      return OK();
    }
    case ACTION.addRow:
    case ACTION.removeRow: {
      const view = payload.view;
      const meta = decodeMetadata(view?.private_metadata);
      if (!view || !meta) return OK();
      const delta = action.action_id === ACTION.addRow ? 1 : -1;
      const rows = Math.min(MAX_PROJECT_ROWS, Math.max(1, meta.rows + delta));
      if (rows === meta.rows) return OK();
      deps.defer(async () => {
        try {
          await resizeTimeModal(deps, { slackUserId, viewId: view.id, hash: view.hash, meta, rows });
        } catch (error) {
          console.error("slack: resize modal failed", error instanceof Error ? error.message : error);
        }
      });
      return OK();
    }
    default:
      return OK(); // url buttons (Open Web Panel) and unknown actions need only an ack
  }
}

/** POST /api/slack/interactions body (already signature-verified, form-encoded). */
export async function handleInteraction(form: URLSearchParams, deps: SlackDeps): Promise<Response> {
  const payload = parseInteractionPayload(form);
  if (!payload) return new Response("bad payload", { status: 400 });
  if (isViewSubmission(payload)) return handleViewSubmission(payload, deps);
  if (isBlockActions(payload)) return handleBlockActions(payload, deps);
  return OK(); // view_closed, shortcuts, etc.
}
