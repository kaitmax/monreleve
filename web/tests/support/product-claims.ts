// web/tests/support/product-claims.ts
//
// The sentences that assert this product HAS a capability, and the copy that
// is wired to RULING R172's module, in one place.
//
// WHY A VOCABULARY AND NOT JUST A TABLE. A table of wired getters is checked
// by flipping flags, and that check is satisfied by a table with one entry.
// The defect R172 was issued about is a page NOBODY WIRED - three pages each
// right about themselves, contradicting each other. So the table needs a
// counterpart that finds unwired claims, and the only thing that can find one
// is the prose itself.
//
// SAME SHAPE AS tests/support/typed-figures.ts, one subject over: a curated
// pattern list, anchored on what makes a span a CLAIM rather than on a word.
// "registre" inside "une date de relevé" is not a claim that a register
// exists; "tient le registre" is.
//
// THE LIST IS CURATED, NOT DERIVED, for R155's reason. Deriving it from the
// flag names would propose "application" - a word /confidentialite uses
// twenty times in sentences SPEC 13 governs - and would miss "tenez le
// registre", which names no flag at all and was the defect.

/** A claim pattern, with the flag it depends on named for the failure message. */
export interface ClaimPattern {
  /** Named in the failure message, because a regexp is not a diagnosis. */
  readonly what: string;
  /** The `ProductState` field whose value decides whether the claim is true. */
  readonly flag: string;
  readonly pattern: RegExp;
}

/**
 * PRESENT-TENSE OR IMPERATIVE ASSERTIONS THAT A CAPABILITY IS HERE.
 *
 * Each pattern is the verb plus its object, never the object alone. The four
 * instances FW20b found are the four that produced this list:
 *
 *   HOME_COPY.description   "puis TENEZ LE REGISTRE horodate de vos journees"
 *   A_PROPOS_COPY.lead      "TIENT UN REGISTRE de journees"     (fixed in FW20)
 *   TARIFS_COPY.detail      "le calculateur, les guides ET LE RELEVE"  (FW20)
 *   RELEVE_COPY.stateBody   the only one that was right
 *
 * The first survived FW20's read-through: it is a META DESCRIPTION, so it
 * never appears in the page body a person reads.
 */
export const CLAIM_PATTERNS: readonly ClaimPattern[] = [
  {
    what: 'the day register, asserted as held',
    flag: 'trackerExists',
    // THE STEM CHANGES AND THAT IS THE WHOLE TRAP. `tenir` gives "tient" and
    // "tenez" - different stems - and the first version of this pattern wrote
    // `tien(?:t|ez)`, which matches "tienez", a word that does not exist. It
    // therefore missed the one sentence this rule was written for, and the
    // scan below PASSED while finding nothing. Only the non-vacuity test
    // caught it, which is R169's corollary arriving inside its own guard.
    pattern: /\b(?:tient|tiennent|tiens|tenez|teniez|tenir)\b[^.]{0,30}\bregistre\b/i,
  },
  {
    what: 'the day register, asserted as kept for you',
    flag: 'trackerExists',
    pattern: /\bregistre\b[^.]{0,20}\b(?:est tenu|sont tenues)\b/i,
  },
  {
    what: 'server timestamping, asserted as happening',
    flag: 'trackerExists',
    // THE ONE NO PATTERN CAUGHT. $legal-01 says "Chaque jour enregistré est
    // horodaté par le service" and names neither a register nor a relevé, so
    // the two patterns above walked straight past the sentence rendered on
    // every public page. It was found by auditing renders rather than by this
    // scan, which is the honest order: the vocabulary is extended when a
    // claim gets past it, exactly as R155's forbidden-forms list is.
    pattern: /\b(?:jour|journ[ée]e)s?\b[^.]{0,40}\b(?:est|sont|es)\s+horodat/i,
  },
  {
    what: 'the annual statement, asserted as produced',
    flag: 'dossierExists',
    // NO TRAILING \b, and this cost a second red run. JavaScript's \b is
    // ASCII, so "é" is not a word character and there is NO boundary between
    // the "é" of "relevé" and the space after it. `\brelev[ée]\b` therefore
    // matches nothing at all - in a file whose whole subject is accented
    // French. The leading \b is kept because "r" is ASCII.
    pattern: /\b(?:produit|genere|génère|met en forme|edite|édite)\b[^.]{0,20}\brelev[ée]/i,
  },
  {
    what: 'the annual statement, asserted as available',
    flag: 'dossierExists',
    pattern: /\brelev[ée] annuel\b[^.]{0,20}\b(?:est disponible|existe)\b(?!\s*pas)/i,
  },
  {
    what: 'the cost comparator, asserted as published',
    flag: 'comparatorExists',
    pattern: /\b(?:publie|propose|offre)\b(?!\s+donc\s+pas)[^.]{0,20}\bcomparateur\b/i,
  },
];

