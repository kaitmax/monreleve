// web/lib/fr/metrics.ts
//
// The metric tiles' copy. SPEC 9.3 stands four of them side by side - "jours
// restants avant 40 %", "avant 49,9 %", "jours imposés en Suisse", "en France".
//
// RULING R73: BOTH LABELS NAME THEIR THRESHOLD, AND THE THRESHOLD IS PASSED
// IN. These are functions rather than constants for one reason: 40 % and
// 49,9 % belong to the year's RuleSet (SPEC 7.7), so a string containing
// either would be a second source of truth that goes stale in silence after a
// rule change - the copy would still say 40 % and nothing would fail. The
// caller formats the ceiling with formatPercent and hands it over.
//
// WHAT R73 FIXED. MetricTile used to substitute a single constant of its own,
// "Jours au-dessus du seuil", whenever the headroom went negative. That reads
// fine in isolation and is wrong in place: SPEC 9.3 puts two negative-capable
// tiles next to each other, so both would have carried identical words about
// different ceilings and a reader could not tell which limit had been passed.
// MetricTile now owns no copy at all and takes both labels from the caller.
//
// TODO-COPY: realistic French, not reviewed.

/**
 * `threshold` is an already-formatted percentage - the output of
 * formatPercent, so "40,0 %" with U+00A0 before the sign. Passing a NUMBER
 * here would put the formatting decision in two places and let a caller
 * render "40%" beside the rail's "40,0 %".
 */
export const METRIC_COPY = {
  /** The ordinary state: headroom left before a ceiling. */
  remaining: (threshold: string): string => `Jours restants avant ${threshold}`,

  /**
   * SPEC 7.2 step 6: "Negative values are reported, never clamped. 'Vous êtes
   * 6 jours au-dessus' beats '0 jours restants'." A negative headroom is a
   * different sentence about a different quantity, not a differently
   * formatted number - and it names the ceiling that was passed.
   */
  over: (threshold: string): string => `Jours au-dessus de ${threshold}`,
} as const;
