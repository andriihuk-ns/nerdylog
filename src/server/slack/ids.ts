/** Stable Block Kit identifiers shared by builders, parsers and handlers. */

export const CALLBACK = {
  time: "tempo_time_modal",
  pto: "tempo_pto_modal",
  loading: "tempo_loading",
  notice: "tempo_notice",
} as const;

export const ACTION = {
  openStandup: "open_standup",
  openPto: "open_pto",
  homeLog: "home_log",
  homePto: "home_pto",
  openWeb: "open_web",
  addRow: "add_row",
  removeRow: "remove_row",
} as const;

export const MAX_PROJECT_ROWS = 6;
export const MAX_PTO_BUSINESS_DAYS = 10;

export const BLOCK = {
  workDate: "work_date",
  plan: "plan_today",
  blockers: "blockers",
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
};
