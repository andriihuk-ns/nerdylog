"use client";

import { useRef, useState } from "react";
import { ChevronDown, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Toast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

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
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const pending = useRef(false);
  const { toast, show, dismiss } = useToast();

  async function download(item: ExportItem) {
    if (pending.current) return;
    pending.current = true;
    setPendingHref(item.href);
    const format = item.label ?? t(item.kind);
    show(t("preparing", { format }), { tone: "loading", persistent: true });
    try {
      const response = await fetch(item.href, { credentials: "same-origin" });
      const disposition = response.headers.get("content-disposition");
      if (!response.ok || !disposition) throw new Error("Export response was not a downloadable file");
      const blob = await response.blob();
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] ?? `nerdylog-export.${item.kind}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      show(t("started", { format }));
    } catch {
      show(t("failed", { format }), { tone: "error" });
    } finally {
      pending.current = false;
      setPendingHref(null);
    }
  }

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center" role="group" aria-label={t("label")} aria-busy={pendingHref !== null}>
        <ExportMenu label={t("week")} items={groups.week} disabled={pendingHref !== null} onExport={download} />
        <ExportMenu label={t("month")} items={groups.month} disabled={pendingHref !== null} onExport={download} />
      </div>
      <Toast toast={toast} onDismiss={dismiss} />
    </>
  );
}

function ExportMenu({
  label,
  items,
  disabled,
  onExport,
}: {
  label: string;
  items: ExportItem[];
  disabled: boolean;
  onExport: (item: ExportItem) => void;
}) {
  const t = useTranslations("exports");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="hit-target w-full sm:w-auto">
          {label}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {items.map((item) => {
          const Icon = ICON[item.kind];
          return (
            <DropdownMenuItem key={item.href} disabled={disabled} onSelect={() => onExport(item)} className="min-h-11">
              <Icon aria-hidden />
              {item.label ?? t(item.kind)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
