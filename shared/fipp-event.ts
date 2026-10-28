// Provisional start, displayed as such in the event's full countdown.
export const FIPP_EVENT_START = Date.parse("2026-12-19T08:00:00+01:00");
export function fippDaysToGo(now = Date.now()) {
  // Calendar days in Douala (UTC+1), independent of the visitor's timezone.
  const douala = new Date(now + 3_600_000);
  const today = Date.UTC(douala.getUTCFullYear(), douala.getUTCMonth(), douala.getUTCDate());
  return Math.round((Date.UTC(2026, 11, 19) - today) / 86_400_000);
}
