import type { Locale, ProjectView } from "@/contracts";
import { longDate } from "../dates";
import { t } from "../i18n";
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
  projects: ProjectView[]; // A15: active projects the user is a member of
  locale: Locale; // A14: recipient's language
}

function projectOptions(projects: ProjectView[]) {
  return projects.slice(0, MAX_OPTIONS).map((p) => ({
    text: plain(p.name.slice(0, 75)),
    value: p.id,
  }));
}

/** A16: every rendered input is required (no `optional`); the server re-checks empty values. */
function projectRow(n: number, projects: ProjectView[], locale: Locale, preselectId?: string): SlackBlock[] {
  const options = projectOptions(projects);
  const initial = preselectId ? options.find((o) => o.value === preselectId) : undefined;
  return [
    {
      type: "input",
      block_id: rowBlock.project(n),
      label: plain(t(locale, "time.projectLabel", { n })),
      element: {
        type: "static_select",
        action_id: INPUT_ACTION,
        placeholder: plain(t(locale, "time.projectPlaceholder")),
        options,
        ...(initial ? { initial_option: initial } : {}),
      },
    },
    {
      type: "input",
      block_id: rowBlock.hours(n),
      label: plain(t(locale, "time.hoursLabel")),
      // A14: plain text (not number_input) so both "2.5" and "2,5" reach the parser; it validates the range.
      element: {
        type: "plain_text_input",
        action_id: INPUT_ACTION,
        max_length: 6,
        placeholder: plain(t(locale, "time.hoursPlaceholder")),
      },
    },
    {
      type: "input",
      block_id: rowBlock.task(n),
      label: plain(t(locale, "time.taskLabel")),
      hint: plain(t(locale, "time.taskHint")),
      element: { type: "plain_text_input", action_id: INPUT_ACTION, multiline: true, max_length: TASK_MAX_LENGTH },
    },
  ];
}

function rowActions(rows: number, locale: Locale): SlackBlock | null {
  const elements = [];
  if (rows < MAX_PROJECT_ROWS) {
    elements.push({ type: "button" as const, action_id: ACTION.addRow, text: plain(t(locale, "time.addRow")) });
  }
  if (rows > 1) {
    elements.push({ type: "button" as const, action_id: ACTION.removeRow, text: plain(t(locale, "time.removeRow")) });
  }
  return elements.length > 0 ? { type: "actions", block_id: BLOCK.rowActions, elements } : null;
}

function workSection(meta: ModalMetadata, projects: ProjectView[], locale: Locale): SlackBlock[] {
  const blocks: SlackBlock[] = [
    header(t(locale, "time.workHeader", { date: longDate(meta.logDate, locale) })),
    {
      type: "input",
      block_id: BLOCK.workDate,
      label: plain(t(locale, "time.workDate")),
      element: { type: "datepicker", action_id: INPUT_ACTION, initial_date: meta.logDate },
    },
  ];
  if (projects.length === 0) {
    blocks.push(mrkdwnSection(t(locale, "time.noProjects")));
    return blocks;
  }
  for (let n = 1; n <= meta.rows; n += 1) {
    if (n > 1) blocks.push(divider());
    blocks.push(...projectRow(n, projects, locale, n === 1 ? meta.projectId : undefined));
  }
  const actions = rowActions(meta.rows, locale);
  if (actions) blocks.push(actions);
  return blocks;
}

function standupSection(locale: Locale): SlackBlock[] {
  return [
    context(t(locale, "time.offYesterday")),
    divider(),
    header(t(locale, "time.todayHeader")),
    {
      type: "input",
      block_id: BLOCK.plan,
      label: plain(t(locale, "time.planLabel")),
      element: { type: "plain_text_input", action_id: INPUT_ACTION, multiline: true, max_length: PLAN_MAX_LENGTH },
    },
    {
      type: "input",
      block_id: BLOCK.blockers,
      label: plain(t(locale, "time.blockersLabel")),
      hint: plain(t(locale, "time.blockersHint")),
      element: { type: "plain_text_input", action_id: INPUT_ACTION, multiline: true, max_length: PLAN_MAX_LENGTH },
    },
  ];
}

/**
 * Design system 7.2. kind "standup" = status modal (Stream A rows + Stream B plan/blockers);
 * kind "log" = /log, time rows only. A16: every rendered row is required. Without projects no
 * rows are rendered (`rows: 0` in the metadata); the log modal then has nothing to submit.
 */
export function buildTimeModal({ meta: input, projects, locale }: TimeModalInput): ModalView {
  const standup = input.kind === "standup";
  const meta: ModalMetadata = projects.length === 0 ? { ...input, rows: 0 } : { ...input, rows: Math.max(1, input.rows) };
  const blocks = [...workSection(meta, projects, locale), ...(standup ? standupSection(locale) : [])];
  const canSubmit = standup || meta.rows > 0;
  return {
    type: "modal",
    callback_id: CALLBACK.time,
    private_metadata: encodeMetadata(meta),
    title: modalTitle(t(locale, standup ? "title.standup" : "title.log")),
    ...(canSubmit ? { submit: plain(t(locale, "common.submit")) } : {}),
    close: plain(t(locale, "common.cancel")),
    blocks,
  };
}
