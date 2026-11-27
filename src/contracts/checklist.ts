import { z } from "zod";

/** One item in a task description checklist. */
export const checklistItemSchema = z.object({
  text: z.string().max(500),
  link: z.string().max(2000).optional(),
  additionalLinks: z.array(z.string().max(2000)).max(2).optional(),
  done: z.boolean().default(false),
});
export type ChecklistItem = z.infer<typeof checklistItemSchema>;

export const MAX_CHECKLIST_ITEMS = 10;
export const MAX_CHECKLIST_LINKS = 3;

/** Keep the original `link` field stable for saved logs and older Slack submissions. */
export function checklistItemLinks(item: ChecklistItem): string[] {
  return [item.link, ...(item.additionalLinks ?? [])].filter((link): link is string => link !== undefined);
}

/** Parse `taskSummary`: returns checklist items if stored as JSON array, or `null` for plain text. */
export function parseChecklist(taskSummary: string): ChecklistItem[] | null {
  const trimmed = taskSummary.trim();
  if (!trimmed.startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return null;
    const result = z.array(checklistItemSchema).safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Serialize checklist items to a `taskSummary` string. */
export function serializeChecklist(items: readonly ChecklistItem[]): string {
  return JSON.stringify(items);
}

/** Convert plain text (e.g. legacy or Slack multiline) into checklist items. */
export function textToChecklist(text: string): ChecklistItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [{ text: "", done: false }];
  return lines.map((line) => {
    const doneMatch = line.match(/^\[[xX]\]\s*(.*)$/);
    if (doneMatch) return { text: doneMatch[1], done: true };
    const openMatch = line.match(/^(?:\[\s*\]|[-*•])\s*(.*)$/);
    if (openMatch) return { text: openMatch[1], done: false };
    return { text: line, done: false };
  });
}

/** Shared web/Slack interpretation: structured checklist when present, legacy text otherwise. */
export function taskSummaryToItems(taskSummary: string): ChecklistItem[] {
  return parseChecklist(taskSummary) ?? textToChecklist(taskSummary);
}

/** Render checklist items as Latin-1 safe bulleted text (for PDF, CSV, and plain-text views). */
export function checklistToText(items: readonly ChecklistItem[]): string {
  return items
    .filter((item) => item.text.trim() || checklistItemLinks(item).some((link) => link.trim()))
    .map((item) => {
      const prefix = item.done ? "[x]" : "•";
      const text = item.text.trim();
      const links = checklistItemLinks(item).filter((link) => link.trim()).map((link) => ` (${link.trim()})`).join("");
      return `${prefix} ${text}${links}`.trim();
    })
    .join("\n");
}

/** Get human-readable text from `taskSummary`, whether checklist JSON or plain text. */
export function taskSummaryDisplayText(taskSummary: string): string {
  const items = parseChecklist(taskSummary);
  return items ? checklistToText(items) : taskSummary;
}

/** Plain text combining all checklist items and links (for ticket/link extraction). */
export function checklistSearchText(items: readonly ChecklistItem[]): string {
  return items
    .map((item) => [item.text, ...checklistItemLinks(item)].filter(Boolean).join(" "))
    .join("\n");
}

