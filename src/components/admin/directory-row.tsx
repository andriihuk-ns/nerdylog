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
import { initials } from "@/components/lib/format";
import { useFormat } from "@/hooks/use-format";
import { useConfirm } from "@/hooks/use-confirm";
import { NumberCommitInput } from "./number-commit-input";
import { NONE } from "./directory-filters";

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
        "h-16 border-b last:border-b-0",
        !view.isActive && "text-muted-foreground",
      )}
    >
      <Cell>
        <span className="flex items-center gap-2">
          <Switch
            checked={view.isActive}
            onCheckedChange={(next) => void setActive(next)}
            aria-label={t("activeFor", { name: view.fullName })}
          />
          <span className="text-xs whitespace-nowrap">
            {view.isActive ? tc("active") : tc("archived")}
          </span>
        </span>
        {dialog}
      </Cell>
      <th
        scope="row"
        className="sticky left-0 z-10 bg-card px-2 py-3 text-left align-middle font-medium"
      >
        <Link
          href={`/people/${view.id}?from=directory`}
          className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Avatar size="sm">
            {view.avatarUrl ? (
              <AvatarImage src={view.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback>{initials(view.fullName)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{view.fullName}</span>
            {view.email ? (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {view.email}
              </span>
            ) : null}
          </span>
        </Link>
      </th>
      <td className="max-w-48 px-2 py-3 align-middle text-sm">
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
      <Cell>
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
          className="w-40"
        />
      </Cell>
      <Cell>
        <FilterSelect
          label={t("roleFor", { name: view.fullName })}
          value={view.role}
          onChange={(role) => update({ role: role as Role })}
          options={ROLES.map((r) => ({ value: r, label: tRole(r) }))}
          className="w-32"
        />
      </Cell>
      <Cell align="right">
        <NumberCommitInput
          key={view.dailyNormHours}
          value={view.dailyNormHours}
          label={t("normFor", { name: view.fullName })}
          min={0.25}
          max={24}
          step={0.25}
          format={f.hours}
          onCommit={(n) =>
            n !== null && update({ dailyNormHours: n })
          }
        />
      </Cell>
      <Cell align="right">
        <NumberCommitInput
          key={view.ptoAllowanceDays ?? "none"}
          value={view.ptoAllowanceDays}
          label={t("allowanceFor", { name: view.fullName })}
          min={0}
          max={366}
          step={0.5}
          allowEmpty
          format={f.count}
          onCommit={(n) => update({ ptoAllowanceDays: n })}
        />
      </Cell>
    </tr>
  );
}

function Cell({
  align = "left",
  children,
}: {
  align?: "left" | "right";
  children: ReactNode;
}) {
  return (
    <td className="px-2 py-3 align-middle">
      <div
        className={cn(
          "flex",
          align === "right" ? "justify-end" : "justify-start",
        )}
      >
        {children}
      </div>
    </td>
  );
}
