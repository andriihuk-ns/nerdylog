"use client";

import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { clampGridPos, nextGridPos, type GridBounds, type GridPos } from "./grid-nav";

/**
 * Roving tabindex for a role="grid" table. Cells must render `data-row` / `data-col`
 * and spread `cellProps(row, col)`. Only the active cell is tabbable.
 */
export function useGridNavigation(bounds: GridBounds) {
  const gridRef = useRef<HTMLTableElement>(null);
  const [rawActive, setActive] = useState<GridPos>({ row: 0, col: 0 });
  const active = clampGridPos(rawActive, bounds);

  const focusCell = useCallback((pos: GridPos) => {
    setActive(pos);
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-row="${pos.row}"][data-col="${pos.col}"]`);
    el?.focus();
  }, []);

  /** Returns true when the key moved focus (caller should stop handling it). */
  const handleNavKey = useCallback(
    (event: KeyboardEvent) => {
      const next = nextGridPos(active, event, bounds);
      if (!next) return false;
      event.preventDefault();
      focusCell(next);
      return true;
    },
    [active, bounds, focusCell],
  );

  const cellProps = (row: number, col: number) => ({
    "data-row": row,
    "data-col": col,
    tabIndex: row === active.row && col === active.col ? 0 : -1,
    onFocus: () => {
      if (row !== active.row || col !== active.col) setActive({ row, col });
    },
  });

  return { gridRef, active, focusCell, handleNavKey, cellProps };
}
