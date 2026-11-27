"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog, type ConfirmOptions } from "@/components/shell/confirm-dialog";

/**
 * A16: promise-based replacement for window.confirm. Render `dialog` once in the component;
 * `await confirm({ title, confirmLabel })` resolves true on confirm, false on cancel / Esc.
 */
export function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean>; dialog: ReactNode } {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const onResult = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const dialog = options ? <ConfirmDialog open {...options} onResult={onResult} /> : null;
  return { confirm, dialog };
}
