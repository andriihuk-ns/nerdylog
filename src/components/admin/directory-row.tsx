"use client";

import { useOptimistic, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ROLES, type DirectoryUser, type OfficeView, type Role } from "@/contracts";
import { cn } from "@/lib/utils";
import { updateDirectoryUserAction, type DirectoryPatch } from "@/app/(dashboard)/admin/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { FilterSelect } from "@/components/shell/filter-select";
import { initials } from "@/components/lib/format";
import { useFormat } from "@/hooks/use-format";
import { useFieldSave } from "@/hooks/use-field-save";
import type { FieldSave } from "@/hooks/save-state";
import { NumberCommitInput } from "./number-commit-input";
import { SaveIndicator } from "./save-indicator";
import { NONE } from "./directory-filters";

type Field = keyof DirectoryPatch;

/** One Team Directory row; every control saves optimistically with its own "Saving… / Saved ✓ / error" status. */
export function DirectoryRow({ user, offices }: { user: DirectoryUser; offices: OfficeView[] }) {
  const [view, applyPatch] = useOptimistic(user, (u: DirectoryUser, patch: DirectoryPatch) => ({ ...u, ...patch }));
  const [, startTransition] = useTransition();
  const { get, track } = useFieldSave();
  const t = useTranslations("admin.directory");
  const tc = useTranslations("common");
  const tRole = useTranslations("roles");
  const f = useFormat();

  function update(field: Field, patch: DirectoryPatch) {
    void track(
      field,
      () =>
        new Promise<string | null>((resolve) => {
          startTransition(async () => {
            applyPatch(patch);
            const res = await updateDirectoryUserAction(user.id, patch);
            resolve(res.ok ? null : res.message);
          });
        }),
    );
  }

  return (
    <tr className={cn("border-b last:border-b-0", !view.isActive && "text-muted-foreground")}>
      <th scope="row" className="px-2 py-2 text-left font-medium">
        <Link
          href={`/admin/people/${view.id}`}
          className="flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Avatar size="sm">
            {view.avatarUrl ? <AvatarImage src={view.avatarUrl} alt="" /> : null}
            <AvatarFallback>{initials(view.fullName)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-col">
            <span className="truncate">{view.fullName}</span>
            {view.email ? <span className="truncate text-xs font-normal text-muted-foreground">{view.email}</span> : null}
          </span>
        </Link>
      </th>
      <td className="max-w-48 px-2 py-2 text-sm">
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
      <Cell state={get("officeId")}>
        <FilterSelect
          label={t("officeFor", { name: view.fullName })}
          value={view.officeId ?? NONE}
          onChange={(v) => update("officeId", { officeId: v === NONE ? null : v })}
          options={[{ value: NONE, label: t("noOffice") }, ...offices.map((o) => ({ value: o.id, label: `${o.code} · ${o.name}` }))]}
          className="w-40"
        />
      </Cell>
      <Cell state={get("role")}>
        <FilterSelect
          label={t("roleFor", { name: view.fullName })}
          value={view.role}
          onChange={(role) => update("role", { role: role as Role })}
          options={ROLES.map((r) => ({ value: r, label: tRole(r) }))}
          className="w-32"
        />
      </Cell>
      <Cell state={get("dailyNormHours")} align="right">
        <NumberCommitInput
          key={view.dailyNormHours}
          value={view.dailyNormHours}
          label={t("normFor", { name: view.fullName })}
          min={0.25}
          max={24}
          step={0.25}
          format={f.hours}
          onCommit={(n) => n !== null && update("dailyNormHours", { dailyNormHours: n })}
        />
      </Cell>
      <Cell state={get("ptoAllowanceDays")} align="right">
        <NumberCommitInput
          key={view.ptoAllowanceDays ?? "none"}
          value={view.ptoAllowanceDays}
          label={t("allowanceFor", { name: view.fullName })}
          min={0}
          max={366}
          step={0.5}
          allowEmpty
          format={f.count}
          onCommit={(n) => update("ptoAllowanceDays", { ptoAllowanceDays: n })}
        />
      </Cell>
      <Cell state={get("isActive")}>
        <span className="flex items-center gap-2">
          <Switch
            checked={view.isActive}
            onCheckedChange={(isActive) => update("isActive", { isActive })}
            aria-label={t("activeFor", { name: view.fullName })}
          />
          <span className="text-xs">{view.isActive ? tc("active") : tc("archived")}</span>
        </span>
      </Cell>
    </tr>
  );
}

/** Editable cell: control, then its save status underneath (fixed height, no row jump). */
function Cell({ state, align = "left", children }: { state: FieldSave; align?: "left" | "right"; children: ReactNode }) {
  return (
    <td className="px-2 py-2 align-top">
      <div className={cn("flex flex-col gap-0.5", align === "right" ? "items-end" : "items-start")}>
        {children}
        <SaveIndicator state={state} className="max-w-40" />
      </div>
    </td>
  );
}
