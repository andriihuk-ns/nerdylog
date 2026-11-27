"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import type { ProjectView, SlackChannelOption } from "@/contracts";
import { upsertProjectAction, type ProjectSaveResult } from "@/app/(dashboard)/admin/project-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChannelField } from "./channel-field";
import { findChannel } from "./channel-options";
import { useChannelErrorText } from "./use-channel-error-text";

interface Props {
  project?: ProjectView; // omitted → create
  channels: SlackChannelOption[] | null; // null → Slack not configured
  taken: Map<string, string>; // channels linked to other projects
  onDone: (result: ProjectSaveResult, created: boolean) => void;
  onCancel: () => void;
}

/** A15 project form: name + Slack channel (required on create) + active. Members come from the channel. */
export function ProjectForm({ project, channels, taken, onDone, onCancel }: Props) {
  const id = useId();
  const t = useTranslations("admin.projectForm");
  const tc = useTranslations("common");
  const channelErrorText = useChannelErrorText();
  const [name, setName] = useState(project?.name ?? "");
  const [isActive, setActive] = useState(project?.isActive ?? true);
  const [channelId, setChannelId] = useState<string | null>(project?.slackChannelId ?? null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(t("nameRequired"));
    if (!project && !channelId) return setChannelError(t("channelRequired"));
    setError(null);
    setChannelError(null);
    startTransition(async () => {
      const res = await upsertProjectAction({ id: project?.id, name, isActive, slackChannelId: channelId });
      if (res.ok) return onDone(res.data, !project);
      if ("field" in res) setChannelError(channelErrorText(res, findChannel(channels, channelId)?.name));
      else setError(res.message);
    });
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      aria-label={project ? t("editLabel", { name: project.name }) : t("newLabel")}
      className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-start"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>{t("name")}</Label>
        <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} className="h-11" />
      </div>
      <ChannelField
        id={`${id}-channel`}
        label={project ? t("channel") : t("channelRequiredLabel")}
        noneLabel={t("noChannel")}
        channels={channels}
        value={channelId}
        taken={taken}
        error={channelError}
        helper={t("channelHelper")}
        onChange={(next) => {
          setChannelId(next);
          setChannelError(null);
        }}
      />
      <label className="hit-target flex items-center gap-2 sm:mt-6">
        <Switch checked={isActive} onCheckedChange={setActive} />
        {t("active")}
      </label>
      {error ? (
        <p role="alert" className="text-destructive sm:col-span-3">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 sm:col-span-3">
        <Button type="button" variant="ghost" className="hit-target" onClick={onCancel}>
          {tc("cancel")}
        </Button>
        <Button type="submit" className="hit-target" disabled={pending}>
          {pending ? tc("saving") : project ? tc("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}
