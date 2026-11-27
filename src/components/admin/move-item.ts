/** `ids` with `id` moved to `index` (clamped). Returns the same array when nothing moves. */
export function moveItem(ids: string[], id: string, index: number): string[] {
  const from = ids.indexOf(id);
  const to = Math.max(0, Math.min(ids.length - 1, index));
  if (from < 0 || from === to) return ids;
  const next = ids.filter((other) => other !== id);
  next.splice(to, 0, id);
  return next;
}
