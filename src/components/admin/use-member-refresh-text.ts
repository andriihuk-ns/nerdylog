"use client";

import { useTranslations } from "next-intl";
import type { MemberRefresh } from "@/app/(dashboard)/admin/sync-result";

/** Member refresh outcome → toast sentence; `needsInvite` is a warning (existing members kept). */
export function useMemberRefreshText(): (outcome: MemberRefresh, channel: string) => { text: string; warn: boolean } {
  const t = useTranslations("admin.projects");
  return (outcome, channel) =>
    outcome.status === "needsInvite"
      ? { text: t("needsInvite", { channel }), warn: true }
      : { text: t("membersRefreshed", { channel, count: outcome.members, skipped: outcome.skipped }), warn: false };
}
