/** Theme preference: "system" follows prefers-color-scheme; stored in localStorage. */
export type ThemePref = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "tempo-theme";
export const THEME_ORDER: readonly ThemePref[] = ["system", "light", "dark"];
export const THEME_LABEL: Record<ThemePref, string> = { system: "System", light: "Light", dark: "Dark" };

export function parseThemePref(value: unknown): ThemePref {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveDark(pref: ThemePref, systemDark: boolean): boolean {
  return pref === "dark" || (pref === "system" && systemDark);
}

/**
 * Inline <head> script: sets `.dark` on <html> before first paint (no flash).
 * Mirrors resolveDark(); keep both in sync.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})()`;
