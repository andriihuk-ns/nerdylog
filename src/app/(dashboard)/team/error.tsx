"use client";

import { RouteError } from "@/components/shell/route-error";

export default function TeamError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} what="the team summary" />;
}
