/** A16 office timezone choices: a short IANA subset, plus the office's current value if it is not listed. */
export const OFFICE_TIMEZONES = ["Europe/Kyiv", "Europe/Warsaw", "Europe/London", "Europe/Berlin", "America/New_York", "UTC"] as const;

export function timezoneOptions(current?: string | null): string[] {
  const list: string[] = [...OFFICE_TIMEZONES];
  return current && !list.includes(current) ? [current, ...list] : list;
}
