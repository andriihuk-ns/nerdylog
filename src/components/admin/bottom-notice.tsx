"use client";

import { createPortal } from "react-dom";
import type { ToastState } from "@/hooks/use-toast";

/**
 * A29 notification above an open dialog. It takes no pointer events: a click on anything outside
 * a modal dialog would close it. It sits above the regular toast so both stay readable.
 */
export function BottomNotice({ notice }: { notice: ToastState | null }) {
  if (!notice) return null;
  return createPortal(
    <div role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
      <p
        key={notice.id}
        className="max-w-md animate-in rounded-lg border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-[0_8px_24px_rgb(0_0_0/0.16)] fade-in slide-in-from-bottom-2 dark:shadow-[0_8px_24px_rgb(0_0_0/0.4)]"
      >
        {notice.message}
      </p>
    </div>,
    document.body,
  );
}
