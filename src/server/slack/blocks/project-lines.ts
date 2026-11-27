import { extractTicketRefs, type TimeEntryInput } from "@/contracts";
import { formatHours } from "../dates";
import { linkifyMrkdwn } from "./common";
import type { SlackMessage } from "./common";

type LineEntry = Pick<TimeEntryInput, "entryType" | "projectId" | "hours" | "taskSummary">;

/** A14: SHARED channel post, stays English (formatHours without a locale). One A11 project-channel line: `<Name> · 4h · <task summary> (DOG-1, DOG-2)`. Plain text. */
export function formatProjectLine(fullName: string, entry: Pick<LineEntry, "hours" | "taskSummary">): string {
  const task = entry.taskSummary.trim();
  const refs = extractTicketRefs(task);
  const name = fullName.trim() || "Someone";
  return `${name} · ${formatHours(entry.hours)} · ${task}${refs.length > 0 ? ` (${refs.join(", ")})` : ""}`;
}

/**
 * A11: group a submission's **work** entries by project, one line per entry, in input order.
 * PTO entries and entries without a project are dropped; plan/blockers never enter here.
 */
export function groupProjectLines(fullName: string, entries: readonly LineEntry[]): Map<string, string[]> {
  const byProject = new Map<string, string[]>();
  for (const e of entries) {
    if (e.entryType !== "work" || !e.projectId) continue;
    const lines = byProject.get(e.projectId) ?? [];
    lines.push(formatProjectLine(fullName, e));
    byProject.set(e.projectId, lines);
  }
  return byProject;
}

/** Message for one project channel: only that project's lines, mrkdwn-escaped, URLs as Slack links (A17). */
export function buildProjectLinesMessage(lines: readonly string[]): SlackMessage {
  return { text: lines.map(linkifyMrkdwn).join("\n"), blocks: [] };
}
