/** Keep the legacy access path instead of reducing unconverted acquired rights. */
export function legacyLaunchProtection(periods: { end_milliseconds: unknown }[], now: Date) {
  // SQL extracts the instant numerically: node-postgres interprets timestamps
  // without zone in the machine's local zone, which can shorten a contract.
  const ends = periods.map(p => p.end_milliseconds == null ? NaN : Number(p.end_milliseconds));
  if (ends.some(end => !Number.isFinite(end) || !Number.isFinite(new Date(end).getTime()))) {
    return { defer: true, reason: "invalid_or_open_period", protectedUntil: null } as const;
  }
  const future = ends.filter(end => end > now.getTime());
  if (future.length) {
    return { defer: true, reason: "acquired_legacy_contract", protectedUntil: new Date(Math.max(...future)).toISOString() } as const;
  }
  return { defer: false, reason: "no_unelapsed_legacy_period", protectedUntil: null } as const;
}
