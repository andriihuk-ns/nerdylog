import { PINNED_EDGE_LEFT, PINNED_EDGE_RIGHT } from "@/components/shell/table-styles";

/** Shared pinned project column, including the mobile width that keeps day cells visible. */
export const STICKY_PROJECT_COLUMN = `sticky left-0 z-10 w-[132px] min-w-[132px] max-w-[132px] bg-card text-left sm:w-[200px] sm:min-w-[200px] sm:max-w-[200px] ${PINNED_EDGE_RIGHT}`;

/** Keep weekly totals visible while the day columns scroll horizontally. */
export const STICKY_TOTAL_COLUMN = `sticky right-0 z-20 w-24 min-w-24 max-w-24 bg-card text-right ${PINNED_EDGE_LEFT}`;

/**
 * With `table-fixed`, the day columns share the width equally, so task text never changes it.
 * The minimum keeps each day at least 240 px (project + 7 × 240 + total).
 */
export const WEEK_TABLE_WIDTH = "w-full min-w-[1908px] table-fixed sm:min-w-[1976px]";
