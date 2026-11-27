import { type Locale, type ProjectView } from "@/contracts";
import { longDate } from "../dates";
import { t } from "../i18n";
import { ACTION, BLOCK, CALLBACK, INPUT_ACTION, MAX_PROJECT_ROWS, MAX_TASK_ITEMS, rowBlock } from "../ids";
import { encodeMetadata, getRowTaskMeta, type ModalMetadata } from "../metadata";
import type { ModalView, SlackBlock } from "../types";
import { context, divider, header, modalTitle, mrkdwnSection, plain } from "./common";

/** Slack rejects the whole view when a plain_text_input asks for more than this. */
const SLACK_INPUT_MAX_LENGTH = 3000;

/** Slack allows at most 100 options in a static_select. */
const MAX_OPTIONS = 100;
export const PLAN_MAX_LENGTH = SLACK_INPUT_MAX_LENGTH;

export interface TimeModalInput {
  meta: ModalMetadata; // kind "standup" or "log"
  projects: ProjectView[]; // A15: active projects the user is a member of
  locale: Locale; // A14: recipient's language
  initialHours?: string;
  initialTask?: string;
}

function projectOptions(projects: ProjectView[]) {
  return projects.slice(0, MAX_OPTIONS).map((p) => ({
    text: plain(p.name.slice(0, 75)),
    value: p.id,
  }));
}

/** A16: every rendered input is required (no `optional`); the server re-checks empty values. */
function projectRow(
  n: number,
  projects: ProjectView[],
  locale: Locale,
  meta: ModalMetadata,
  preselectId?: string,
  initialHours?: string,
  initialTask?: string,
): SlackBlock[] {
  const options = projectOptions(projects);
  const initial = preselectId ? options.find((o) => o.value === preselectId) : undefined;
  const taskMeta = getRowTaskMeta(meta, n);
  const blocks: SlackBlock[] = [
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
      hint: plain(t(locale, "time.hoursHint")),
      // A14: plain text (not number_input) so both "2.5" and "2,5" reach the parser; it validates the range.
      element: {
        type: "plain_text_input",
        action_id: INPUT_ACTION,
        max_length: 6,
        placeholder: plain(t(locale, "time.hoursPlaceholder")),
        ...(n === 1 && initialHours ? { initial_value: initialHours } : {}),
      },
    },
  ];
  for (let i = 1; i <= taskMeta.count; i += 1) {
    const hasLink = taskMeta.links.includes(i);
    blocks.push({
      type: "input",
      block_id: rowBlock.taskItem(n, i),
      label: plain(taskMeta.count === 1 ? t(locale, "time.taskLabel") : t(locale, "time.taskItemLabel", { i })),
      element: {
        type: "plain_text_input",
        action_id: INPUT_ACTION,
        max_length: 500,
        placeholder: plain(t(locale, "time.taskPlaceholder")),
        ...(n === 1 && i === 1 && initialTask ? { initial_value: initialTask } : {}),
      },
    });
    if (hasLink) {
      blocks.push({
        type: "input",
        block_id: rowBlock.taskLink(n, i),
        label: plain(t(locale, "time.taskLinkLabel", { i })),
        element: {
          type: "plain_text_input",
          action_id: INPUT_ACTION,
          multiline: true,
          max_length: SLACK_INPUT_MAX_LENGTH,
          placeholder: plain(t(locale, "time.taskLinkPlaceholder")),
        },
      });
    }
    blocks.push({
      type: "section",
      block_id: rowBlock.taskItemActions(n, i),
      text: { type: "mrkdwn", text: t(locale, "time.taskHint") },
      accessory: {
        type: "button",
        action_id: ACTION.toggleTaskLink,
        value: `${n}:${i}`,
        text: plain(t(locale, hasLink ? "time.removeTaskLink" : "time.addTaskLink", { i })),
      },
    });
  }
  const taskBtns = [];
  if (taskMeta.count < MAX_TASK_ITEMS) {
    taskBtns.push({ type: "button" as const, action_id: ACTION.addTaskItem, value: String(n), text: plain(t(locale, "time.addTaskItem")) });
  }
  if (taskMeta.count > 1) {
    taskBtns.push({ type: "button" as const, action_id: ACTION.removeTaskItem, value: String(n), text: plain(t(locale, "time.removeTaskItem")) });
  }
  if (taskBtns.length > 0) {
    blocks.push({ type: "actions", block_id: rowBlock.taskActions(n), elements: taskBtns });
  }
  blocks.push(divider());
  return blocks;
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

function workSection(
  meta: ModalMetadata,
  projects: ProjectView[],
  locale: Locale,
  initialHours?: string,
  initialTask?: string,
): SlackBlock[] {
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
    blocks.push(
      ...projectRow(
        n,
        projects,
        locale,
        meta,
        n === 1 ? meta.projectId : undefined,
        initialHours,
        initialTask,
      ),
    );
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
export function buildTimeModal({ meta: input, projects, locale, initialHours, initialTask }: TimeModalInput): ModalView {
  const standup = input.kind === "standup";
  const meta: ModalMetadata = projects.length === 0 ? { ...input, rows: 0 } : { ...input, rows: Math.max(1, input.rows) };
  const blocks = [
    ...workSection(meta, projects, locale, initialHours, initialTask),
    ...(standup ? standupSection(locale) : []),
  ];
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
