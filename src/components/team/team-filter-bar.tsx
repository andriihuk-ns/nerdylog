"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { IsoDate } from "@/contracts";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { SearchInput } from "@/components/shell/search-input";
import { FilterSelect, type FilterOption } from "@/components/shell/filter-select";
import { teamHref, type TeamFilters } from "./team-summary";

const ALL = "__all";

interface Props {
  month: string;
  drawerDate: IsoDate | null;
  filters: TeamFilters;
  projects: FilterOption[]; // value = project id
}

/** A15 Team search + project filter. Written to the URL (debounced) so grid and drawer filter together. */
export function TeamFilterBar({ month, drawerDate, filters, projects }: Props) {
  const router = useRouter();
  const t = useTranslations("team.filters");
  const [query, setQuery] = useState(filters.q);
  const debounced = useDebouncedValue(query, 300);

  useEffect(() => {
    if (debounced.trim() === filters.q) return;
    router.replace(teamHref(month, drawerDate, { ...filters, q: debounced }), { scroll: false });
  }, [debounced, filters, month, drawerDate, router]);

  return (
    <div role="search" className="flex flex-wrap items-center gap-2">
      <SearchInput value={query} onChange={setQuery} label={t("search")} className="min-w-56 flex-1 sm:max-w-sm" />
      <FilterSelect
        label={t("project")}
        value={filters.project ?? ALL}
        onChange={(v) => router.replace(teamHref(month, drawerDate, { q: query, project: v === ALL ? null : v }), { scroll: false })}
        options={[{ value: ALL, label: t("allProjects") }, ...projects]}
      />
    </div>
  );
}
