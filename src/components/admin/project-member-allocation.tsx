"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  PROJECT_ALLOCATION_PRESETS,
  MAX_MONTH_ALLOCATION_HOURS,
  hoursForAllocationPercent,
  type ProjectMemberAllocation,
} from "@/contracts";
import { updateProjectMemberAllocationAction } from "@/app/(dashboard)/admin/project-actions";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/hooks/use-format";
import { NumberCommitInput } from "./number-commit-input";

interface Props {
  projectId: string;
  projectName: string;
  member: ProjectMemberAllocation;
  onToast: (message: string, tone: "neutral" | "error") => void;
}

export function ProjectMemberAllocationControl({ projectId, projectName, member, onToast }: Props) {
  const t = useTranslations("admin.projects");
  const f = useFormat();
  const [pending, startTransition] = useTransition();

  function save(hoursPerMonth: number) {
    if (hoursPerMonth === member.allocationHoursPerMonth) return;
    startTransition(async () => {
      const result = await updateProjectMemberAllocationAction(projectId, member.userId, hoursPerMonth);
      if (result.ok) onToast(t("allocationSaved"), "neutral");
      else onToast(result.message, "error");
    });
  }

  const percent = PROJECT_ALLOCATION_PRESETS.find(
    (item) => hoursForAllocationPercent(item) === member.allocationHoursPerMonth,
  );

  return (
    <tr aria-busy={pending} className="h-16 border-b last:border-b-0">
      <th scope="row" className="sticky left-0 z-10 bg-card px-4 text-left align-middle font-medium">
        <span className="block max-w-56 truncate" title={member.fullName}>{member.fullName}</span>
      </th>
      <td className="px-3 py-2 align-middle">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div role="group" aria-label={t("allocationPresets", { name: member.fullName })} className="flex flex-wrap items-center gap-1">
            {PROJECT_ALLOCATION_PRESETS.map((value) => {
              const hours = hoursForAllocationPercent(value);
              return (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={percent === value
                    ? "min-h-11 w-[4.5rem] shrink-0 gap-1 border border-input bg-muted px-2 text-foreground hover:bg-muted"
                    : "min-h-11 w-[4.5rem] shrink-0 gap-1 border border-input bg-background px-2 text-foreground hover:bg-muted"}
                  aria-pressed={percent === value}
                  aria-label={t("allocationPercent", { name: member.fullName, percent: value })}
                  disabled={pending}
                  onClick={() => save(hours)}
                >
                  <Check aria-hidden className={percent === value ? "size-3.5" : "size-3.5 invisible"} />
                  {value}%
                </Button>
              );
            })}
          </div>
          <span className="flex items-center gap-1 text-sm font-medium text-foreground">
            <NumberCommitInput
              key={`${member.userId}-${member.allocationHoursPerMonth}`}
              value={member.allocationHoursPerMonth}
              label={t("allocationHours", { name: member.fullName, project: projectName })}
              min={0.5}
              max={MAX_MONTH_ALLOCATION_HOURS}
              step={0.5}
              format={f.hours}
              onCommit={(hours) => hours !== null && save(hours)}
            />
            {t("allocationHoursUnit")}
          </span>
        </div>
      </td>
    </tr>
  );
}
