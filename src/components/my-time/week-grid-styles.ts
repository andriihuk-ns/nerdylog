/** Shared pinned project column, including the mobile width that keeps day cells visible. */
export const STICKY_PROJECT_COLUMN =
  "sticky left-0 z-10 w-[132px] min-w-[132px] max-w-[132px] bg-card text-left sm:w-[200px] sm:min-w-[200px] sm:max-w-[200px]";

/** Equal fixed-width day tracks keep long task details from distorting the calendar. */
export const DAY_COLUMN = "w-28 min-w-28 max-w-28 sm:w-32 sm:min-w-32 sm:max-w-32";

/** Keep weekly totals visible while the day columns scroll horizontally. */
export const STICKY_TOTAL_COLUMN =
  "sticky right-0 z-20 w-24 min-w-24 max-w-24 bg-card text-right sticky-edge-left";
