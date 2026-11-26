"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** Inline Retry for server-rendered sections: re-runs the route's server render. */
export function RefreshButton({ label }: { label?: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="hit-target"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {label ?? t("retry")}
    </Button>
  );
}
