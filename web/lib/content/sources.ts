// web/lib/content/sources.ts
//
// What /sources publishes: where each constant comes from, and whether it has
// been checked.
//
// RULING R113. This page ships as FW12's increment 0 rather than with FW20,
// because P2 has no input trigger by design and /sources is therefore its ONLY
// disclosure - and the calculator went live before the page existed. "A
// provisional interpretation with no input trigger must have a live disclosure
// surface before the affected page is indexed."
//
// STRUCTURE HERE, WORDS IN lib/fr/sources.ts, and the split is the usual one:
// this file holds the ids, the URLs, the verification state and the dates -
// things that change when a source is checked - while the French rule
// descriptions live with the rest of the copy. Both are keyed by the same id
// union, so tsc refuses an entry with no description and a description with no
// entry.
//
// THE VALUES ARE NOT HERE. A row's value comes from ruleSetFor(year) at render
// time, because SPEC 7.7 makes RuleSet the only place a threshold may appear
// and a table of constants is the single most tempting place to type 40 again.
// Rows that are a RULE rather than a number - the day classification, the
// proration - carry no key and render no value.
//
// MINIMAL, as R113 says: the verified list, P1-P3 with status, the review date.
// FW20 expands this page rather than creating it.

import type { RuleSet } from '@/lib/calc-engine';

