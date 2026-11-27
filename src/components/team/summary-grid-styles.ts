import { SUB_COLUMNS } from "./team-summary";

/** Every numeric column is 5 rem; 80 px still fits the longest header ("Відп./Лік."). */
const SUB_REM = 5;
export const SUB_WIDTH_CLASS = "w-20";

/** Name column is narrower on phones. `--name-col` is set on the table. */
export const summaryTableWidth = (cols: number) => `calc(var(--name-col) + ${cols * SUB_REM}rem)`;

/** CSS `right` for the n-th pinned monthly-total column. */
export const subColumnOffset = (sub: number) => `${(SUB_COLUMNS.length - sub - 1) * SUB_REM}rem`;
