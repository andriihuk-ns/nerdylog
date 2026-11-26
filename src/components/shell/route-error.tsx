"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { ErrorPanel } from "./state-panels";

export type RouteErrorArea = "myTime" | "team" | "admin";

/** Shared body for (dashboard) error.tsx files. Server error messages are hidden in production. */
export function RouteError({ error, retry, area }: { error: unknown; retry: () => void; area: RouteErrorArea }) {
  const t = useTranslations("errors.load");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorPanel message={t(area)} onRetry={retry} />;
}
