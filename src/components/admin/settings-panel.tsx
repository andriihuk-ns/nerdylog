"use client";

import { useId, useOptimistic, useState, useTransition } from "react";
import type { AppSettings, SlackChannelOption } from "@/contracts";
import { updateStandupChannelAction } from "@/app/(dashboard)/admin/actions";
import { useToast } from "@/hooks/use-toast";
import { Toast } from "@/components/ui/toast";
import { ChannelField } from "./channel-field";
import { channelErrorText, channelLabel, findChannel } from "./channel-options";

const HELPER =
  "Receives everyone's full morning standup (yesterday, plan, blockers). Project channels only get their own project's lines.";

/** A11 Settings tab: general standup channel. Picking saves at once (optimistic; reverts on failure). */
export function SettingsPanel({ settings, channels }: { settings: AppSettings; channels: SlackChannelOption[] | null }) {
  const id = useId();
  const [saved, setSaved] = useState(settings.standupChannelId);
  const [value, setOptimistic] = useOptimistic(saved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast, show, dismiss } = useToast();

  function change(next: string | null) {
    if (next === value) return;
    setError(null);
    startTransition(async () => {
      setOptimistic(next);
      const res = await updateStandupChannelAction(next);
      if (res.ok) {
        setSaved(res.data.standupChannelId);
        const label = res.data.standupChannelId ? channelLabel(channels, res.data.standupChannelId) : null;
        show(label ? `Standups now post to ${label}.` : "General standup channel turned off.");
      } else {
        setError("field" in res ? channelErrorText(res, findChannel(channels, next)?.name) : res.message);
      }
    });
  }

  return (
    <section aria-labelledby="settings-title" className="flex max-w-xl flex-col gap-4">
      <h2 id="settings-title" className="text-lg font-semibold">
        Settings
      </h2>
      <div className="rounded-lg border bg-card p-4">
        <ChannelField
          id={`${id}-standup`}
          label="General standup channel"
          noneLabel="Off"
          channels={channels}
          value={value}
          onChange={change}
          error={error}
          helper={HELPER}
          disabled={pending}
        />
      </div>
      <Toast toast={toast} onDismiss={dismiss} />
    </section>
  );
}
