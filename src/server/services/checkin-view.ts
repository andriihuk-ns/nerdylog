import type { CheckinView } from "@/contracts";
import type { CheckinRow } from "@/server/db/queries/checkins";

/** Answers that mean "no blocker" (compared trimmed, case-insensitive). */
const NO_BLOCKER_ANSWERS = new Set(["none", "no", "-"]);

/** FR-SLACK-02 / FR-WEB-05: a blocker is any non-empty answer other than none/no/-. */
export function hasBlocker(blockers: string): boolean {
  const text = blockers.trim().toLowerCase();
  return text.length > 0 && !NO_BLOCKER_ANSWERS.has(text);
}

export function toCheckinView(row: CheckinRow): CheckinView {
  return {
    userId: row.userId,
    checkinDate: row.checkinDate,
    plannedToday: row.plannedToday,
    blockers: row.blockers,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl,
    hasBlocker: hasBlocker(row.blockers),
  };
}
