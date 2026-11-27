"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProjectOption, ProjectRef } from "./week-matrix";

interface Props {
  colSpan: number;
  options: ProjectOption[];
  onAdd: (project: ProjectRef) => void;
}

/**
 * Last grid row: pick another active project to add an empty row for it. A15: every project is
 * listed; ones the person is not a member of are disabled with the reason underneath.
 */
export function AddProjectRow({ colSpan, options, onAdd }: Props) {
  const t = useTranslations("myTime");
  if (options.length === 0) return null;
  const sorted = [...options].sort((a, b) => Number(a.disabledReason !== null) - Number(b.disabledReason !== null));
  return (
    <tr>
      <td colSpan={colSpan} className="border-b px-2 py-1">
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
      </td>
    </tr>
  );
}
