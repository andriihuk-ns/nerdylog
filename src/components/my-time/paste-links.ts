import { MAX_LINK_LENGTH, segmentTextWithLinks } from "@/contracts";

/**
 * Splits pasted task text: URLs move to the task's link fields, the rest stays in the description.
 * A URL stays in the text only when it is too long for a link field.
 */
export function splitPastedLinks(pasted: string, current: readonly string[]) {
  const links = current.filter((link) => link.trim());
  let moved = false;
  const text = segmentTextWithLinks(pasted)
    .map((segment) => {
      if (segment.type === "text") return segment.text;
      const { url } = segment.link;
      const known = links.includes(url);
      if (!known && url.length > MAX_LINK_LENGTH) return url;
      if (!known) links.push(url);
      moved = true;
      return "";
    })
    .join("");
  if (!moved) return null;
  const tidy = text.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").replace(/\n+$/, "");
  return { text: tidy.trim() ? tidy : "", links };
}
