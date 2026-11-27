import { isoDateSchema } from "@/contracts";
import { decodePromptValue } from "../blocks/project-prompt";
import { ACTION, MAX_PROJECT_ROWS, MAX_TASK_ITEMS } from "../ids";
import { decodeMetadata, getRowTaskMeta, withRowTaskMeta, type ModalMetadata } from "../metadata";
import {
  isBlockActions,
  isViewSubmission,
  parseInteractionPayload,
  type BlockActionsPayload,
} from "../payloads";
import type { SlackDeps } from "../types";
import { openModalFast, updateTimeModal } from "./modal-loader";
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
      deferModalUpdate(deps, slackUserId, view, { ...meta, rows });
      return OK();
    }
    case ACTION.addTaskItem:
    case ACTION.removeTaskItem: {
      const view = payload.view;
      const meta = decodeMetadata(view?.private_metadata);
      const row = Number(action.value);
      if (!view || !meta || !Number.isInteger(row) || row < 1 || row > meta.rows) return OK();
      const cur = getRowTaskMeta(meta, row);
      const delta = action.action_id === ACTION.addTaskItem ? 1 : -1;
      const count = Math.min(MAX_TASK_ITEMS, Math.max(1, cur.count + delta));
      if (count === cur.count) return OK();
      const links = cur.links.filter((l) => l <= count);
      deferModalUpdate(deps, slackUserId, view, withRowTaskMeta(meta, row, { count, links }));
      return OK();
    }
    case ACTION.toggleTaskLink: {
      const view = payload.view;
      const meta = decodeMetadata(view?.private_metadata);
      const [rowStr, itemStr] = (action.value ?? "").split(":");
      const row = Number(rowStr);
      const item = Number(itemStr);
      if (!view || !meta || !Number.isInteger(row) || !Number.isInteger(item) || row < 1 || row > meta.rows) return OK();
      const cur = getRowTaskMeta(meta, row);
      if (item < 1 || item > cur.count) return OK();
      const links = cur.links.includes(item)
        ? cur.links.filter((l) => l !== item)
        : [...cur.links, item].sort((a, b) => a - b);
      deferModalUpdate(deps, slackUserId, view, withRowTaskMeta(meta, row, { ...cur, links }));
      return OK();
    }
    default:
      return OK(); // url buttons (Open Web Panel) and unknown actions need only an ack
  }
}

function deferModalUpdate(
  deps: SlackDeps,
  slackUserId: string,
  view: { id: string; hash?: string },
  meta: ModalMetadata,
) {
  deps.defer(async () => {
    try {
      await updateTimeModal(deps, { slackUserId, viewId: view.id, hash: view.hash, meta });
    } catch (error) {
      console.error("slack: resize modal failed", error instanceof Error ? error.message : error);
    }
  });
}

/** POST /api/slack/interactions body (already signature-verified, form-encoded). */
export async function handleInteraction(form: URLSearchParams, deps: SlackDeps): Promise<Response> {
  const payload = parseInteractionPayload(form);
  if (!payload) return new Response("bad payload", { status: 400 });
  if (isViewSubmission(payload)) return handleViewSubmission(payload, deps);
  if (isBlockActions(payload)) return handleBlockActions(payload, deps);
  return OK(); // view_closed, shortcuts, etc.
}
