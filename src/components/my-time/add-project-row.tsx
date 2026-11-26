"use client";

import { Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProjectRef } from "./week-matrix";

interface Props {
  colSpan: number;
  options: ProjectRef[];
  onAdd: (project: ProjectRef) => void;
}

/** Last grid row: pick another active project to add an empty row for it. */
export function AddProjectRow({ colSpan, options, onAdd }: Props) {
  if (options.length === 0) return null;
  return (
    <tr>
      <td colSpan={colSpan} className="border-b px-2 py-1">
        <Select
          value=""
          onValueChange={(id) => {
            const project = options.find((o) => o.id === id);
            if (project) onAdd(project);
          }}
        >
          <SelectTrigger
            aria-label="Add a project row"
            className="hit-target w-[200px] border-transparent text-muted-foreground shadow-none hover:text-foreground"
          >
            <Plus aria-hidden />
            <SelectValue placeholder="Add project" />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    </tr>
  );
}
