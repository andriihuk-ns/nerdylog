"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ROLES,
  type DirectoryUser,
  type OfficeView,
  type Role,
} from "@/contracts";
import { cn } from "@/lib/utils";
import {
  updateDirectoryUserAction,
  type DirectoryPatch,
} from "@/app/(dashboard)/admin/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { FilterSelect } from "@/components/shell/filter-select";
import { CARD_LABEL, CARD_ROW } from "@/components/shell/table-styles";
import { initials } from "@/components/lib/format";
import { useFormat } from "@/hooks/use-format";
import { useConfirm } from "@/hooks/use-confirm";
import { NumberCommitInput } from "./number-commit-input";
import { NONE } from "./directory-filters";

/** Touch-sized in the phone cards; 32px inside the table, like the project allocation controls. */
const COMPACT_SELECT = "w-full md:min-h-8 md:data-[size=default]:h-8";

/** One Directory row (Status first, A16); every control saves optimistically and reports via bottom toast. */
export function DirectoryRow({
  user,
  offices,
  onToast,
}: {
  user: DirectoryUser;
  offices: OfficeView[];
  onToast: (message: string, tone?: "neutral" | "error") => void;
}) {
  const [view, applyPatch] = useOptimistic(
    user,
    (u: DirectoryUser, patch: DirectoryPatch) => ({ ...u, ...patch }),
  );
  const [, startTransition] = useTransition();
  const t = useTranslations("admin.directory");
  const tc = useTranslations("common");
  const tRole = useTranslations("roles");
  const f = useFormat();
  const { confirm, dialog } = useConfirm();

  function update(patch: DirectoryPatch) {
    startTransition(async () => {
      applyPatch(patch);
      const res = await updateDirectoryUserAction(user.id, patch);
      if (res.ok) onToast(tc("saved"));
      else onToast(res.message, "error");
    });
  }

  async function setActive(isActive: boolean) {
    if (!isActive) {
      const ok = await confirm({
        title: t("confirmArchive", { name: view.fullName }),
        description: t("confirmArchiveBody"),
        confirmLabel: t("archive"),
      });
      if (!ok) return;
    }
    update({ isActive });
  }

  return (
    <tr
      className={cn(
        "h-11 border-b md:last:border-b-0",
        "max-md:relative max-md:grid max-md:grid-cols-2 max-md:gap-3",
        CARD_ROW,
        !view.isActive && "text-muted-foreground",
      )}
    >
      <Cell className="max-md:absolute max-md:top-5 max-md:right-3">
        <span className="flex items-center gap-2">
          <Switch
            checked={view.isActive}
            onCheckedChange={(next) => void setActive(next)}
            aria-label={t("activeFor", { name: view.fullName })}
          />
        </span>
        {dialog}
      </Cell>
      <th
        scope="row"
        className="bg-card text-left align-middle font-medium max-md:col-span-2 max-md:min-w-0 max-md:pr-12 md:sticky md:left-0 md:z-10 md:px-2 md:py-1"
      >
        <Link
          href={`/people/${view.id}?from=directory`}
          className="flex min-h-11 items-center gap-3 rounded-md md:min-h-9 md:px-2 hover:bg-muted/60 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Avatar size="sm">
            {view.avatarUrl ? (
              <AvatarImage src={view.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback>{initials(view.fullName)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate">{view.fullName}</span>
            {view.email ? (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {view.email}
              </span>
            ) : null}
          </span>
        </Link>
      </th>
      <td className={cn("text-sm max-md:col-span-2 max-md:min-w-0 md:max-w-48 md:px-2 md:py-1 md:align-middle", !view.title && "max-md:hidden")}>
        {view.title ? (
          <span className="block truncate" title={view.title}>
            {view.title}
          </span>
        ) : (
          <span className="text-muted-foreground">
            <span aria-hidden>—</span>
            <span className="sr-only">{t("noTitle")}</span>
          </span>
        )}
      </td>
      <Cell label={t("columns.office")}>
        <FilterSelect
          label={t("officeFor", { name: view.fullName })}
          value={view.officeId ?? NONE}
          onChange={(v) =>
            update({ officeId: v === NONE ? null : v })
          }
          options={[
            { value: NONE, label: t("noOffice") },
            ...offices.map((o) => ({
              value: o.id,
              label: `${o.code} · ${o.name}`,
            })),
          ]}
          className={cn(COMPACT_SELECT, "md:w-40")}
        />
      </Cell>
      <Cell label={t("columns.role")}>
        <FilterSelect
          label={t("roleFor", { name: view.fullName })}
          value={view.role}
          onChange={(role) => update({ role: role as Role })}
          options={ROLES.map((r) => ({ value: r, label: tRole(r) }))}
          className={cn(COMPACT_SELECT, "md:w-32")}
        />
      </Cell>
      <Cell align="right" label={t("columns.allowance")}>
        <NumberCommitInput
          key={view.ptoAllowanceDays ?? "none"}
          value={view.ptoAllowanceDays}
          label={t("allowanceFor", { name: view.fullName })}
          min={0}
          max={365}
          step={0.5}
          allowEmpty
          format={f.count}
          className="w-full md:h-8 md:w-24"
          onCommit={(n) => update({ ptoAllowanceDays: n })}
        />
      </Cell>
      <Cell align="right" label={t("columns.sickAllowance")}>
        <NumberCommitInput
          key={view.sickAllowanceDays ?? "sick-none"}
          value={view.sickAllowanceDays}
          label={t("sickAllowanceFor", { name: view.fullName })}
          min={0}
          max={365}
          step={0.5}
          allowEmpty
          format={f.count}
          className="w-full md:h-8 md:w-24"
          onCommit={(n) => update({ sickAllowanceDays: n })}
        />
      </Cell>
    </tr>
  );
}

function Cell({
  align = "left",
  label,
  className,
  children,
}: {
  align?: "left" | "right";
  /** Column name, shown above the value when the row is a card. */
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <td className={cn("max-md:min-w-0 md:px-2 md:py-1 md:align-middle", className)}>
      {label ? <span aria-hidden className={CARD_LABEL}>{label}</span> : null}
      <div className={cn("flex", align === "right" ? "justify-start md:justify-end" : "justify-start")}>
        {children}
      </div>
    </td>
  );
}