/** Every claim the given text makes, named. Empty is the passing case. */
export function claimsIn(text: string): readonly ClaimPattern[] {
  return CLAIM_PATTERNS.filter(({ pattern }) => pattern.test(text));
}

/**
 * Files in lib/fr whose claim-shaped prose is NOT a statement about what is
 * built today, each with the reason it is exempt.
 *
 * AN EXEMPTION IS A SENTENCE, NOT A PATH. A bare path list rots into "things
 * somebody once silenced"; a reason can be disagreed with. Anything not
 * listed here and not wired below fails, which is the direction that catches
 * the next page.
 */
export const EXEMPT: ReadonlyArray<{ readonly file: string; readonly why: string }> = [
  {
    file: 'cgu.ts',
    why:
      'Rendered at /cgu only. The terms describe the service SPEC 8 and SPEC ' +
      '12 specify, in the contractual present a contract is written in, and ' +
      'the claim audit counts nine present-tense sentences here that are ' +
      'false today. Rewriting a contract is a legal-copy decision the ' +
      'operator makes, not a wiring one - FW20b raises it as a QUESTION ' +
      'rather than deciding it, and this line is the record that it was seen.',
  },
  {
    file: 'confidentialite.ts',
    why:
      'Rendered at /confidentialite only, under a heading that scopes it to ' +
      'the Android application SPEC 13 specifies and the AN series builds. ' +
      'Same decision as cgu.ts, raised with it, and it belongs to whichever ' +
      'task ships an app that can record anything at all.',
  },
];

/**
 * THE EXEMPTION THIS LIST DID NOT GET, recorded because the reason it was
 * withdrawn is the most useful thing in this file.
 *
 * legal.ts was written down as exempt on the argument that $legal-01 is the
 * DOCUMENT's footer and is not rendered until the document exists. That was
 * simply false: PublicShell.tsx:260 renders it on every public page,
 * including /releve-annuel, so the footer contradicted that page's body on
 * the same render. The claim audit checked the render and the exemption did
 * not survive it.
 *
 * AN EXEMPTION IS A CLAIM ABOUT THE CODE, and it deserves the same treatment
 * as any other: it is checked, not accepted. Both entries above say where
 * their text is rendered for exactly this reason.
 */
export const WITHDRAWN_EXEMPTION = 'legal.ts';

/**
 * THE SENTENCES THAT PRODUCED R172, and four that must NOT be flagged.
 *
 * Synthetic input for the scan's own self-test. An absence assertion with a
 * broken detector passes forever, and this vocabulary has been broken twice:
 * once by `tien(?:t|ez)`, which matches "tienez" and so matches nothing, and
 * once by a trailing \b after an accented letter, which in JavaScript is not
 * a word boundary at all. Both times the scan reported clean and only these
 * samples knew.
 *
 * THEY LIVE HERE RATHER THAN IN THE SPEC because R126 forbids French copy
 * outside lib/fr, and a list of French sentences in a test file is
 * indistinguishable from duplicated page copy - to the scanner and to a
 * reader. A detector vocabulary belongs beside its detector, which is where
 * tests/support/vocabulary.ts has kept its own all along.
 */
export const PRODUCED_THE_RULE: readonly string[] = [
  'Calculez votre part et les jours qui restent, puis tenez le registre horodaté de vos journées.',
  'Ce site calcule votre part de télétravail annuelle et tient un registre de journées.',
  'Le service met en forme un relevé annuel à partir de ces journées.',
  'Ce site publie un comparateur de coût.',
  'Chaque jour enregistré est horodaté par le service.',
];

/** Prose that mentions the same words WITHOUT claiming the capability. */
export const MUST_NOT_FLAG: readonly string[] = [
  'Une date de relevé, consignée avec la règle.',
  'Le registre journalier et le document qui en découle ne sont pas construits.',
  'Ce site ne dispose d’aucune donnée de primes. Il ne publie donc pas de comparateur de coût.',
  'Ce document n’existe pas encore.',
];
