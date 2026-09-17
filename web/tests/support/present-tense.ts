// web/tests/support/present-tense.ts
//
// What a French page about a SHIPPED mobile application would say, held here
// so /application can be asserted not to say any of it.
//
// WHY IT IS A SUPPORT MODULE AND NOT A LIST IN THE SPEC. R126 forbids French
// copy outside lib/fr, and it flagged this list where it was first written -
// correctly, because a detector's vocabulary sitting in a spec file looks
// exactly like duplicated page copy to a scanner and to a reader. It is the
// same case tests/support/vocabulary.ts already holds, and both are named in
// the R126 allowlist with that reason. The alternative - writing the
// apostrophes as \u escapes to slip past the scan - leaves the duplication in
// place and only hides it, which R181 calls evasion.
//
// ---------------------------------------------------------------------------
// HOW THIS FILE WAS WRONG THE FIRST TIME, recorded because it is the lesson.
//
// The first version was a list of PHRASES, and I wrote them from what I
// imagined a page about a shipped application would say rather than from what
// /application actually said. So it carried
//
//   "l'application compare votre position a la frontiere et enregistre"
//
// while the page said "compare ... et vous PROPOSE". The scan was green, and
// both mode cards sat in the present tense under a lead saying the
// application does not exist - the half-derived page lib/fr/releve-annuel.ts
// argues against in its own comment.
//
// A DETECTOR SHAPED AROUND ITS OWN ESCAPE ROUTE is the defect class this
// project keeps finding, arriving inside a guard written during the task that
// keeps finding it. It is the same shape as `tien(?:t|ez)` matching "tienez",
// two increments earlier.
//
// THE FIX IS TO MATCH THE VERB, NOT THE SENTENCE. A phrase list only catches
// the sentences somebody thought of; the present indicative of the handful of
// verbs this page uses about the application catches the ones they did not.
// The phrase list stays for the install claims, where the exact words matter
// and a verb pattern would be too loose.
// ---------------------------------------------------------------------------

/** Something that would only be true of an application that exists. */
export interface PresentClaim {
  /** Named in the failure message, because a matched string is not a diagnosis. */
  readonly what: string;
  readonly pattern: RegExp;
}

/**
 * THE PRESENT INDICATIVE, ANCHORED ON ITS SUBJECT.
 *
 * The subject anchor is what keeps this off the refusals band. "Elle
 * n'enregistrera aucune coordonnée" is future and must pass; "Elle
 * enregistre" is present and must not. They begin identically, so the
 * negative lookahead refuses the future's -r- ending rather than trying to
 * enumerate the tenses.
 */
const SUBJECT = '(?:l’application|l’app|elle)';
const PRESENT_VERBS =
  '(?:compare|enregistre|propose|détecte|detecte|conserve|partage|garde|' +
  'écrit|ecrit|transmet|synchronise|calcule)';

