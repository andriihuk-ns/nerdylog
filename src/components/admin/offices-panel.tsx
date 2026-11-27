"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OfficeView } from "@/contracts";
import { deleteOfficeAction, reorderOfficesAction } from "@/app/(dashboard)/admin/office-actions";
import { useToast } from "@/hooks/use-toast";
import { useFormat } from "@/hooks/use-format";
import { useConfirm } from "@/hooks/use-confirm";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import { CARD_FRAME, CARD_ROW, CARD_TABLE, TABLE_EDGE_PADDING } from "@/components/shell/table-styles";
import { cn } from "@/lib/utils";
import { officeHref } from "./admin-tab";
import { OfficeDialog } from "./office-dialog";
import { useDragOrder } from "./use-drag-order";

/** Offices (draggable into display order, A30): code, name, timezone (A16), member count; create, rename, delete (only when empty, confirmed). A row opens the office page (A37). */
export function OfficesPanel({ offices }: { offices: OfficeView[] }) {
  const [list, change] = useOptimistic(offices, (cur: OfficeView[], next: { remove: string } | { order: string[] }) =>
    "remove" in next ? cur.filter((o) => o.id !== next.remove) : sortByIds(cur, next.order),
  );
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [, startRemove] = useTransition();
  const [, startReorder] = useTransition();
  const { toast, show, dismiss } = useToast();
  const t = useTranslations("admin.offices");
  const tc = useTranslations("common");
  const f = useFormat();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { bodyRef, ids, dragging, start, key } = useDragOrder(list.map((o) => o.id), saveOrder);
  const sorted = sortByIds(list, ids);
  const draggable = sorted.length > 1;
  const editingOffice = list.find((o) => o.id === editing);

  function saveOrder(ids: string[]) {
    startReorder(async () => {
      change({ order: ids });
      const res = await reorderOfficesAction(ids);
      if (res.ok) show(t("orderSaved"));
      else show(t("orderFailed", { reason: res.message }), { tone: "error" });
    });
  }

  function done(office: OfficeView, created: boolean) {
    setEditing(null);
    show(created ? t("created", { name: office.name }) : t("saved", { name: office.name }));
  }

  async function remove(o: OfficeView) {
    const ok = await confirm({ title: t("confirmDelete", { name: o.name }), description: t("confirmDeleteBody"), confirmLabel: tc("delete") });
    if (!ok) return;
    startRemove(async () => {
      change({ remove: o.id });
      const res = await deleteOfficeAction(o.id);
      if (res.ok) show(t("deleted", { name: o.name }));
      else show(t("deleteFailed", { name: o.name, reason: res.message }), { tone: "error" });
    });
  }

  return (
    <section aria-label={t("title")} className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")} className="hit-target w-full sm:w-auto">
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>
      <div className={cn("overflow-x-auto rounded-lg border bg-card", sorted.length > 0 && CARD_FRAME)}>
        {sorted.length === 0 ? (
          <p className="p-6 text-muted-foreground">{t("empty")}</p>
        ) : (
          <table aria-label={t("title")} className={cn("w-full border-collapse", CARD_TABLE, TABLE_EDGE_PADDING)}>
            <tbody ref={bodyRef}>
              {sorted.map((o) => (
                <tr
                  key={o.id}
                  data-drag-id={o.id}
                  onClick={(event) => {
                    if (event.target instanceof Element && event.target.closest("a, button, [data-row-action]")) return;
                    router.push(officeHref(o.id));
                  }}
                  className={cn(dragging === o.id && "bg-accent", "h-11 cursor-pointer border-b hover:bg-muted/50 max-md:grid max-md:grid-cols-[auto_auto_minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-1 md:last:border-b-0", CARD_ROW)}
                >
                  <td className="md:w-px">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hit-target cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                      disabled={!draggable}
                      aria-label={t("reorder", { name: o.name })}
                      onPointerDown={(e) => start(o.id, e)}
                      onKeyDown={(e) => key(o.id, e)}
                    >
                      <GripVertical aria-hidden />
                    </Button>
                  </td>
                  <td className="md:w-px md:pr-3">
                    <span className="inline-block min-w-10 rounded-md bg-muted px-2 py-1 text-center font-mono text-xs font-medium">{o.code}</span>
                  </td>
                  <th scope="row" className="min-w-0 text-left font-medium md:pr-4">
                    <Link href={officeHref(o.id)} className="rounded-sm underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {o.name}
                    </Link>
                  </th>
                  <td className="text-sm text-muted-foreground max-md:col-span-4 md:px-3 md:whitespace-nowrap">{o.timezone}</td>
                  <td className="tabular font-medium max-md:col-span-4 md:px-3 md:text-right">
                    <span aria-hidden className="mr-2 text-xs font-normal text-muted-foreground">{t("columns.members")}</span>
                    {f.count(o.memberCount)}
                  </td>
                  <td className="max-md:col-start-4 max-md:row-start-1 md:px-2">
                    <span data-row-action className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="hit-target" onClick={() => setEditing(o.id)} aria-label={t("edit", { name: o.name })}>
                        <Pencil aria-hidden />
                      </Button>
                      <DeleteButton office={o} onDelete={() => void remove(o)} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <OfficeDialog open={editing === "new" || Boolean(editingOffice)} office={editingOffice} onDone={done} onClose={() => setEditing(null)} />
      <Toast toast={toast} onDismiss={dismiss} />
      {dialog}
    </section>
  );
}

/** Items in the order of `ids`; ids always come from the same list. */
function sortByIds<T extends { id: string }>(items: T[], ids: readonly string[]): T[] {
  return [...items].sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
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
