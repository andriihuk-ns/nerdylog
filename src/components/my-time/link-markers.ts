import { inlineLinks, parseArtifactLink, PROVIDER_NAMES, removeInlineLink, segmentTextWithLinks } from "@/contracts";

/**
 * A36: the editor shows each typed URL as a short marker ("[🔗1 react.dev]") and edits the URL in
 * its own input. Stored text keeps the URL itself, so chips stay in place everywhere else.
 */
export interface Marked {
  display: string;
  /** `urls[n]` belongs to marker n + 1. */
  urls: string[];
}

export function marker(url: string, index: number): string {
  const link = parseArtifactLink(url);
  const label = link.provider === "web" ? link.label : `${PROVIDER_NAMES[link.provider]} · ${link.label}`;
  // A URL still being edited has no host to show yet.
  const short = label === url ? "…" : label;
  return `[🔗${index + 1} ${short}]`;
}

/** Stored text → editor text, numbering markers in order of appearance. */
export function toMarked(text: string): Marked {
  const urls: string[] = [];
  const raw = inlineLinks(text);
  const display = segmentTextWithLinks(text)
    .map((segment) => {
      if (segment.type === "text") return segment.text;
      const url = raw[urls.length];
      urls.push(url);
      return marker(url, urls.length - 1);
    })
    .join("");
  return { display, urls };
}

/** Editor text → stored text. */
export function fromMarked({ display, urls }: Marked): string {
  return urls.reduce((text, url, index) => text.replace(marker(url, index), () => url), display);
}

/** Markers still present in the editor text, in the order they appear. */
export function markersIn({ display, urls }: Marked): { index: number; url: string; start: number; end: number }[] {
  return urls
    .map((url, index) => {
      const start = display.indexOf(marker(url, index));
      return { index, url, start, end: start + marker(url, index).length };
    })
    .filter((found) => found.start >= 0)
    .sort((a, b) => a.start - b.start);
}

/** A marker is one unit: an edit that cuts into it removes all of it. */
export function applyEdit(current: Marked, next: string): { display: string; caret: number | null } {
  const prev = current.display;
  let head = 0;
  while (head < prev.length && head < next.length && prev[head] === next[head]) head += 1;
  let tail = 0;
  while (tail < prev.length - head && tail < next.length - head && prev[prev.length - 1 - tail] === next[next.length - 1 - tail]) tail += 1;

  let from = head;
  let to = prev.length - tail;
  for (const { start, end } of markersIn(current)) {
    const cut = from === to ? from > start && from < end : from < end && to > start;
    if (!cut) continue;
    from = Math.min(from, start);
    to = Math.max(to, end);
  }
  if (from === head && to === prev.length - tail) return { display: next, caret: null };
  const inserted = next.slice(head, next.length - tail);
  return { display: prev.slice(0, from) + inserted + prev.slice(to), caret: from + inserted.length };
}

/** Changes the URL behind one marker. */
export function setMarkedUrl(current: Marked, index: number, url: string): Marked {
  const display = current.display.replace(marker(current.urls[index], index), () => marker(url, index));
  return { display, urls: current.urls.map((value, i) => (i === index ? url : value)) };
}

/** Stored text without one marker's link (and the brackets that only wrapped it). */
export function removeMarked(current: Marked, index: number): string {
  const sentinel = "https://removed.invalid";
  const display = current.display.replace(marker(current.urls[index], index), sentinel);
  const nth = inlineLinks(display.slice(0, display.indexOf(sentinel))).length;
  return fromMarked({ display: removeInlineLink(display, nth), urls: current.urls });
}
