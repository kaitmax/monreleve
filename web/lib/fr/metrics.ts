// web/lib/fr/metrics.ts
//
// The one string MetricTile declares for itself. Its ordinary label is a
// PROP, because SPEC 9.3 puts four tiles side by side - "jours restants avant
// 40 %", "avant 49,9 %", "jours imposés en Suisse", "en France" - and two of
// those name a threshold that belongs to the year's RuleSet (SPEC 7.7). The
// caller composes them from the rules; this file would have to hardcode them.
//
// TODO-COPY: realistic French, not reviewed.

export const METRIC_COPY = {
  /**
   * SPEC 7.2 step 6: "Negative values are reported, never clamped. 'Vous êtes
   * 6 jours au-dessus' beats '0 jours restants'." A negative headroom is a
   * different sentence, not a differently formatted number, so the label is
   * replaced rather than the figure being given a sign.
   *
   * NOTICED, and raised in the report rather than decided here: replacing the
   * label loses WHICH threshold was passed, and SPEC 9.3 stands two
   * negative-capable tiles beside each other. FW12 may need a per-threshold
   * phrasing; this is the component-level string until then.
   */
  over: 'Jours au-dessus du seuil',
} as const;
