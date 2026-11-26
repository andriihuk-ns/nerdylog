"use client";

import { useEffect } from "react";
import { ErrorPanel } from "./state-panels";

/** Shared body for (dashboard) error.tsx files. Server error messages are hidden in production. */
export function RouteError({ error, retry, what }: { error: unknown; retry: () => void; what: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorPanel message={`We couldn't load ${what}. Check your connection and try again.`} onRetry={retry} />;
}
