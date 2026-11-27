"use client";

import { useMemo, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import type { DirectoryUser, OfficeView, ProjectView } from "@/contracts";
import { cn } from "@/lib/utils";
import { syncFromSlackAction } from "@/app/(dashboard)/admin/actions";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { SearchInput } from "@/components/shell/search-input";
import { FilterSelect } from "@/components/shell/filter-select";
import { DirectoryRow } from "./directory-row";
import {
  ALL,
  EMPTY_FILTERS,
  filterDirectory,
  hasFilters,
  NONE,
} from "./directory-filters";
import { syncSummary } from "./sync-summary";

interface Props {
  users: DirectoryUser[];
  projects: ProjectView[];
  offices: OfficeView[];
}

const COLUMNS = [
  "status",
  "name",
  "title",
  "office",
  "role",
  "dailyNorm",
  "allowance",
] as const;

/** FR-WEB-06 Team Directory (A15): Sync from Slack, search + project/office filters, per-field save status. */
export function DirectoryPanel({ users, projects, offices }: Props) {
  const t = useTranslations("admin.directory");
  const { toast, show, dismiss } = useToast();
  const [syncing, startSync] = useTransition();
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState(ALL);
  const [officeId, setOfficeId] = useState(ALL);
  const debounced = useDebouncedValue(query);
  const filters = { query: debounced, projectId, officeId };
  const shown = useMemo(
    () => filterDirectory(users, { query: debounced, projectId, officeId }),
    [users, debounced, projectId, officeId],
  );

  function sync() {
    startSync(async () => {
      const res = await syncFromSlackAction();
      if (!res.ok)
        show(t("syncFailed", { reason: res.message }), {
          tone: "error",
          onRetry: sync,
        });
      else
        show(
          syncSummary(res.data, t),
          res.data.projects.failed > 0 ? { tone: "error", onRetry: sync } : {},
        );
    });
  }

  return (
    <section aria-labelledby="directory-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div
          role="search"
          className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <SearchInput
            value={query}
            onChange={setQuery}
            label={t("search")}
            className="w-full sm:min-w-56 sm:flex-1"
          />
          <FilterSelect
            label={t("projectFilter")}
            value={projectId}
            onChange={setProjectId}
            options={[
              { value: ALL, label: t("allProjects") },
              ...projects.map((p) => ({ value: p.id, label: p.name })),
            ]}
            className="w-full sm:w-48"
          />
          <FilterSelect
            label={t("officeFilter")}
            value={officeId}
            onChange={setOfficeId}
            options={[
              { value: ALL, label: t("allOffices") },
              ...offices.map((o) => ({
                value: o.id,
                label: `${o.code} · ${o.name}`,
              })),
              { value: NONE, label: t("noOffice") },
            ]}
            className="w-full sm:w-44"
          />
          <p
            id="directory-title"
            className="text-xs text-muted-foreground sm:px-1"
          >
            {t.rich("counts", {
              active: users.filter((u) => u.isActive).length,
              archived: users.filter((u) => !u.isActive).length,
              n: (chunks) => <span className="tabular">{chunks}</span>,
            })}
          </p>
        </div>
        <Button
          onClick={sync}
          disabled={syncing}
          className="hit-target w-full sm:w-auto"
        >
          <RefreshCw
            aria-hidden
            className={cn(syncing && "motion-safe:animate-spin")}
          />
          {syncing ? t("syncing") : t("sync")}
        </Button>
      </div>
      {users.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("empty")}
        </p>
      ) : shown.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-6 text-muted-foreground">
          <p>{t("noMatch")}</p>
          <Button
            variant="outline"
            className="hit-target"
            onClick={() => {
              setQuery(EMPTY_FILTERS.query);
              setProjectId(ALL);
              setOfficeId(ALL);
            }}
          >
            {t("clearFilters")}
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          {hasFilters(filters) ? (
            <p
              className="border-b px-4 py-2 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {t("showing", { shown: shown.length, total: users.length })}
            </p>
          ) : null}
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b text-xs font-medium text-muted-foreground">
                {COLUMNS.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className={cn(
                      "h-10 px-2 text-left font-medium whitespace-nowrap",
                      c === "name" && "sticky left-0 z-10 bg-card px-4",
                      (c === "dailyNorm" || c === "allowance") && "text-right",
                    )}
                  >
                    {t(`columns.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <DirectoryRow
                  key={u.id}
                  user={u}
                  offices={offices}
                  onToast={(message, tone) => show(message, tone ? { tone } : {})}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
