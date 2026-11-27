"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { moveItem } from "./move-item";

/**
 * Drag a row by its handle (mouse, pen or touch), or move it with the arrow keys. Rows carry
 * `data-drag-id` inside `bodyRef`; `onCommit` runs only when the order actually changed.
 */
export function useDragOrder(saved: string[], onCommit: (ids: string[]) => void) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  const [drag, setDrag] = useState<{ id: string; ids: string[] } | null>(null);
  const stop = useRef<() => void>(() => {});
  useEffect(() => () => stop.current(), []);

  /** Position the pointer asks for: after every other row whose middle is above it. */
  function indexAt(y: number, id: string): number {
    const rows = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>("[data-drag-id]") ?? []);
    return rows.filter((row) => {
      const box = row.getBoundingClientRect();
      return row.dataset.dragId !== id && box.top + box.height / 2 < y;
    }).length;
  }

  function start(id: string, event: ReactPointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault(); // no text selection while dragging
    stop.current();
    let ids = saved;
    setDrag({ id, ids });
    // Window listeners: reordering moves the handle in the DOM, which would drop pointer capture.
    const move = (e: PointerEvent) => {
      ids = moveItem(ids, id, indexAt(e.clientY, id));
      setDrag({ id, ids });
    };
    const finish = (commit: boolean) => {
      stop.current();
      setDrag(null);
      if (commit && ids.join() !== saved.join()) onCommit(ids);
    };
    const up = () => finish(true);
    const cancel = () => finish(false);
    const escape = (e: globalThis.KeyboardEvent) => e.key === "Escape" && finish(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("keydown", escape);
    stop.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("keydown", escape);
    };
  }

  function key(id: string, event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    const ids = moveItem(saved, id, saved.indexOf(id) + step);
    if (ids === saved) return;
    onCommit(ids);
    const handle = event.currentTarget;
    requestAnimationFrame(() => handle.focus()); // the moved row can lose focus
  }

  return {
    bodyRef,
    ids: drag?.ids ?? saved,
    dragging: drag?.id ?? null,
    start,
    key,
  };
}
