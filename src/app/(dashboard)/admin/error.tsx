"use client";

import { RouteError } from "@/components/shell/route-error";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} area="admin" />;
}
