"use client";

import { AlertCircle, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** docs/05 §6 load error: one sentence + Retry, in place of the content. Never a blank page. */
export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations("common");
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-lg border bg-card p-6 sm:flex-row sm:items-center">
      <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />
      <p className="flex-1">{message}</p>
      <Button variant="outline" className="hit-target" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}

/** Members opening /team, or non-admins opening /admin. */
export function NoAccessPanel({ area }: { area: "team" | "admin" }) {
  const t = useTranslations("errors.noAccess");
  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-6">
      <Lock className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <p>{t(area)}</p>
    </div>
  );
}
