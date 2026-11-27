"use client";

import { useTransition } from "react";
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
    <li aria-busy={pending} className="flex min-w-[19rem] flex-col gap-1.5 rounded-md bg-muted/40 px-2 py-2 sm:min-w-[24rem] sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="max-w-48 truncate text-sm font-medium" title={member.fullName}>{member.fullName}</span>
      <div className="flex items-center gap-1.5">
        <div role="group" aria-label={t("allocationPresets", { name: member.fullName })} className="flex items-center gap-1">
          {PROJECT_ALLOCATION_PRESETS.map((value) => {
            const hours = hoursForAllocationPercent(value);
            return (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={percent === value ? "secondary" : "ghost"}
                aria-pressed={percent === value}
                aria-label={t("allocationPercent", { name: member.fullName, percent: value })}
                disabled={pending}
                onClick={() => save(hours)}
              >
                {value}%
              </Button>
            );
          })}
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
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
    </li>
  );
}
