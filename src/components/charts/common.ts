import { COLORS } from "@/lib/colors";

export const AXIS_TICK = { fill: COLORS.axis, fontSize: 11 } as const;
export const AXIS_LINE = { stroke: COLORS.grid } as const;

/** Floor an ISO timestamp to the start of its hour (chart categories are hourly buckets). */
export function floorToHour(iso: string): string {
  return new Date(Math.floor(Date.parse(iso) / 3_600_000) * 3_600_000).toISOString();
}
