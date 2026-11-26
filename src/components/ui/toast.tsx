"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ToastState } from "@/hooks/use-toast";

/**
 * Minimal inline toast (no extra package). Live region announces the message;
 * Esc dismisses; Retry re-sends the failed action.
 */
export function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toast, onDismiss]);

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {toast ? (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border bg-popover py-1 pr-1 pl-4 text-popover-foreground shadow-[0_8px_24px_rgb(0_0_0/0.08)] dark:shadow-[0_8px_24px_rgb(0_0_0/0.4)]",
            "animate-in fade-in slide-in-from-bottom-2 duration-[var(--duration-base)]",
            toast.tone === "error" && "border-destructive/40",
          )}
        >
          <p className={cn("py-2", toast.tone === "error" && "text-destructive")}>{toast.message}</p>
          {toast.onRetry ? (
            <Button
              variant="ghost"
              className="hit-target"
              onClick={() => {
                toast.onRetry?.();
                onDismiss();
              }}
            >
              Retry
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" className="hit-target" onClick={onDismiss} aria-label="Dismiss">
            <X aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