/** The rows, in the order docs/regulatory-sources.md numbers them. */
export const SOURCE_IDS = [
  'fiscalCeiling',
  'missionCapDays',
  'missionCapProration',
  'socialCeiling',
  'simplifiedBasisDays',
  'dayClassification',
  'residence1983Cantons',
  'a1ThresholdRate',

  // R158: A SOURCE KEY IDENTIFIES A FACT, NOT A URL. These two are published
  // on the SAME ge.ch page as missionCapDays and were cited under it by FW17
  // and FW18 for that reason - which left `claims` unable to tell "the cap is
  // ten days" from "a travel day worked mostly in Switzerland is not
  // counted". Three facts, three ids, one citation.
  'missionTravelDays',
  'genevaWorkedExamples',

  // THE DROIT D'OPTION, verified against CLEISS on 16.09.2026. A separate
  // subject from the telework constants and from a different authority:
  // nothing here concerns the ceiling or the engine. Four ids because they
  // are four facts a guide cites separately (R158).
  'droitOptionWindow',
  'droitOptionIrrevocable',
  'droitOptionDefault',
  'droitOptionBasis',

  // FW20b: THREE MORE FROM THE SAME FETCH, and FW18b's audit is why they were
  // missing. Eight facts were verified on 16.09.2026 and seven rows were
  // written; one fact split into D1 and D2, and two never landed at all. They
  // waited in docs/regulatory-sources.md under "TRANSCRIBED, NOT YET ROWS".
  //
  // FACT 8 IS NOT OPTIONAL, and the operator's reason is the failure
  // DIRECTION: a two-earner household reading the guide without the qualifier
  // concludes the working spouse is covered by the worker's option, does
  // nothing, and ends up UNINSURED. Absence here is not a smaller claim; it
  // is a wrong one.
  'droitOptionFamily',

  // FACT 6 IS TWO IDS, NOT ONE, and the split is R158's own test rather than
  // tidiness. Where the option is filed and which form files it have
  // DIFFERENT ROT PROFILES: CLEISS can reissue the form under a new reference
  // without the cantonal bodies moving, and the Institution commune's address
  // can change without the form changing. One key covering both would leave
  // `claims` unable to tell "a pensioner files at Olten" from "the instrument
  // is « Choix du systeme d'assurance maladie »" - which is exactly the state
  // missionCapDays was in before R158.
  'droitOptionFiling',
  'droitOptionForm',
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

/**
 * How far a row has been checked.
 *
 * 'transcribed' is NOT 'verified' and the distinction is the whole point: it
 * means the value was read off the primary source and matches, and that no
 * lawyer has confirmed the reading. SPEC 20's vocabulary rule applies to this
 * page more than to any other - it is a page about what is and is not
 * established.
 */
export type SourceStatus = 'transcribed' | 'pending';

/**
 * The single pass that produced the transcriptions: the Checkpoint A result.
 *
 * Per-row in the TYPE rather than a page-level constant, because the next pass
 * will not re-check everything and a shared constant would then be a lie about
 * the rows it skipped.
 */
export const CHECKPOINT_A = '2026-09-09';

/**
 * The pass that read CLEISS on the droit d'option.
 *
 * ITS OWN CONSTANT, NOT CHECKPOINT_A's, and that is the same reasoning that
 * made verifiedOn per-row in the first place: a second pass does not
 * retroactively verify what the first one did not reach, and a shared date
 * would be a lie about the rows it skipped.
 */
export const CLEISS_PASS = '2026-09-16';

/**
 * One row, and A PENDING ROW CANNOT CARRY A DATE.
 *
 * The first version of this interface had verifiedOn on every row, and I set
 * it to CHECKPOINT_A for all eight - including the two the pass could not
 * reach. That is a verification date on an unverified row: precisely the quiet
 * overclaim this page exists to prevent, on the page that exists to prevent
 * it.
 *
 * A union rather than an optional field, so the wrong combination does not
 * compile. 'pending' has no date because there is no date; 'transcribed'
 * requires one because a transcription without a date says nothing about
 * whether the source has moved since.
 */
export type SourceEntry = {
  readonly id: SourceId;
  /** The publisher, as a reader would name it. */
  readonly sourceName: string;
  /**
   * Which RuleSet constant this row publishes, if any.
   *
   * Absent for the two rows that state a RULE rather than hold a number.
   */
  readonly ruleSetKey?: keyof RuleSet;
  readonly url: string;
} & (
  | { readonly status: 'transcribed'; readonly verifiedOn: string }
  | { readonly status: 'pending' }
);

/**
 * The eight rows, with their primary source and their state.
 *
 * The two 'pending' rows are the two the Checkpoint A pass could not reach:
 * the published cases count days rather than hours, so no fixture exercises
 * the day classification, and Geneve is a source canton, so no published
 * example reaches the 1983-accord list. Both are recorded as pending rather
 * than quietly presented alongside the six that were checked.
 */
export const SOURCE_ENTRIES: readonly SourceEntry[] = [
  {
    id: 'fiscalCeiling',
    sourceName: 'admin.ch',
    verifiedOn: CHECKPOINT_A,
    ruleSetKey: 'fiscalCeiling',
    url: 'https://www.admin.ch/gov/fr/accueil/documentation/communiques.msg-id-96063.html',
    status: 'transcribed',
  },
  {
    id: 'missionCapDays',
    sourceName: 'ge.ch',
    verifiedOn: CHECKPOINT_A,
    ruleSetKey: 'missionCapDays',
    url: 'https://www.ge.ch/imposition-du-teletravail-personnes-frontalieres/regles-missions-temporaires-etranger',
    status: 'transcribed',
  },
  {
    id: 'missionCapProration',
    sourceName: 'ge.ch',
    verifiedOn: CHECKPOINT_A,
    url: 'https://www.ge.ch/imposition-du-teletravail-personnes-frontalieres/regles-missions-temporaires-etranger',
    status: 'transcribed',
  },
  {
    id: 'socialCeiling',
    sourceName: 'bsv.admin.ch',
    verifiedOn: CHECKPOINT_A,
    ruleSetKey: 'socialCeiling',
    url: 'https://www.bsv.admin.ch/bsv/fr/home/assurances-sociales/int/teletravail.html',
    status: 'transcribed',
  },
  {
    id: 'simplifiedBasisDays',
    sourceName: 'ge.ch',
    verifiedOn: CHECKPOINT_A,
    ruleSetKey: 'simplifiedBasisDays',
    url: 'https://www.ge.ch/imposition-du-teletravail-personnes-frontalieres/regles-missions-temporaires-etranger',
    status: 'transcribed',
  },
  {
    id: 'dayClassification',
    sourceName: 'ge.ch',
    url: 'https://www.ge.ch/imposition-du-teletravail-personnes-frontalieres/regles-missions-temporaires-etranger',
    status: 'pending',
  },
  {
    id: 'residence1983Cantons',
    sourceName: 'ge.ch',
    ruleSetKey: 'residence1983Cantons',
    url: 'https://www.ge.ch/imposition-du-teletravail-personnes-frontalieres/regles-missions-temporaires-etranger',
    status: 'pending',
  },
  {
    id: 'a1ThresholdRate',
    sourceName: 'bsv.admin.ch',
    verifiedOn: CHECKPOINT_A,
    ruleSetKey: 'a1ThresholdRate',
    url: 'https://www.bsv.admin.ch/bsv/fr/home/assurances-sociales/int/teletravail.html',
    status: 'transcribed',
  },
  {
    id: 'missionTravelDays',
    sourceName: 'ge.ch',
    verifiedOn: CHECKPOINT_A,
    url: 'https://www.ge.ch/imposition-du-teletravail-personnes-frontalieres/regles-missions-temporaires-etranger',
    status: 'transcribed',
  },
  {
    id: 'genevaWorkedExamples',
    sourceName: 'ge.ch',
    verifiedOn: CHECKPOINT_A,
    url: 'https://www.ge.ch/imposition-du-teletravail-personnes-frontalieres/regles-missions-temporaires-etranger',
    status: 'transcribed',
  },
  {
    id: 'droitOptionWindow',
    sourceName: 'CLEISS',
    verifiedOn: CLEISS_PASS,
    url: 'https://www.cleiss.fr/faq/droit_d_option_des_frontaliers_france-suisse.html',
    status: 'transcribed',
  },
  {
    id: 'droitOptionIrrevocable',
    sourceName: 'CLEISS',
    verifiedOn: CLEISS_PASS,
    url: 'https://www.cleiss.fr/faq/droit_d_option_des_frontaliers_france-suisse.html',
    status: 'transcribed',
  },
  {
    id: 'droitOptionDefault',
    sourceName: 'CLEISS',
    verifiedOn: CLEISS_PASS,
    url: 'https://www.cleiss.fr/faq/droit_d_option_des_frontaliers_france-suisse.html',
    status: 'transcribed',
  },
  {
    id: 'droitOptionBasis',
    sourceName: 'CLEISS',
    verifiedOn: CLEISS_PASS,
    url: 'https://www.cleiss.fr/faq/droit_d_option_des_frontaliers_france-suisse.html',
    status: 'transcribed',
  },
  {
    id: 'droitOptionFamily',
    sourceName: 'CLEISS',
    verifiedOn: CLEISS_PASS,
    url: 'https://www.cleiss.fr/faq/droit_d_option_des_frontaliers_france-suisse.html',
    status: 'transcribed',
  },
  {
    id: 'droitOptionFiling',
    sourceName: 'CLEISS',
    verifiedOn: CLEISS_PASS,
    url: 'https://www.cleiss.fr/faq/droit_d_option_des_frontaliers_france-suisse.html',
    status: 'transcribed',
  },
  {
    // R167: THE INSTRUMENT IS THE NAME, THE URL IS A CONVENIENCE. The form's
    // own address carries `juin2019` and CLEISS marks the form as being
    // updated, so this link is expected to rot - and a dead PDF link is a
    // maintenance item, never this fact becoming unsourced. The row's identity
    // is « Choix du systeme d'assurance maladie »; the FAQ page below is where
    // CLEISS names it, which is what the reader needs to reach it.
    id: 'droitOptionForm',
    sourceName: 'CLEISS',
    verifiedOn: CLEISS_PASS,
    url: 'https://www.cleiss.fr/faq/droit_d_option_des_frontaliers_france-suisse.html',
    status: 'transcribed',
  },
];