export const PRESENT_TENSE_CLAIMS: readonly PresentClaim[] = [
  {
    what: 'the application acting, in the present',
    // `(?!r)` refuses "enregistrera"; `\b` after the verb refuses
    // "enregistrement". Both were real forms on the page.
    pattern: new RegExp(`\\b${SUBJECT}\\s+(?:ne\\s+|n’)?${PRESENT_VERBS}(?!r)\\b`, 'iu'),
  },
  {
    what: 'a day being recorded, in the present',
    pattern: /\bla journ[ée]e est enregistr[ée]e\b/iu,
  },
  {
    what: 'a mode working, in the present',
    // "Fonctionne hors connexion" - a bare present indicative with no
    // subject, which the subject-anchored pattern above cannot see.
    //
    // THE `m` FLAG IS LOAD-BEARING AND ITS ABSENCE PASSED THE SELF-TEST.
    // Without it `^` matches only position 0, so the pattern fired on the
    // bare sample string 'Fonctionne hors connexion' - which is how the
    // non-vacuity check was written - and matched NOTHING on the served page,
    // where that line sits mid-document. A planted present-tense line on the
    // real page is what caught it.
    //
    // The sample had been shaped to the pattern's convenience rather than to
    // the page's shape, which is the same defect as the phrase list this file
    // replaced, one level down.
    pattern: /^\s*fonctionne(?!r)\b/imu,
  },
  {
    what: 'nothing being recorded, in the present',
    // NO TRAILING \b, AND I WROTE THE COMMENT EXPLAINING WHY TWO INCREMENTS
    // AGO. tests/support/product-claims.ts carries the same note: JavaScript's
    // \b is ASCII, so there is no boundary between an accented final letter
    // and the space after it, and the pattern matches nothing at all. Knowing
    // the trap did not stop me setting it a second time in the same task,
    // which is the argument for the both-directions check in the spec rather
    // than for resolving to be more careful.
    pattern: /\brien n’est enregistr[ée]/iu,
  },
  {
    what: 'a requirement, in the present',
    pattern: /\bn[ée]cessite\b(?!r)/iu,
  },
  {
    what: 'days staying entered by hand, in the present',
    pattern: /\brestent saisis\b/iu,
  },
  {
    what: 'no location data being used, in the present',
    pattern: /\bn’est utilis[ée]e\b/iu,
  },

  // THE INSTALL CLAIMS, still phrases. These are the dangerous ones because a
  // reader ACTS on them, and their exact wording is what makes them
  // actionable - a verb pattern would fire on prose that merely discusses
  // downloading.
  { what: 'an instruction to install', pattern: /installez l’application/iu },
  { what: 'an instruction to download', pattern: /t[ée]l[ée]chargez/iu },
  { what: 'a store availability claim', pattern: /disponible sur (?:google play|l’app store)/iu },
  { what: 'a store availability claim', pattern: /est disponible sur/iu },
];

/** Every present-tense claim the text makes, named. Empty is the passing case. */
export function presentTenseClaimsIn(text: string): readonly string[] {
  return PRESENT_TENSE_CLAIMS.filter(({ pattern }) => pattern.test(text)).map(({ what }) => what);
}

/**
 * The forms that MUST fire, so the patterns above can be proved not to be
 * merely decorative.
 *
 * EVERY ONE OF THESE WAS ON /application, in the version the read-through
 * caught. They are not hypotheses about what a shipped-app page might say -
 * that is precisely how the first version of this file went wrong - they are
 * the sentences the page actually carried while the scan reported clean.
 *
 * THE THIRD ENTRY IS THE REASON THIS LIST EXISTS AT ALL. "Fonctionne hors
 * connexion" was matched by a pattern anchored with ^ and no `m` flag, which
 * fires on a bare string and never on a line in the middle of a document. The
 * sample had been shaped to the pattern's convenience; only a planted line on
 * the served page found it.
 */
export const PRESENT_FORMS_THAT_MUST_FIRE: readonly string[] = [
  'Un geste par jour, et la journée est enregistrée.',
  'L’application compare votre position à la frontière et vous propose la journée.',
  'Fonctionne hors connexion',
  'Rien n’est enregistré sans votre confirmation',
  'Nécessite l’accès à la position, y compris en arrière-plan',
];

/**
 * The forms that MUST NOT fire, so the patterns above can be proved not to be
 * merely loose.
 *
 * Every one of these is on the page today. A detector that flagged the
 * refusals band would be turned off within a task.
 */
export const FUTURE_FORMS_THAT_MUST_PASS: readonly string[] = [
  'Elle n’enregistrera aucune coordonnée',
  'Elle ne gardera aucun historique de déplacements',
  'Elle ne partagera rien',
  'Elle n’écrira jamais une journée seule',
  'L’application comparera votre position à la frontière',
  'Rien ne sera enregistré sans votre confirmation',
  'Aucune donnée de localisation ne sera utilisée',
  'Fonctionnera hors connexion',
  'Nécessitera l’accès à la position',
  'Les jours de mission resteront saisis à la main',
];
