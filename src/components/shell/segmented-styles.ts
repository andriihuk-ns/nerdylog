/**
 * Segmented-control look shared with the tabs (docs/05): a muted track with ~3px padding and a
 * raised pill for the active segment. Segments keep the same box in both states (no layout shift).
 */
export const SEGMENT_TRACK = "inline-flex items-center gap-0.5 rounded-lg bg-muted p-[3px] text-muted-foreground";

export const SEGMENT_BASE = [
  "relative inline-flex h-full min-w-8 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium select-none outline-none",
  "transition-[color,background-color,box-shadow] duration-(--duration-base) ease-spring hover:text-foreground",
  "[&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
  // 44px hit target without growing the visual segment.
  "before:absolute before:inset-x-0 before:-inset-y-[10px] before:content-['']",
].join(" ");

export const SEGMENT_ACTIVE =
  "bg-card text-foreground shadow-[0_1px_2px_0_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.06)] dark:bg-foreground/10 dark:shadow-[0_1px_2px_0_rgb(0_0_0/0.4),inset_0_0_0_1px_rgb(255_255_255/0.06)]";
