"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { OfficeView } from "@/contracts";
import { upsertOfficeAction } from "@/app/(dashboard)/admin/office-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  office?: OfficeView; // omitted → create
  onDone: (office: OfficeView, created: boolean) => void;
  onCancel: () => void;
}

const CODE_PATTERN = /^[A-Z0-9]{2,8}$/;

/** A15 office: short code (UA, PL) + name. */
export function OfficeForm({ office, onDone, onCancel }: Props) {
  const id = useId();
  const t = useTranslations("admin.offices");
  const tc = useTranslations("common");
  const [code, setCode] = useState(office?.code ?? "");
  const [name, setName] = useState(office?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!CODE_PATTERN.test(normalized)) return setError(t("codeInvalid"));
    if (!name.trim()) return setError(t("nameRequired"));
    setError(null);
    startTransition(async () => {
      const res = await upsertOfficeAction({ id: office?.id, code: normalized, name });
      if (res.ok) onDone(res.data, !office);
      else setError(res.message);
    });
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      aria-label={office ? t("editLabel", { name: office.name }) : t("newLabel")}
      className="flex flex-wrap items-end gap-3 p-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-code`}>{t("code")}</Label>
        <Input
          id={`${id}-code`}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoFocus
          required
          maxLength={8}
          placeholder="UA"
          className="h-11 w-24 font-mono uppercase"
        />
      </div>
      <div className="flex min-w-48 flex-1 flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>{t("name")}</Label>
        <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder={t("namePlaceholder")} className="h-11" />
      </div>
      <Button type="button" variant="ghost" className="hit-target" onClick={onCancel}>
        {tc("cancel")}
      </Button>
      <Button type="submit" className="hit-target" disabled={pending}>
        {pending ? tc("saving") : office ? tc("save") : t("create")}
      </Button>
      {error ? (
        <p role="alert" className="w-full text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
