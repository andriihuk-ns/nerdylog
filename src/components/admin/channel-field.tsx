"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { SlackChannelOption } from "@/contracts";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ChannelPicker } from "./channel-picker";

interface Props {
  id: string;
  label: string;
  noneLabel: string;
  channels: SlackChannelOption[] | null;
  value: string | null;
  onChange: (channelId: string | null) => void;
  taken?: Map<string, string>;
  error: string | null;
  helper?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** Label + ChannelPicker + helper / "Slack not connected" note + inline error (A11). */
export function ChannelField({ id, label, noneLabel, channels, value, onChange, taken, error, helper, disabled, className }: Props) {
  const noteId = `${id}-note`;
  const errorId = `${id}-error`;
  const t = useTranslations("admin.channel");
  const note = channels === null ? t("connect") : helper;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <ChannelPicker
        id={id}
        channels={channels}
        value={value}
        onChange={onChange}
        taken={taken}
        noneLabel={noneLabel}
        disabled={disabled}
        invalid={Boolean(error)}
        aria-describedby={[note && noteId, error && errorId].filter(Boolean).join(" ") || undefined}
      />
      {note ? (
        <p id={noteId} className="text-xs text-muted-foreground">
          {note}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
