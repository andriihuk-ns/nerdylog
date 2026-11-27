import { Circle, CircleCheck } from "lucide-react";
import { taskSummaryToItems } from "@/contracts";
import { ArtifactText } from "@/components/shell/artifact-text";

/** Compact read view for the same task/link groups used by the web editor and Slack modal. */
export function TaskGroupList({ summaries }: { summaries: readonly string[] }) {
  const items = summaries.flatMap(taskSummaryToItems).filter((item) => item.text.trim() || item.link?.trim());
  if (items.length === 0) return null;

  return (
    <ul className="w-full space-y-1.5 text-left text-xs leading-relaxed text-muted-foreground">
      {items.map((item, index) => {
        const Icon = item.done ? CircleCheck : Circle;
        return (
          <li key={`${index}-${item.text}-${item.link ?? ""}`} className="flex min-w-0 items-start gap-1.5">
            <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0 break-words">
              <span className={item.done ? "line-through decoration-muted-foreground/60" : undefined}>
                <ArtifactText text={item.text} />
              </span>
              {item.link ? (
                <span className="mt-1 block">
                  <ArtifactText text={item.link} />
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
