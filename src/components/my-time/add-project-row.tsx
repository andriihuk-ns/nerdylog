"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProjectOption, ProjectRef } from "./week-matrix";
import { STICKY_PROJECT_COLUMN, STICKY_TOTAL_COLUMN } from "./week-grid-styles";

interface Props {
  options: ProjectOption[];
  dayCount: number;
  onAdd: (project: ProjectRef) => void;
}

/** Picks another active project to add an empty row for it. A15: every project is listed; ones the
 * person is not a member of are disabled with the reason underneath. */
export function AddProjectSelect({ options, onAdd }: Pick<Props, "options" | "onAdd">) {
  const t = useTranslations("myTime");
  const sorted = [...options].sort((a, b) => Number(a.disabledReason !== null) - Number(b.disabledReason !== null));
  return (
    <Select
      value=""
      onValueChange={(id) => {
        const project = options.find((o) => o.id === id && o.disabledReason === null);
        if (project) onAdd({ id: project.id, name: project.name });
      }}
    >
      <SelectTrigger
        aria-label={t("addProjectRow")}
        className="hit-target w-fit justify-start gap-2 border-transparent px-2 text-muted-foreground shadow-none hover:text-foreground [&>svg:last-child]:hidden"
      >
        <Plus aria-hidden />
        <SelectValue placeholder={t("addProject")} />
      </SelectTrigger>
      <SelectContent className="max-w-80">
        {sorted.map((o) => (
          <SelectItem key={o.id} value={o.id} disabled={o.disabledReason !== null} textValue={o.name} className="data-disabled:text-muted-foreground data-disabled:opacity-100">
            <span className="flex flex-col items-start">
              <span>{o.name}</span>
              {o.disabledReason ? <span className="text-xs whitespace-normal text-muted-foreground">{o.disabledReason}</span> : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Last grid row. */
export function AddProjectRow({ options, dayCount, onAdd }: Props) {
  if (options.length === 0) return null;
  return (
    <tr>
      <td className={`${STICKY_PROJECT_COLUMN} border-b px-2 py-1 sm:px-3`}>
        <AddProjectSelect options={options} onAdd={onAdd} />
      </td>
      {Array.from({ length: dayCount }, (_, index) => (
        <td key={index} aria-hidden="true" className="border-b border-l border-border" />
      ))}
      <td aria-hidden="true" className={`${STICKY_TOTAL_COLUMN} border-b`} />
    </tr>
  );
}
