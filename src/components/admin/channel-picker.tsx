"use client";

import { useId, useState, useTransition, type KeyboardEvent } from "react";
import { Check, ChevronsUpDown, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SlackChannelOption } from "@/contracts";
import { refreshSlackChannelsAction } from "@/app/(dashboard)/admin/project-actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { channelLabel, filterChannels } from "./channel-options";

interface Props {
  /** null → Slack is not configured; the picker renders disabled. */
  channels: SlackChannelOption[] | null;
  value: string | null;
  onChange: (channelId: string | null) => void;
  /** channelId → project already using it (shown disabled with that name). */
  taken?: Map<string, string>;
  noneLabel: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  "aria-describedby"?: string;
}

interface Row {
  id: string | null;
  channel?: SlackChannelOption;
  takenBy?: string;
}

/** A11 searchable Slack channel combobox: `#name`, lock for private, bot-membership hint. */
export function ChannelPicker({ channels, value, onChange, taken, noneLabel, disabled, invalid, id, ...aria }: Props) {
  const listId = useId();
  const t = useTranslations("admin.channel");
  const [open, setOpen] = useState(false);
  const [channelOptions, setChannelOptions] = useState(channels);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const unavailable = channelOptions === null;

  const rows: Row[] = [
    ...(query.trim() ? [] : [{ id: null }]),
    ...filterChannels(channelOptions ?? [], query).map((c) => ({ id: c.id, channel: c, takenBy: taken?.get(c.id) })),
  ];
  const selected = value ? (channelOptions?.find((c) => c.id === value) ?? null) : null;

  function setOpenState(next: boolean) {
    if (next && !open) {
      setRefreshError(null);
      startRefresh(async () => {
        try {
          const result = await refreshSlackChannelsAction();
          if (result.ok) setChannelOptions(result.data);
          else setRefreshError(result.message);
        } catch {
          setRefreshError(t("refreshFailed"));
        }
      });
    }
    setOpen(next);
    setQuery("");
    setActive(Math.max(0, value ? rows.findIndex((r) => r.id === value) : 0));
  }

  function pick(row: Row | undefined) {
    if (!row || row.takenBy) return;
    onChange(row.id);
    setOpen(false);
  }

  function move(delta: number) {
    if (rows.length === 0) return;
    let next = active;
    for (let i = 0; i < rows.length; i += 1) {
      next = (next + delta + rows.length) % rows.length;
      if (!rows[next]?.takenBy) break;
    }
    setActive(next);
    document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      move(e.key === "ArrowDown" ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(rows[active]);
    } else if (e.key === "Escape") {
      e.stopPropagation(); // close the picker only, not the surrounding form
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpenState}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-invalid={invalid || undefined}
          aria-describedby={aria["aria-describedby"]}
          disabled={disabled || unavailable}
          className="hit-target h-11 w-full justify-between border-input bg-card font-normal hover:border-input-hover"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {value ? (
              <>
                {selected?.isPrivate ? <Lock aria-label={t("private")} className="size-3.5" /> : null}
                <span className="truncate">{channelLabel(channelOptions, value)}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{unavailable ? t("notConnected") : noneLabel}</span>
            )}
          </span>
          <ChevronsUpDown aria-hidden className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-2" onKeyDown={onKeyDown}>
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder={t("search")}
          aria-label={t("search")}
          aria-controls={listId}
          aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
          autoFocus
          className="h-10"
        />
        <ul id={listId} role="listbox" aria-label={t("list")} className="max-h-72 overflow-y-auto">
          {rows.length === 0 ? <li className="px-2 py-3 text-muted-foreground">{t("noMatch")}</li> : null}
          {rows.map((row, i) => (
            <li
              key={row.id ?? "none"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={row.id === value}
              aria-disabled={row.takenBy ? true : undefined}
              onMouseEnter={() => !row.takenBy && setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(row)}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5",
                i === active && !row.takenBy && "bg-accent",
                row.takenBy && "cursor-not-allowed opacity-60",
              )}
            >
              <Check aria-hidden className={cn("size-4 shrink-0", row.id === value ? "opacity-100" : "opacity-0")} />
              <OptionBody row={row} noneLabel={noneLabel} />
            </li>
          ))}
        </ul>
        {refreshing ? <p role="status" className="px-2 pt-2 text-xs text-muted-foreground">{t("checking")}</p> : null}
        {refreshError ? <p role="alert" className="px-2 pt-2 text-xs text-destructive">{refreshError}</p> : null}
        {channelOptions ? <p className="px-2 pt-2 text-xs text-muted-foreground">{t("privateHint")}</p> : null}
      </PopoverContent>
    </Popover>
  );
}

function OptionBody({ row, noneLabel }: { row: Row; noneLabel: string }) {
  const t = useTranslations("admin.channel");
  if (!row.channel) return <span>{noneLabel}</span>;
  const { name, isPrivate, isMember } = row.channel;
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="flex items-center gap-1">
        {isPrivate ? <Lock aria-label={t("private")} className="size-3.5 shrink-0" /> : null}
        <span className="truncate">#{name}</span>
      </span>
      {row.takenBy ? (
        <span className="text-xs text-muted-foreground">{t("linkedTo", { owner: row.takenBy })}</span>
      ) : !isMember ? (
        <span className="text-xs text-muted-foreground">{isPrivate ? t("botNotInPrivate") : t("botNotIn")}</span>
      ) : null}
    </span>
  );
}
