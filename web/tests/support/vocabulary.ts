// web/tests/support/vocabulary.ts
//
// SPEC section 20's vocabulary rule, in ONE place, and precise enough to be
// usable.
//
// THE RULE: "Never claim more than the record supports. Declare, enregistre,
// horodate - never certifie, atteste, conforme."
//
// WHY A SUBSTRING CHECK WAS WRONG. The first version of this banned the
// substrings 'certifi', 'attest' and 'conforme', and it caught a correct
// sentence: the calculator's explanatory copy says the framework agreement
// "suppose un CERTIFICAT A1 en cours de validite". That is the name of a real
// document - SPEC section 7.1 itself calls it "a valid A1 certificate" - and a
// product that may not name it cannot explain the rule it exists to track.
//
// 'attest' collides the same way and the collision is already scheduled:
// SPEC 9.5 lists a launch guide at /guides/attestation-employeur-teletravail,
// and SPEC 22's first open question is "Is the employer's ATTESTATION
// sufficient?" - the one that "can kill the product". A guard that forbade the
// word would forbid the guide.
//
// SO THE DISTINCTION IS NOUN VERSUS CLAIM. "Un certificat A1" names a document
// somebody else issues. "Nos releves sont certifies" is the claim this product
// must never make. The patterns below separate the two by what follows the
// stem:
//
//   certifi  NOT followed by 'cat'    -> certifie, certifiee, certifier
//   attest   NOT followed by 'ation'  -> atteste, attestee, attester
//   conforme as a whole word          -> conforme, conformes
//
// 'conformement' is left alone deliberately: "conformement a la
// reglementation" describes what a rule requires rather than claiming the
// record satisfies it, and the accented 'e' means it does not match the
// whole-word pattern anyway. 'conformite' IS caught - a claim of compliance is
// exactly what section 20 refuses.
//
// Not a .test.ts file, so vitest does not collect it - the same arrangement as
// tests/support/markup.ts. Its own behaviour is asserted in
// tests/unit/fr/vocabulary.test.ts, because a guard nobody checks is a guard
// that eventually permits everything.

/**
 * The claim forms, with the document nouns excluded.
 *
 * Case-insensitive; callers lowercase or not as they please. Accents matter:
 * these are matched against real French copy, not a transliteration.
 */
export const CLAIM_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ['certifié / certifie / certifier', /certifi(?!cat)/i],
  ['attesté / atteste / attester', /attest(?!ation)/i],
  ['conforme / conformes / conformité', /conform(?:es?\b|ité)/i],
];

/** Every claim form present in the text, by name. Empty means compliant. */
export function complianceClaims(text: string): readonly string[] {
  return CLAIM_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

/** The document nouns the rule permits, for the self-test to assert. */
export const PERMITTED_NOUNS: readonly string[] = [
  'un certificat A1 en cours de validité',
  'des certificats A1',
  "l'attestation de l'employeur",
  'les attestations employeur',
  'conformément à la réglementation applicable',
];

/** Claims the rule forbids, for the self-test to assert. */
export const FORBIDDEN_CLAIMS: readonly string[] = [
  'nos relevés sont certifiés',
  'un relevé certifié',
  'nous certifions vos journées',
  'le service atteste vos jours',
  'une journée attestée',
  'nous attestons la conformité',
  'un service conforme au RGPD',
  'des relevés conformes',
  'la conformité est garantie',
];
