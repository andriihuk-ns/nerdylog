"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { parseTimeOfDay, roundToQuarter, type OfficeView, type ProjectView, type SlackChannelOption } from "@/contracts";
import { upsertProjectAction, type ProjectSaveResult } from "@/app/(dashboard)/admin/project-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChannelField } from "./channel-field";
import { findChannel } from "./channel-options";
import { TimePicker } from "./time-picker";
import { TimezonePicker } from "./timezone-picker";
import { useChannelErrorText } from "./use-channel-error-text";

interface Props {
  project?: ProjectView; // omitted → create
  channels: SlackChannelOption[] | null; // null → Slack not configured
  offices: OfficeView[]; // A29: supplies the default time zone
  taken: Map<string, string>; // channels linked to other projects
  onDone: (result: ProjectSaveResult, created: boolean) => void;
  onCancel: () => void;
}

/** Project form: name, Slack channel (required on create), active; A29 status prompt time + time zone. */
export function ProjectForm({ project, channels, offices, taken, onDone, onCancel }: Props) {
  const id = useId();
  const t = useTranslations("admin.projectForm");
  const tc = useTranslations("common");
  const channelErrorText = useChannelErrorText();
  const [name, setName] = useState(project?.name ?? "");
  const [channelId, setChannelId] = useState<string | null>(project?.slackChannelId ?? null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const office = offices.find((o) => o.id === project?.statusPromptOfficeId) ?? offices.find((o) => o.code === "UA");
  const [promptTime, setPromptTime] = useState(project?.statusPromptTime ?? "10:00");
  const [timezone, setTimezone] = useState(project?.statusPromptTimezone ?? office?.timezone ?? "Europe/Kyiv");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError(t("nameRequired"));
    if (!project && !channelId) return setChannelError(t("channelRequired"));
    const time = parseTimeOfDay(promptTime);
    if (!time) return setError(t("promptTimeInvalid"));
    setError(null);
    setChannelError(null);
    startTransition(async () => {
      const res = await upsertProjectAction({
        id: project?.id,
        name,
        isActive: project?.isActive ?? true,
        slackChannelId: channelId,
        statusPromptTime: roundToQuarter(time),
        statusPromptTimezone: timezone,
      });
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
      className="grid gap-4 p-4 sm:grid-cols-2 sm:items-start"
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
      <div className="flex flex-wrap items-start gap-3 sm:col-span-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-time`}>{t("promptTime")}</Label>
          <TimePicker id={`${id}-time`} value={promptTime} onChange={setPromptTime} />
        </div>
        <div className="flex w-full flex-col gap-1.5 sm:w-64">
          <Label htmlFor={`${id}-tz`}>{t("promptTimezone")}</Label>
          <TimezonePicker id={`${id}-tz`} value={timezone} onChange={setTimezone} />
        </div>
        <p className="w-full text-xs text-muted-foreground">{t("promptHelper")}</p>
      </div>
      {error ? (
        <p role="alert" className="text-destructive sm:col-span-2">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
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
