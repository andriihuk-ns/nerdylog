"use client";

import { useMemo, useState } from "react";
import { sortRanks, type SortDirection, type SortValue } from "@/components/lib/sort";

export type SortState<K extends string> = { key: K; direction: SortDirection } | null;

/**
 * Column sorting that cycles ascending → descending → default order. The order is taken when the
 * sort, the set of rows or `scope` changes, so editing a value does not move its row.
 * `apply` also orders a filtered subset of `rows`.
 */
export function useTableSort<T, K extends string>(
  rows: readonly T[],
  id: (row: T) => string,
  columns: Record<K, (row: T) => SortValue>,
  scope = "",
) {
  const [sort, setSort] = useState<SortState<K>>(null);
  const version = `${scope}|${rows.map(id).sort().join()}`;
  const ranks = useMemo(
    () => (sort ? sortRanks(rows, id, columns[sort.key], sort.direction) : null),
    // Deliberately not `rows`/`columns`: see the comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort, version],
  );

  function toggle(key: K) {
    setSort((current) => {
      if (current?.key !== key) return { key, direction: "asc" };
      return current.direction === "asc" ? { key, direction: "desc" } : null;
    });
  }

  function apply<R extends T>(subset: readonly R[]): R[] {
    if (!ranks) return [...subset];
    return [...subset].sort((a, b) => (ranks.get(id(a)) ?? 0) - (ranks.get(id(b)) ?? 0));
  }

  /** Props for the `SortableHead` of one column. */
  const head = (key: K) => ({
    direction: sort?.key === key ? sort.direction : null,
    onSort: () => toggle(key),
  });

  return { apply, head };
}
