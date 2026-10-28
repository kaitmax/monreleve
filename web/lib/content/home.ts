// web/lib/content/home.ts
//
// The non-copy facts the home page is built from: the worked example its
// phone pictures show, and the sample week of its releve excerpt. Words live
// in lib/fr/home.ts; this file holds the fixture and the data, the same split
// as lib/content/sources.ts against lib/fr/sources.ts.
//
// THE WORKED EXAMPLE IS A FIXTURE, NOT A PICTURE (R147, R163). FW34 drew it in
// the hero's phone card; since FW-HOME-A2 the two phones of the application
// section show it (R716). Either way the figure on screen is RENDERED by the
// engine from THIS input, never typed beside it.
//
// FW34's HOME_GUIDE_SLUGS LEFT WITH ITS GUIDES SECTION (R720): the A2 page has
// no such section, and the shell's footer links every published guide on
// every page, which e2e/home.spec.ts asserts guide by guide.
//
// taxYear IS A PARAMETER, not a constant here, for R55's reason: the year comes
// from the server's Europe/Paris clock at render, never from a literal that is
// correct only until the next 1 January. ruleSetFor falls back to the latest
// known set for an unknown year, so the figures stay the 2026 ones until a
// 2027 RuleSet exists.

import type { TeleworkInput } from '@/lib/calc-engine';

/**
 * The worked example: 38 telework days on the simplified 240-day basis,
 * full time, a whole year, no missions. Canton GE because the example must name
 * one and Geneva is the published reference canton; the regime is source either
 * way below the ceiling, so the choice changes none of the three figures.
 *
 * A FUNCTION OF THE YEAR, so the RuleSet it is computed against is the same one
 * every other surface resolves (R55). Not exported since FW-HOME-A2: the
 * caption that narrated it went with FW34's hero, and nothing reads it but
 * the input below (R720).
 */
const HERO_EXAMPLE_TELEWORK_DAYS = 38;

export function heroExampleInput(taxYear: number): TeleworkInput {
  return {
    taxYear,
    canton: 'GE',
    employmentRate: 100,
    periodFraction: 1,
    denominator: { kind: 'simplified240' },
    granularity: 'day',
    teleworkDays: HERO_EXAMPLE_TELEWORK_DAYS,
    missionDaysFrance: 0,
    missionDaysThirdState: 0,
  };
}

/**
 * What a sample day of the releve excerpt was, as the dots and the words
 * render it (FW-HOME-A2, R714). The words live in lib/fr/home.ts; the dots are
 * the France and Switzerland tokens, always beside those words.
 */
export type ReleveSampleKind = 'swiss' | 'home' | 'split' | 'absence';

export interface ReleveSampleDay {
  /** R28: a calendar day is an ISO YYYY-MM-DD string, formatted by formatDate. */
  readonly day: string;
  readonly kind: ReleveSampleKind;
  /** An instant, rendered in Europe/Paris by formatDateTime (R28, R586). */
  readonly recordedAt: string;
}

/**
 * THE HOME PAGE'S RELEVE EXCERPT IS A SAMPLE, AND SAYS SO (R714).
 *
 * Five days of one week in the sample's year, with the instant each was
 * recorded. DATA RATHER THAN DISPLAY STRINGS: the excerpt formats them with
 * the product's own formatDate and formatDateTime, so the sample reads the
 * way the real releve's annex reads (SPEC 6.4's Swiss dots, Paris time) and
 * no second date format is typed into copy. The instants are UTC; 19-23
 * October 2026 is summer time in Paris (UTC+2), so 16:42Z renders 18:42.
 *
 * A FIXED YEAR, unlike the hero example's: a sample week names weekdays, and
 * a year read from the clock would put these dates on other weekdays next
 * January. The excerpt's heading takes its year from here.
 */
export const RELEVE_SAMPLE = {
  year: 2026,
  days: [
    { day: '2026-10-19', kind: 'swiss', recordedAt: '2026-10-19T16:42:00Z' },
    { day: '2026-10-20', kind: 'home', recordedAt: '2026-10-20T17:05:00Z' },
    { day: '2026-10-21', kind: 'split', recordedAt: '2026-10-21T16:11:00Z' },
    { day: '2026-10-22', kind: 'swiss', recordedAt: '2026-10-22T16:37:00Z' },
    { day: '2026-10-23', kind: 'absence', recordedAt: '2026-10-23T06:02:00Z' },
  ],
} as const satisfies { readonly year: number; readonly days: readonly ReleveSampleDay[] };
