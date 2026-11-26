"use client";

import { useEffect, useRef } from "react";

/** True when the event target is a text field, so single-letter shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/**
 * Page-level single-key shortcuts (`[`, `]`, `T`, `S`). Ignored while typing or with
 * modifier keys, so browser and OS shortcuts keep working.
 */
export function useHotkeys(map: Record<string, () => void>) {
  const ref = useRef(map);
  useEffect(() => {
    ref.current = map;
  });

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const handler = ref.current[event.key] ?? ref.current[event.key.toLowerCase()];
      if (!handler) return;
      event.preventDefault();
      handler();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
