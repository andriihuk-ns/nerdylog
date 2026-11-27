/** A29: status prompts run on quarter hours, matching the 15-minute scheduler. */
export const PROMPT_STEP_MINUTES = 15;
const LAST_SLOT = 24 * 60 - PROMPT_STEP_MINUTES;

const pad = (n: number) => String(n).padStart(2, "0");

/** "9", "930", "9:30" or "9.30" → "HH:MM"; null when it is not a time of day. */
export function parseTimeOfDay(raw: string): string | null {
  const match = /^(\d{1,2})(?:[:.]?(\d{2}))?$/.exec(raw.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  return hours < 24 && minutes < 60 ? `${pad(hours)}:${pad(minutes)}` : null;
}

/** Nearest quarter hour of a valid "HH:MM"; late values stay on the same day (23:45). */
export function roundToQuarter(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const total = Math.min(Math.round((hours * 60 + minutes) / PROMPT_STEP_MINUTES) * PROMPT_STEP_MINUTES, LAST_SLOT);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
