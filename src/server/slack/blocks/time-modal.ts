import type { ProjectView } from "@/contracts";
import { ACTION, BLOCK, CALLBACK, INPUT_ACTION, MAX_PROJECT_ROWS, rowBlock } from "../ids";
import { encodeMetadata, type ModalMetadata } from "../metadata";
import type { ModalView, SlackBlock } from "../types";
import { context, divider, header, modalTitle, mrkdwnSection, plain } from "./common";

/** Slack allows at most 100 options in a static_select. */
const MAX_OPTIONS = 100;
export const TASK_MAX_LENGTH = 2000;
export const PLAN_MAX_LENGTH = 4000;

export interface TimeModalInput {
  meta: ModalMetadata; // kind "standup" or "log"
  projects: ProjectView[]; // active projects only
}

function projectOptions(projects: ProjectView[]) {
  return projects.slice(0, MAX_OPTIONS).map((p) => ({
    text: plain((p.code ? `${p.name} (${p.code})` : p.name).slice(0, 75)),
    value: p.id,
  }));
}

function projectRow(n: number, projects: ProjectView[]): SlackBlock[] {
  return [
    {
      type: "input",
      block_id: rowBlock.project(n),
      optional: true,
      label: plain(`Project ${n}`),
      element: {
        type: "static_select",
        action_id: INPUT_ACTION,
        placeholder: plain("Pick a project"),
        options: projectOptions(projects),
      },
    },
    {
      type: "input",
      block_id: rowBlock.hours(n),
      optional: true,
      label: plain("Hours"),
      element: {
        type: "number_input",
        action_id: INPUT_ACTION,
        is_decimal_allowed: true,
        min_value: "0.25",
        max_value: "24",
        placeholder: plain("e.g. 4 or 2.5"),
      },
    },
    {
      type: "input",
      block_id: rowBlock.task(n),
      optional: true,
      label: plain("What did you do?"),
      hint: plain("Ticket IDs like DOG-1364 are picked up automatically."),
      element: { type: "plain_text_input", action_id: INPUT_ACTION, max_length: TASK_MAX_LENGTH },
    },
  ];
}

function rowActions(rows: number): SlackBlock | null {
  const elements = [];
  if (rows < MAX_PROJECT_ROWS) {
    elements.push({ type: "button" as const, action_id: ACTION.addRow, text: plain("+ Add project") });
  }
  if (rows > 1) {
    elements.push({ type: "button" as const, action_id: ACTION.removeRow, text: plain("Remove last") });
  }
  return elements.length > 0 ? { type: "actions", block_id: BLOCK.rowActions, elements } : null;
}

function workSection(meta: ModalMetadata, projects: ProjectView[]): SlackBlock[] {
  const blocks: SlackBlock[] = [
    header("Yesterday's work"),
    {
      type: "input",
      block_id: BLOCK.workDate,
      label: plain("Work date"),
      element: { type: "datepicker", action_id: INPUT_ACTION, initial_date: meta.logDate },
    },
  ];
  if (projects.length === 0) {
    blocks.push(mrkdwnSection("No projects assigned yet. Ask an admin."));
    return blocks;
  }
  for (let n = 1; n <= meta.rows; n += 1) {
    if (n > 1) blocks.push(divider());
    blocks.push(...projectRow(n, projects));
  }
  const actions = rowActions(meta.rows);
  if (actions) blocks.push(actions);
  return blocks;
}

function standupSection(): SlackBlock[] {
  return [
    context("Off yesterday? Use Quick PTO instead."),
    divider(),
    header("Today (shared as context, not tracked)"),
    {
      type: "input",
      block_id: BLOCK.plan,
      label: plain("What are you planning today?"),
      element: { type: "plain_text_input", action_id: INPUT_ACTION, multiline: true, max_length: PLAN_MAX_LENGTH },
    },
    {
      type: "input",
      block_id: BLOCK.blockers,
      optional: true,
      label: plain("Any blockers?"),
      element: { type: "plain_text_input", action_id: INPUT_ACTION, multiline: true, max_length: PLAN_MAX_LENGTH },
    },
  ];
}

/**
 * Design system 7.2. kind "standup" = morning modal (Stream A rows + Stream B plan/blockers);
 * kind "log" = /log, time rows only. Row inputs are optional so empty rows can be ignored.
 */
export function buildTimeModal({ meta, projects }: TimeModalInput): ModalView {
  const standup = meta.kind === "standup";
  const blocks = [...workSection(meta, projects), ...(standup ? standupSection() : [])];
  return {
    type: "modal",
    callback_id: CALLBACK.time,
    private_metadata: encodeMetadata(meta),
    title: modalTitle(standup ? "Daily standup" : "Log time"),
    submit: plain("Submit"),
    close: plain("Cancel"),
    blocks,
  };
}
