"use client";

import { useRef, useState } from "react";
import { CalendarRange, ChevronDown, FileSpreadsheet, FileText, X, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { isIsoDate } from "@/components/lib/dates";
import { exportHref } from "./export-href";

export interface ExportItem {
  kind: "csv" | "pdf";
  href: string;
  /** Overrides the default "CSV" / "PDF" label (e.g. "Ledger CSV"). */
  label?: string;
}

export interface ExportGroups {
  week: ExportItem[];
  month: ExportItem[];
  customRange?: { from: string; to: string; extra?: Record<string, string> };
}

const ICON: Record<ExportItem["kind"], LucideIcon> = { csv: FileSpreadsheet, pdf: FileText };

/** A15: "Week ▾" and "Month ▾" menus of download links to /api/export/** (Backend-owned). */
export function ExportMenus({ groups }: { groups: ExportGroups }) {
  const t = useTranslations("exports");
  const tc = useTranslations("common");
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(groups.customRange?.from ?? "");
  const [rangeTo, setRangeTo] = useState(groups.customRange?.to ?? "");
  const [rangeError, setRangeError] = useState(false);
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

  async function downloadRange(kind: ExportItem["kind"]) {
    const inclusiveDays = (Date.parse(`${rangeTo}T00:00:00Z`) - Date.parse(`${rangeFrom}T00:00:00Z`)) / 86_400_000 + 1;
    if (!isIsoDate(rangeFrom) || !isIsoDate(rangeTo) || rangeFrom > rangeTo || inclusiveDays > 366) {
      setRangeError(true);
      return;
    }
    setRangeError(false);
    const href = exportHref(kind === "csv" ? "/api/export/ledger.csv" : "/api/export/report.pdf", {
      from: rangeFrom,
      to: rangeTo,
      ...groups.customRange?.extra,
    });
    await download({ kind, href });
    setRangeOpen(false);
  }

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center" role="group" aria-label={t("label")} aria-busy={pendingHref !== null}>
        <ExportMenu label={t("week")} items={groups.week} disabled={pendingHref !== null} onExport={download} />
        <ExportMenu label={t("month")} items={groups.month} disabled={pendingHref !== null} onExport={download} />
        {groups.customRange ? (
          <Button
            type="button"
            variant="outline"
            className="hit-target col-span-2 w-full sm:w-auto"
            onClick={() => {
              setRangeFrom(groups.customRange?.from ?? "");
              setRangeTo(groups.customRange?.to ?? "");
              setRangeError(false);
              setRangeOpen(true);
            }}
          >
            <CalendarRange aria-hidden />
            {t("customRange")}
          </Button>
        ) : null}
      </div>
      <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="flex min-h-0 flex-1 flex-col">
            <DialogHeader className="relative border-b px-5 py-4 pr-16 sm:px-6">
              <DialogTitle>{t("rangeTitle")}</DialogTitle>
              <DialogDescription>{t("rangeDescription")}</DialogDescription>
              <DialogClose asChild>
                <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 hit-target size-11" aria-label={tc("cancel")}>
                  <X aria-hidden className="size-4" />
                </Button>
              </DialogClose>
            </DialogHeader>
            <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-range-from">{t("from")}</Label>
                <Input id="export-range-from" type="date" required value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} aria-invalid={rangeError || undefined} className="hit-target" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="export-range-to">{t("to")}</Label>
                <Input id="export-range-to" type="date" required value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} aria-invalid={rangeError || undefined} className="hit-target" />
              </div>
              {rangeError ? <p role="alert" className="text-sm text-destructive">{t("invalidRange")}</p> : null}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:flex-row sm:justify-end sm:px-6">
              <Button type="button" variant="ghost" className="hit-target" onClick={() => setRangeOpen(false)}>{tc("cancel")}</Button>
              <Button type="button" variant="outline" className="hit-target" disabled={pendingHref !== null} onClick={() => void downloadRange("csv")}>{t("csv")}</Button>
              <Button type="button" className="hit-target" disabled={pendingHref !== null} onClick={() => void downloadRange("pdf")}>{t("pdf")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
