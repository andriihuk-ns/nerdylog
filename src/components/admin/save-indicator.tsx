"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { FieldSave } from "@/hooks/save-state";

/**
 * A15 per-field status next to an inline editor: "Saving…" → "Saved ✓" (fades) → inline error.
 * Only opacity animates; reduced motion just swaps the state.
 */
export function SaveIndicator({ state, className }: { state: FieldSave; className?: string }) {
  const t = useTranslations("common");
  const text =
    state.status === "saving" ? t("saving") : state.status === "error" ? (state.message ?? t("saveFailed")) : t("saved");
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex min-h-4 items-center", className)}>
      {state.seq > 0 ? (
        <span
          aria-hidden={!state.visible || undefined}
          className={cn(
            "inline-flex items-center gap-1 text-xs motion-safe:transition-opacity motion-safe:duration-(--duration-slow)",
            state.visible ? "opacity-100" : "opacity-0",
            state.status === "error" ? "text-destructive" : state.status === "saving" ? "text-muted-foreground" : "text-work",
            state.status !== "error" && "whitespace-nowrap",
          )}
        >
          {text}
          {state.status === "saved" || state.status === "idle" ? <Check aria-hidden className="size-3.5" /> : null}
        </span>
      ) : null}
    </span>
  );
}
