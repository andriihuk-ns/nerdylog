"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { inlineLinks, MAX_LINK_LENGTH } from "@/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LinkFavicon } from "./link-favicon";

interface Props {
  url: string;
  label: string;
  removeLabel: string;
  onChange: (url: string) => void;
  onRemove: () => void;
}

const isOneLink = (value: string) => inlineLinks(value)[0] === value;

/**
 * One link from the description. The text changes only once the field holds a whole URL again
 * (on leaving it or Enter), so a half-edited value never reaches the description.
 */
export function TypedLinkInput({ url, label, removeLabel, onChange, onRemove }: Props) {
  const [draft, setDraft] = useState(url);
  const value = draft.trim();
  const invalid = value !== "" && !isOneLink(value);

  function apply() {
    if (!value) onRemove();
    else if (!invalid && value !== url) onChange(value);
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <LinkFavicon url={url} />
      <Input
        type="url"
        value={draft}
        ref={(element) => element?.setCustomValidity(invalid ? "https://…" : "")}
        aria-invalid={invalid || undefined}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          apply();
        }}
        maxLength={MAX_LINK_LENGTH}
        aria-label={label}
        className="h-11 min-w-0 flex-1 text-sm"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hit-target size-11 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
        aria-label={removeLabel}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
