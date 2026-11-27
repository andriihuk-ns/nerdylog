"use client";

import { useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

export interface ExportItem {
  kind: "csv" | "pdf";
  href: string;
  /** Overrides the file type label when a period has multiple CSV exports. */
  label?: string;
}

export interface ExportGroups {
  week: ExportItem[];
  month: ExportItem[];
}

const ICON: Record<ExportItem["kind"], LucideIcon> = { csv: FileSpreadsheet, pdf: FileText };

/** Shared Export > Week/Month > CSV/PDF menu used across report surfaces. */
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

  function options(items: ExportItem[]) {
    return items.map((item) => {
      const Icon = ICON[item.kind];
      return (
        <DropdownMenuItem key={item.href} disabled={pendingHref !== null} onSelect={() => void download(item)} className="min-h-11">
          <Icon aria-hidden />
          {item.label ?? t(item.kind)}
        </DropdownMenuItem>
      );
    });
  }

  return (
    <>
      <div role="group" aria-label={t("label")} aria-busy={pendingHref !== null}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="hit-target w-full sm:w-auto" disabled={pendingHref !== null}>
              <Download aria-hidden />
              {t("label")}
              <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="min-h-11">{t("week")}</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="min-w-48">{options(groups.week)}</DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="min-h-11">{t("month")}</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="min-w-48">{options(groups.month)}</DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Toast toast={toast} onDismiss={dismiss} />
    </>
  );
}
