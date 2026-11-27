import {
  BookOpen,
  CircleCheck,
  FileText,
  GitPullRequest,
  Globe,
  HardDrive,
  NotebookText,
  PenTool,
  Presentation,
  Sheet,
  SquareKanban,
  Ticket,
  Video,
  type LucideIcon,
} from "lucide-react";
import { PROVIDER_NAMES, segmentTextWithLinks, type ArtifactLink, type LinkProvider } from "@/contracts";
import { cn } from "@/lib/utils";

const ICONS: Record<LinkProvider, LucideIcon> = {
  jira: Ticket,
  confluence: BookOpen,
  figma: PenTool,
  asana: CircleCheck,
  "google-doc": FileText,
  "google-sheet": Sheet,
  "google-slides": Presentation,
  "google-drive": HardDrive,
  github: GitPullRequest,
  linear: SquareKanban,
  notion: NotebookText,
  loom: Video,
  web: Globe,
};

/** A17 chip text: "Figma · Map modal"; plain web links show only the host. */
export function chipLabel(link: ArtifactLink): string {
  return link.provider === "web" ? link.label : `${PROVIDER_NAMES[link.provider]} · ${link.label}`;
}

/** One link as a compact chip that opens in a new tab. */
export function ArtifactChip({ link }: { link: ArtifactLink }) {
  const Icon = ICONS[link.provider];
  const label = chipLabel(link);
  const favicon = faviconUrl(link.url);
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      title={link.url}
      data-provider={link.provider}
      className="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/60 px-1.5 py-px align-baseline text-xs font-medium text-foreground no-underline hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span aria-hidden="true" className="relative size-3 shrink-0">
        <Icon className="absolute inset-0 size-3 text-muted-foreground" />
        {/* Favicons are already tiny; direct loading keeps arbitrary linked hosts out of image config. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {favicon ? <img src={favicon} alt="" loading="lazy" className="absolute inset-0 size-3 rounded-[2px]" /> : null}
      </span>
      <span className="max-w-48 truncate">{label}</span>
    </a>
  );
}

function faviconUrl(url: string): string | null {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
  } catch {
    return null;
  }
}

/**
 * A17: task summaries / plans / blockers with URLs rendered as chips. Display only; the stored
 * text is unchanged. Whitespace and line breaks are kept (`whitespace-pre-line`).
 */
export function ArtifactText({ text, className }: { text: string; className?: string }) {
  const segments = segmentTextWithLinks(text);
  return (
    <span className={cn("break-words whitespace-pre-line", className)}>
      {segments.map((s, i) => (s.type === "text" ? <span key={i}>{s.text}</span> : <ArtifactChip key={i} link={s.link} />))}
    </span>
  );
}
