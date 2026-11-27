export const PROJECT_ALLOCATION_PRESETS = [25, 50, 75, 100] as const;
export const STANDARD_MONTH_HOURS = 160;
export const MAX_MONTH_ALLOCATION_HOURS = 744;

export type ProjectAllocationPercent = (typeof PROJECT_ALLOCATION_PRESETS)[number];

export function hoursForAllocationPercent(percent: ProjectAllocationPercent): number {
  return (STANDARD_MONTH_HOURS * percent) / 100;
}
