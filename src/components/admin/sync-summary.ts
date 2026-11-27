import type { SlackSyncResult } from "@/app/(dashboard)/admin/sync-result";

type SyncKey = "synced" | "syncedWithProjects" | "people" | "projects" | "projectsFailed" | "projectsNeedInvite";
/** The `admin.directory` translator (useTranslations / createTranslator). */
export type SyncTranslate = (key: SyncKey, values: Record<string, string | number>) => string;

/** Toast copy (plurals in messages/*.json): "Synced from Slack: 12 people (2 new) · members of 3 projects refreshed (1 failed) · 1 needs @nerdylog invited." */
export function syncSummary({ people, projects }: SlackSyncResult, t: SyncTranslate): string {
  const peoplePart = t("people", { count: people.created + people.updated, created: people.created });
  if (projects.refreshed + projects.failed + projects.needsInvite === 0) return t("synced", { people: peoplePart });
  const projectPart = t("projects", { count: projects.refreshed });
  const failedPart = projects.failed > 0 ? t("projectsFailed", { count: projects.failed }) : "";
  const invitePart = projects.needsInvite > 0 ? t("projectsNeedInvite", { count: projects.needsInvite }) : "";
  return t("syncedWithProjects", { people: peoplePart, projects: `${projectPart}${failedPart}${invitePart}` });
}
