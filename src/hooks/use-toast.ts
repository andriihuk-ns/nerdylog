"use client";

import { useCallback, useEffect, useState } from "react";

export interface ToastState {
  id: number;
  message: string;
  tone: "neutral" | "error" | "loading";
  persistent?: boolean;
  /** Optional retry; error toasts with a retry stay until dismissed. */
  onRetry?: () => void;
}

const AUTO_DISMISS_MS = 5000;
let seq = 0;

/** One toast at a time per feature surface (docs/05 §6 "inline toast"). */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const show = useCallback((message: string, opts: Partial<Omit<ToastState, "id" | "message">> = {}) => {
    seq += 1;
    setToast({ id: seq, message, tone: opts.tone ?? "neutral", onRetry: opts.onRetry });
  }, []);
  const dismiss = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast || toast.persistent || toast.onRetry) return;
    const t = window.setTimeout(() => setToast((cur) => (cur?.id === toast.id ? null : cur)), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [toast]);

  return { toast, show, dismiss };
}
