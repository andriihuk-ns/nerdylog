"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { parseThemePref, resolveDark, THEME_STORAGE_KEY, type ThemePref } from "./theme";

const listeners = new Set<() => void>();
const DARK_QUERY = "(prefers-color-scheme: dark)";

function readPref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function apply(pref: ThemePref) {
  const dark = resolveDark(pref, window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Current theme choice + setter, backed by localStorage. THEME_INIT_SCRIPT in
 * layout.tsx applies the stored choice before first paint (no flash).
 */
export function useTheme(): { choice: ThemePref; setChoice: (next: ThemePref) => void } {
  const choice = useSyncExternalStore(subscribe, readPref, () => "system" as const);

  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const setChoice = useCallback((next: ThemePref) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: still switch for this page view.
    }
    apply(next);
    listeners.forEach((l) => l());
  }, []);

  return { choice, setChoice };
}
