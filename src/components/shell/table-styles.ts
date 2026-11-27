/** Keep table content comfortably inset from the outside edges of its frame. */
export const TABLE_EDGE_PADDING = "[&_tr>*:first-child]:pl-4 [&_tr>*:last-child]:pr-4";

/**
 * Edge rules for pinned columns. Drawn as pseudo-elements because a `border-collapse` border
 * stays with the table grid and scrolls away from a sticky cell. The cell must be positioned.
 */
export const PINNED_EDGE_RIGHT = "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border";
export const PINNED_EDGE_LEFT = "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border";
