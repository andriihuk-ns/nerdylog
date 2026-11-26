"use client";

import { AlertCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** docs/05 §6 load error: one sentence + Retry, in place of the content. Never a blank page. */
export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-lg border bg-card p-6 sm:flex-row sm:items-center">
      <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />
      <p className="flex-1">{message}</p>
      <Button variant="outline" className="hit-target" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function NoAccessPanel({ area }: { area: string }) {
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-6">
      <Lock className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <p>
        {area} is available to {area === "Admin" ? "admins" : "managers and admins"}. Ask an admin if you need
        access.
      </p>
    </div>
  );
}
