export type SortValue = string | number | null | undefined;
export type SortDirection = "asc" | "desc";

const isEmpty = (value: SortValue) => value === null || value === undefined || value === "";

/** Position of every row id once sorted. Empty values stay last in both directions; ties keep order. */
export function sortRanks<T>(
  rows: readonly T[],
  id: (row: T) => string,
  value: (row: T) => SortValue,
  direction: SortDirection,
): Map<string, number> {
  const sign = direction === "asc" ? 1 : -1;
  const sorted = [...rows].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (isEmpty(x) || isEmpty(y)) return Number(isEmpty(x)) - Number(isEmpty(y));
    if (typeof x === "number" && typeof y === "number") return (x - y) * sign;
    return String(x).localeCompare(String(y), undefined, { numeric: true }) * sign;
  });
  return new Map(sorted.map((row, index) => [id(row), index]));
}
