"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, CircleCheck } from "lucide-react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { checklistItemLinks, taskSummaryToItems } from "@/contracts";
import { ArtifactText } from "@/components/shell/artifact-text";
import { Button } from "@/components/ui/button";

/** Compact read view for the same task/link groups used by the web editor and Slack modal. */
export function TaskGroupList({ summaries }: { summaries: readonly string[] }) {
  const items = useMemo(
    () => summaries.flatMap(taskSummaryToItems).filter((item) => item.text.trim() || checklistItemLinks(item).some((link) => link.trim())),
    [summaries],
  );
  const contentRef = useRef<HTMLUListElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const t = useTranslations("myTime.cell");

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const measure = () => {
      const overflowing = content.scrollHeight > 40;
      setCanExpand(overflowing);
      if (!overflowing) setExpanded(false);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="w-full">
      <div className="relative">
        <ul
          ref={contentRef}
          className={`w-full space-y-1.5 text-left text-xs leading-relaxed text-muted-foreground ${expanded ? "" : "max-h-10 overflow-hidden"}`}
        >
          {items.map((item, index) => {
            const Icon = item.done ? CircleCheck : Circle;
            return (
              <li key={`${index}-${item.text}`} className="flex min-w-0 items-start gap-1.5">
                <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                <span className="min-w-0 break-words">
                  <span className={item.done ? "line-through decoration-muted-foreground/60" : undefined}>
                    <ArtifactText text={item.text} />
                  </span>
                  {checklistItemLinks(item).map((link, linkIndex) => (
                    <span key={`${link}-${linkIndex}`} className="mt-1 block">
                      <ArtifactText text={link} />
                    </span>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
        {canExpand && !expanded ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-card via-card/80 to-transparent"
          />
        ) : null}
      </div>
      {canExpand ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hit-target h-11 w-full justify-center gap-1.5 px-1.5 text-center text-xs text-muted-foreground"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronUp aria-hidden className="size-3.5" /> : <ChevronDown aria-hidden className="size-3.5" />}
          {expanded
            ? t("showLess")
            : items.length > 1
              ? t("showMoreTasks", { count: items.length - 1 })
              : t("showFullTask")}
        </Button>
      ) : null}
    </div>
  );
}
