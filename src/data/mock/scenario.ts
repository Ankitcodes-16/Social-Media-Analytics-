/**
 * Scenario clock for the simulated dataset.
 *
 * The dataset is a fixed 48-hour window of hourly buckets that ends at
 * SCENARIO_NOW. Using a fixed anchor (instead of Date.now()) keeps every page
 * consistent with every other page and makes the demo reproducible.
 *
 * Bucket i covers [bucketStart(i), bucketStart(i) + 1h). Bucket 47 is the most
 * recent complete hour (13:00–14:00 UTC).
 */

export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;

export const SCENARIO_NOW_ISO = "2026-09-20T14:00:00.000Z";
export const SCENARIO_NOW = Date.parse(SCENARIO_NOW_ISO);

/** Hourly buckets in the dataset (48h = the visible 24h window + 24h of context). */
export const BUCKETS = 48;
/** Hours shown by default across the UI. */
export const WINDOW_HOURS = 24;
/** First bucket index of the visible window. */
export const WINDOW_START_INDEX = BUCKETS - WINDOW_HOURS;

export const bucketStartMs = (i: number): number => SCENARIO_NOW - (BUCKETS - i) * HOUR_MS;
export const bucketIso = (i: number): string => new Date(bucketStartMs(i)).toISOString();
export const bucketEndMs = (i: number): number => bucketStartMs(i) + HOUR_MS;
export const hourOfBucket = (i: number): number => new Date(bucketStartMs(i)).getUTCHours();

/** Bucket index that contains the given instant (clamped to the dataset). */
export function bucketIndexOf(ms: number): number {
  const idx = Math.floor((ms - bucketStartMs(0)) / HOUR_MS);
  return Math.min(BUCKETS - 1, Math.max(0, idx));
}

/** Instant at HH:MM UTC on the scenario day (2026-09-20) or a previous day. */
export function at(hh: number, mm: number, daysBack = 0): string {
  const d = new Date(SCENARIO_NOW);
  d.setUTCHours(hh, mm, 0, 0);
  return new Date(d.getTime() - daysBack * 24 * HOUR_MS).toISOString();
}

/** Smooth daily activity rhythm (peaks around midday UTC). */
export function dayFactor(hour: number): number {
  return 0.85 + 0.15 * Math.sin(((hour - 6) / 24) * 2 * Math.PI);
}

const LOADED_AT = Date.now();

/**
 * "Now" for the simulated dataset: the fixed scenario anchor plus the wall-clock
 * time elapsed since this module loaded. Keeps relative times ("5h ago") stable at
 * load while letting analyst actions in the demo get sensible timestamps.
 */
export const mockNow = (): number => SCENARIO_NOW + (Date.now() - LOADED_AT);
