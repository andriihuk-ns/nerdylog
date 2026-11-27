"use client";

import { ChevronDown, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface ExportItem {
  kind: "csv" | "pdf";
  href: string;
  /** Overrides the default "CSV" / "PDF" label (e.g. "Ledger CSV"). */
  label?: string;
}

export interface ExportGroups {
  week: ExportItem[];
  month: ExportItem[];
}

const ICON: Record<ExportItem["kind"], LucideIcon> = { csv: FileSpreadsheet, pdf: FileText };

/** A15: "Week ▾" and "Month ▾" menus of download links to /api/export/** (Backend-owned). */
export function ExportMenus({ groups }: { groups: ExportGroups }) {
  const t = useTranslations("exports");
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("label")}>
      <ExportMenu label={t("week")} items={groups.week} />
      <ExportMenu label={t("month")} items={groups.month} />
    </div>
  );
}

function ExportMenu({ label, items }: { label: string; items: ExportItem[] }) {
  const t = useTranslations("exports");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="hit-target" aria-label={t("menuFor", { period: label })}>
          {label}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {items.map((item) => {
          const Icon = ICON[item.kind];
          return (
            <DropdownMenuItem key={item.href} asChild className="min-h-11">
              <a href={item.href} download>
                <Icon aria-hidden />
                {item.label ?? t(item.kind)}
              </a>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
