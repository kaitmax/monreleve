// web/lib/fr/rates.ts
//
// The words around the two rates (SPEC 9.3, "the two-rate problem").
//
// TODO-COPY: realistic French, not final wording, per tasks/plan.md's UI
// Discipline - placeholder copy is real French from lib/fr so that wrapping
// and overflow problems show up now rather than at translation time.
//
// NO THRESHOLD NUMBERS, the same rule statuses.ts carries and for the same
// reason. SPEC 9.3 describes the explanatory line as stating "that mission
// days above the 10-DAY CAP fall outside the telework regime and are taxed in
// France", and the obvious sentence would put "10 jours" in this file. It
// does not. The cap comes from the year's RuleSet (SPEC 7.7), which is the
// only place a threshold may appear; a number written into copy is a second
// source of truth that goes stale in silence - the sentence would still say
// ten after the rule changed, and nothing would fail. "Le plafond annuel"
// says the same thing and cannot drift. Recorded as a deliberate deviation
// from the prompt's phrasing rather than a slip.
//
// VOCABULARY: declare, enregistre, horodate - never certifie, atteste or
// conforme (SPEC section 20). These sentences describe a position.

export const RATE_COPY = {
  /**
   * SPEC 9.3: the primary figure is the one that goes on the tax return, so
   * its caption names the authority it is declared to rather than describing
   * the arithmetic.
   */
  declarableCaption: "Taux à déclarer à l'AFC",

  /**
   * The secondary figure. Deliberately NOT "taux réel" or "taux brut": both
   * imply the declarable rate is somehow less true, and it is the one with
   * legal effect. This names what it measures and claims nothing.
   */
  rawCaption: 'Part de jours hors de Suisse',

  /**
   * Shown only when the two diverge, which is the case that would otherwise
   * read as an error - Geneva case (c) shows 39,16 % beside 45,0 % with no
   * visible reason. This is the reason.
   */
  divergence:
    'Les jours de mission qui dépassent le plafond annuel sortent du régime ' +
    'de télétravail et sont imposés en France.',
} as const;
