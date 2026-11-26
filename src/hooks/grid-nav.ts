/** Pure roving-focus math for role="grid" tables (docs/05 §6.2 keyboard). */

export interface GridPos {
  row: number;
  col: number;
}

export interface GridBounds {
  rows: number;
  cols: number;
}

export interface NavKey {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(max - 1, n));
}

/** Next focused cell for a navigation key, or null when the key is not a navigation key. */
export function nextGridPos(pos: GridPos, key: NavKey, bounds: GridBounds): GridPos | null {
  if (bounds.rows === 0 || bounds.cols === 0) return null;
  const mod = Boolean(key.ctrlKey || key.metaKey);
  switch (key.key) {
    case "ArrowUp":
      return { row: clamp(pos.row - 1, bounds.rows), col: pos.col };
    case "ArrowDown":
      return { row: clamp(pos.row + 1, bounds.rows), col: pos.col };
    case "ArrowLeft":
      return { row: pos.row, col: clamp(pos.col - 1, bounds.cols) };
    case "ArrowRight":
      return { row: pos.row, col: clamp(pos.col + 1, bounds.cols) };
    case "Home":
      return mod ? { row: 0, col: 0 } : { row: pos.row, col: 0 };
    case "End":
      return mod ? { row: bounds.rows - 1, col: bounds.cols - 1 } : { row: pos.row, col: bounds.cols - 1 };
    default:
      return null;
  }
}

/** Keep a stored position valid after rows or columns change. */
export function clampGridPos(pos: GridPos, bounds: GridBounds): GridPos {
  return { row: clamp(pos.row, bounds.rows), col: clamp(pos.col, bounds.cols) };
}
