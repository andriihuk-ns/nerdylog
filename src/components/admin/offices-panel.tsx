"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OfficeView } from "@/contracts";
import { deleteOfficeAction } from "@/app/(dashboard)/admin/office-actions";
import { useToast } from "@/hooks/use-toast";
import { useFormat } from "@/hooks/use-format";
import { useConfirm } from "@/hooks/use-confirm";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { TABLE_EDGE_PADDING } from "@/components/shell/table-styles";
import { OfficeForm } from "./office-form";

/** Offices: code, name, timezone (A16), member count; create, rename, delete (only when empty, confirmed). */
export function OfficesPanel({ offices }: { offices: OfficeView[] }) {
  const [list, removeOptimistic] = useOptimistic(offices, (cur: OfficeView[], id: string) => cur.filter((o) => o.id !== id));
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [, startRemove] = useTransition();
  const { toast, show, dismiss } = useToast();
  const t = useTranslations("admin.offices");
  const tc = useTranslations("common");
  const f = useFormat();
  const { confirm, dialog } = useConfirm();
  const sorted = [...list].sort((a, b) => a.code.localeCompare(b.code));

  function done(office: OfficeView, created: boolean) {
    setEditing(null);
    show(created ? t("created", { name: office.name }) : t("saved", { name: office.name }));
  }

  async function remove(o: OfficeView) {
    const ok = await confirm({ title: t("confirmDelete", { name: o.name }), description: t("confirmDeleteBody"), confirmLabel: tc("delete") });
    if (!ok) return;
    startRemove(async () => {
      removeOptimistic(o.id);
      const res = await deleteOfficeAction(o.id);
      if (res.ok) show(t("deleted", { name: o.name }));
      else show(t("deleteFailed", { name: o.name, reason: res.message }), { tone: "error" });
    });
  }

  return (
    <section aria-label={t("title")} className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")} disabled={editing === "new"} className="hit-target w-full sm:w-auto">
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        {editing === "new" ? (
          <div className="border-b">
            <OfficeForm onDone={done} onCancel={() => setEditing(null)} />
          </div>
        ) : null}
        {sorted.length === 0 && editing !== "new" ? (
          <p className="p-6 text-muted-foreground">{t("empty")}</p>
        ) : (
          <table className={`w-full border-collapse ${TABLE_EDGE_PADDING}`}>
            <thead>
              <tr className="border-b text-xs font-medium text-muted-foreground">
                <th scope="col" className="h-10 w-24 px-4 text-left font-medium">{t("columns.code")}</th>
                <th scope="col" className="px-3 text-left font-medium">{t("columns.name")}</th>
                <th scope="col" className="px-3 text-left font-medium">{t("columns.timezone")}</th>
                <th scope="col" className="px-3 text-right font-medium">{t("columns.members")}</th>
                <th scope="col" className="px-4 text-right font-medium">
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((o) =>
                editing === o.id ? (
                  <tr key={o.id} className="border-b last:border-b-0">
                    <td colSpan={5}>
                      <OfficeForm office={o} onDone={done} onCancel={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={o.id} className="h-11 border-b last:border-b-0">
                    <td className="px-4 font-mono text-xs font-medium">{o.code}</td>
                    <th scope="row" className="px-3 text-left font-medium">{o.name}</th>
                    <td className="px-3 text-sm whitespace-nowrap text-muted-foreground">{o.timezone}</td>
                    <td className="tabular px-3 text-right font-medium">{f.count(o.memberCount)}</td>
                    <td className="px-2">
                      <span className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="hit-target" onClick={() => setEditing(o.id)} aria-label={t("edit", { name: o.name })}>
                          <Pencil aria-hidden />
                        </Button>
                        <DeleteButton office={o} onDelete={() => void remove(o)} />
                      </span>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>
      <Toast toast={toast} onDismiss={dismiss} />
      {dialog}
    </section>
  );
}

/** Disabled with the reason (title + sr text) while people are assigned. */
function DeleteButton({ office, onDelete }: { office: OfficeView; onDelete: () => void }) {
  const t = useTranslations("admin.offices");
  const blocked = office.memberCount > 0;
  const reason = t("deleteBlocked", { count: office.memberCount });
  return (
    <span title={blocked ? reason : undefined}>
      <Button
        variant="ghost"
        size="icon"
        className="hit-target"
        onClick={onDelete}
        disabled={blocked}
        aria-label={blocked ? `${t("delete", { name: office.name })}. ${reason}` : t("delete", { name: office.name })}
      >
        <Trash2 aria-hidden />
      </Button>
    </span>
  );
}
