import { MAX_CHECKLIST_ITEMS } from "@/contracts";

/** Stable Block Kit identifiers shared by builders, parsers and handlers. */

export const CALLBACK = {
  time: "tempo_time_modal",
  pto: "tempo_pto_modal",
  loading: "tempo_loading",
  notice: "tempo_notice",
} as const;

export const ACTION = {
  /** Legacy (pre-A16 morning DM buttons still in users' DMs); still opens the modal. */
  openStandup: "open_standup",
  openPto: "open_pto",
  /** A16: "Log time & status" on the per-project channel prompt; value = JSON {projectId, logDate}. */
  projectStatusOpen: "project_status_open",
  homeLog: "home_log",
  homePto: "home_pto",
  openWeb: "open_web",
  addRow: "add_row",
  removeRow: "remove_row",
  addTaskItem: "add_task_item",
  removeTaskItem: "remove_task_item",
  toggleTaskLink: "toggle_task_link",
} as const;

export const MAX_PROJECT_ROWS = 6;
export const MAX_TASK_ITEMS = MAX_CHECKLIST_ITEMS;
export const MAX_PTO_BUSINESS_DAYS = 10;

export const BLOCK = {
  workDate: "work_date",
  rowActions: "row_actions",
  ptoType: "pto_type",
  ptoStart: "pto_start",
  ptoEnd: "pto_end",
} as const;

/** Action id inside every single-element input block. */
export const INPUT_ACTION = "value";

export const rowBlock = {
  project: (n: number) => `row_${n}_project`,
  hours: (n: number) => `row_${n}_hours`,
  task: (n: number) => `row_${n}_task`,
  taskItem: (n: number, item: number) => (item === 1 ? `row_${n}_task` : `row_${n}_task_${item}`),
  taskLink: (n: number, item: number) => `row_${n}_link_${item}`,
  taskItemActions: (n: number, item: number) => `row_${n}_task_item_actions_${item}`,
  taskActions: (n: number) => `row_${n}_task_actions`,
};
