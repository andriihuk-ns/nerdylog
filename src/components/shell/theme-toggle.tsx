"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextThemePref, parseThemePref, resolveDark, THEME_STORAGE_KEY, type ThemePref } from "./theme";

const listeners = new Set<() => void>();

function readPref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function apply(pref: ThemePref) {
  const dark = resolveDark(pref, window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

const LABEL: Record<ThemePref, string> = {
  system: "Theme: system",
  light: "Theme: light",
  dark: "Theme: dark",
};

/** Cycles system → light → dark. The inline script in layout.tsx applies it before paint. */
export function ThemeToggle() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "system" as const);

  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const cycle = useCallback(() => {
    const next = nextThemePref(readPref());
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage blocked: still switch for this page view.
    }
    apply(next);
    listeners.forEach((l) => l());
  }, []);

  const Icon = pref === "dark" ? Moon : pref === "light" ? Sun : Monitor;
  return (
    <Button variant="ghost" size="icon" className="hit-target" onClick={cycle} aria-label={`${LABEL[pref]}. Change theme`}>
      <Icon aria-hidden />
    </Button>
  );
}
