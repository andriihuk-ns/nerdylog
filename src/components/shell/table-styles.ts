/** Keep table content comfortably inset from the outside edges of its frame. */
export const TABLE_EDGE_PADDING = "md:[&_tr>*:first-child]:pl-4 md:[&_tr>*:last-child]:pr-4";

/**
 * Edge rules for pinned columns. Drawn as pseudo-elements because a `border-collapse` border
 * stays with the table grid and scrolls away from a sticky cell. The cell must be positioned.
 */
export const PINNED_EDGE_RIGHT = "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border";
export const PINNED_EDGE_LEFT = "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-border";

/**
 * Below `md` a data table becomes a stack of cards (same markup, one DOM): the head is hidden,
 * each row is its own card and lays its cells out with a grid set by the row.
 */
export const CARD_FRAME = "max-md:border-0 max-md:bg-transparent";
export const CARD_TABLE = "max-md:block max-md:[&>thead]:hidden max-md:[&>tbody]:flex max-md:[&>tbody]:flex-col max-md:[&>tbody]:gap-3";
export const CARD_ROW = "max-md:h-auto max-md:rounded-lg max-md:border max-md:bg-card max-md:p-3";
/** Small caption above a value inside a card, standing in for the hidden column head. */
export const CARD_LABEL = "mb-1 block text-xs font-normal text-muted-foreground md:hidden";
