import { segmentTextWithLinks, inlineLinks, parseArtifactLink } from "@/contracts";
import { chipLabel, faviconUrl } from "@/components/shell/artifact-text";

/**
 * A36: DOM side of the task editor. Links are non-editable chips that carry their URL, so the
 * stored text is the text nodes plus each chip's URL. `<br>` is only ever a caret filler.
 */
function createChip(url: string): HTMLSpanElement {
  const link = parseArtifactLink(url);
  const chip = document.createElement("span");
  chip.contentEditable = "false";
  chip.dataset.url = url;
  chip.title = url;
  chip.className = "mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/60 px-1.5 py-px align-baseline text-xs font-medium whitespace-nowrap select-all";
  const favicon = faviconUrl(url);
  if (favicon) {
    const image = document.createElement("img");
    image.src = favicon;
    image.alt = "";
    image.className = "size-3 shrink-0 rounded-[2px]";
    chip.append(image);
  }
  const label = document.createElement("span");
  label.className = "max-w-48 truncate";
  label.textContent = chipLabel(link);
  chip.append(label);
  return chip;
}

export function renderText(root: HTMLElement, text: string) {
  const urls = inlineLinks(text);
  let next = 0;
  const nodes: Node[] = segmentTextWithLinks(text).map((segment) =>
    segment.type === "text" ? document.createTextNode(segment.text) : createChip(urls[next++]),
  );
  // Without it the caret cannot sit after a final newline or a final chip.
  if (text.endsWith("\n") || nodes.at(-1) instanceof HTMLElement) nodes.push(document.createElement("br"));
  root.replaceChildren(...nodes);
}

const isChip = (node: Node) => node instanceof HTMLElement && node.dataset.url !== undefined;

export function readText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node instanceof HTMLElement) {
    if (node.dataset.url) return node.dataset.url;
    if (node.tagName === "BR") return "";
  }
  let text = "";
  let chipBefore: string | null = null;
  for (const child of Array.from(node.childNodes)) {
    const part = readText(child);
    if (!part) continue;
    // Text typed against a chip must not become part of its URL, or hide it.
    const glued =
      (chipBefore !== null && inlineLinks(chipBefore + part)[0] !== chipBefore) || (isChip(child) && /\w$/.test(text));
    text += glued ? ` ${part}` : part;
    chipBefore = isChip(child) ? part : null;
  }
  return text;
}

/** The selection as offsets into the stored text; `null` when it is outside the editor. */
export function selectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const offset = (container: Node, position: number) => {
    const before = document.createRange();
    before.selectNodeContents(root);
    before.setEnd(container, position);
    return readText(before.cloneContents()).length;
  };
  return { start: offset(range.startContainer, range.startOffset), end: offset(range.endContainer, range.endOffset) };
}

export function setCaret(root: HTMLElement, offset: number) {
  const range = document.createRange();
  let left = offset;
  let placed = false;
  for (const node of Array.from(root.childNodes)) {
    const length = readText(node).length;
    if (node.nodeType === Node.TEXT_NODE && left <= length) {
      range.setStart(node, left);
      placed = true;
    } else if (node instanceof HTMLElement && node.dataset.url && left < length) {
      range.setStartBefore(node);
      placed = true;
    } else if (node instanceof HTMLElement && node.tagName === "BR" && left === 0) {
      range.setStartBefore(node);
      placed = true;
    }
    if (placed) break;
    left -= length;
  }
  if (!placed) {
    range.selectNodeContents(root);
    range.collapse(false);
  }
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
