"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import type { ProjectView, SlackChannelOption } from "@/contracts";
import { upsertProjectAction } from "@/app/(dashboard)/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { parseBoundedNumber } from "./parse-number";
import { ChannelField } from "./channel-field";
import { channelErrorText, findChannel } from "./channel-options";

interface Props {
  project?: ProjectView; // omitted → create
  channels: SlackChannelOption[] | null; // null → Slack not configured
  taken: Map<string, string>; // channels linked to other projects
  onDone: (message: string) => void;
  onCancel: () => void;
}

/** Create/edit a project: name, code, monthly hour cap, billable, active (FR-WEB-06). */
export function ProjectForm({ project, channels, taken, onDone, onCancel }: Props) {
  const id = useId();
  const [name, setName] = useState(project?.name ?? "");
  const [code, setCode] = useState(project?.code ?? "");
  const [cap, setCap] = useState(project?.monthlyHourCap?.toString() ?? "");
  const [isBillable, setBillable] = useState(project?.isBillable ?? true);
  const [isActive, setActive] = useState(project?.isActive ?? true);
  const [channelId, setChannelId] = useState<string | null>(project?.slackChannelId ?? null);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    const monthlyHourCap = parseBoundedNumber(cap, 0.25, 10000, 0.25, true);
    if (monthlyHourCap === undefined) return setError("Cap must be a positive number of hours, or empty for no cap.");
    if (!name.trim()) return setError("Name is required.");
    setError(null);
    setChannelError(null);
    startTransition(async () => {
      const res = await upsertProjectAction({
        id: project?.id,
        name,
        code: code.trim() || null,
        monthlyHourCap,
        isBillable,
        isActive,
        slackChannelId: channelId,
      });
      if (res.ok) return onDone(project ? `Saved ${res.data.name}.` : `Created ${res.data.name}.`);
      if ("field" in res) setChannelError(channelErrorText(res, findChannel(channels, channelId)?.name));
      else setError(res.message);
    });
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      aria-label={project ? `Edit ${project.name}` : "New project"}
      className="grid gap-4 p-4 sm:grid-cols-[2fr_1fr_1fr_auto_auto] sm:items-end"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input id={`${id}-name`} value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} className="h-11" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-code`}>Code</Label>
        <Input id={`${id}-code`} value={code} onChange={(e) => setCode(e.target.value)} maxLength={32} placeholder="DOG" className="h-11 font-mono" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-cap`}>Monthly cap (h)</Label>
        <Input
          id={`${id}-cap`}
          value={cap}
          onChange={(e) => setCap(e.target.value)}
          inputMode="decimal"
          placeholder="No cap"
          className="tabular h-11 text-right"
        />
      </div>
      <label className="hit-target flex items-center gap-2">
        <Switch checked={isBillable} onCheckedChange={setBillable} />
        Billable
      </label>
      <label className="hit-target flex items-center gap-2">
        <Switch checked={isActive} onCheckedChange={setActive} />
        Active
      </label>
      <ChannelField
        id={`${id}-channel`}
        label="Slack channel"
        noneLabel="No channel"
        channels={channels}
        value={channelId}
        taken={taken}
        error={channelError}
        onChange={(next) => {
          setChannelId(next);
          setChannelError(null);
        }}
        className="sm:col-span-3"
      />
      {error ? (
        <p role="alert" className="text-destructive sm:col-span-5">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 sm:col-span-5">
        <Button type="button" variant="ghost" className="hit-target" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="hit-target" disabled={pending}>
          {pending ? "Saving…" : project ? "Save" : "Create project"}
        </Button>
      </div>
    </form>
  );
}
