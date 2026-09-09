// web/lib/fr/cantons.ts
//
// The 26 Swiss cantons, in French, keyed by the two-letter code the engine's
// Canton type uses.
//
// THE TYPE IS THE ENUMERATION. Declared Record<Canton, string>, so tsc refuses
// a missing canton AND a code that is not one - the same arrangement as
// FIELD_NAMES in errors.ts, and for the same reason: a hand-maintained list of
// 26 items drifts, and the drift shows up as a canton the user cannot select
// rather than as a failure.
//
// NOT A PRODUCT DECISION, which is why it is here without a ruling. These are
// the cantons' own French names - the endonyms for the French-speaking ones
// (Genève, Vaud, Neuchâtel, Jura, Fribourg, Valais) and the standard French
// exonyms for the rest (Zurich rather than Zürich, Berne rather than Bern,
// Soleure rather than Solothurn). A frontalier reads French; showing "Zürich"
// in a French sentence would be the odd choice, not this.
//
// ORDER IS NOT DEFINED HERE. The form sorts by name at the point of display,
// because the alphabetical order of the CODES is not the alphabetical order of
// the NAMES - AG/AI/AR are Argovie/Appenzell/Appenzell, and a select whose
// first three entries are out of order looks broken.

import type { Canton } from '@/lib/calc-engine';

export const CANTON_NAMES: Record<Canton, string> = {
  AG: 'Argovie',
  AI: 'Appenzell Rhodes-Intérieures',
  AR: 'Appenzell Rhodes-Extérieures',
  BE: 'Berne',
  BL: 'Bâle-Campagne',
  BS: 'Bâle-Ville',
  FR: 'Fribourg',
  GE: 'Genève',
  GL: 'Glaris',
  GR: 'Grisons',
  JU: 'Jura',
  LU: 'Lucerne',
  NE: 'Neuchâtel',
  NW: 'Nidwald',
  OW: 'Obwald',
  SG: 'Saint-Gall',
  SH: 'Schaffhouse',
  SO: 'Soleure',
  SZ: 'Schwytz',
  TG: 'Thurgovie',
  TI: 'Tessin',
  UR: 'Uri',
  VD: 'Vaud',
  VS: 'Valais',
  ZG: 'Zoug',
  ZH: 'Zurich',
} as const;

/**
 * The cantons in the order a French reader expects to find them.
 *
 * Intl.Collator rather than a plain sort: "Bâle" must fall between "Argovie"
 * and "Berne", and a codepoint sort puts every accented name after "Zurich".
 * Built once at module scope - it is the same list on every render.
 */
export const CANTONS_BY_NAME: ReadonlyArray<readonly [Canton, string]> = (
  Object.entries(CANTON_NAMES) as ReadonlyArray<readonly [Canton, string]>
)
  .slice()
  .sort(([, a], [, b]) => new Intl.Collator('fr-FR').compare(a, b));
