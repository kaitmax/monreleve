// web/lib/lamal/years.ts
//
// THE COMPARATOR'S YEARS, and the one rule that governs them: NEVER MIX YEARS
// (R671). A year is its premiums, its PASS and its rate together; a year whose
// premiums are not here does not exist for the comparator, and asking for it
// is a refusal rather than last year's figure under this year's label (R657).
//
// THE PREMIUMS ARE GENERATED (R656) and imported, never typed here. The few
// values below are not in the OFSP file; each is a regulatory figure with its
// row in docs/regulatory-sources.md (L7, L12, L13, L14), the same treatment as
// a RuleSet constant:
//
//   ratePercent 8, allowance 25 % of the PASS   CSS art. D380-2 I (L7),
//                                               in force since 01.01.2019
//                                               with no end date
//   PASS 2026 = 48 060 EUR                      URSSAF, page of 01.01.2026 (L12)
//   PASS 2027 = 48 900 EUR, ANNOUNCED           URSSAF, page of 20.10.2026 (L13):
//                                               "Un arrêté sera publié d'ici la
//                                               fin de l'année."
//   1 EUR = 0,9239 CHF on 27.10.2026            ECB reference rate (L14)
//
// WHEN THE 2027 ARRÊTÉ IS PUBLISHED: check the figure against it and flip
// passStatus to 'final' - docs/lamal-refresh.md, step 4. The page's label
// follows the flag; nothing else changes.

import { PREMIUMS_2026 } from './premiums-2026.generated';
import { PREMIUMS_2027 } from './premiums-2027.generated';
import type { ComparatorYear, ExchangeRate } from './types';

export const COMPARATOR_YEARS: readonly ComparatorYear[] = [
  {
    year: 2026,
    premiums: PREMIUMS_2026,
    passEur: 48060,
    passStatus: 'final',
    passPageDate: '2026-01-01',
    passFinalBy: null,
    ratePercent: 8,
    allowancePercentOfPass: 25,
  },
  {
    year: 2027,
    premiums: PREMIUMS_2027,
    passEur: 48900,
    passStatus: 'announced',
    passPageDate: '2026-10-20',
    // R677 (the operator's Q5): the arrete normally appears by late
    // December, so from this day the gate fails while 2027 is still
    // 'announced' (tests/unit/lamal/pass-deadline.test.ts).
    passFinalBy: '2027-01-15',
    ratePercent: 8,
    allowancePercentOfPass: 25,
  },
];

/**
 * The years a reader may choose, newest first.
 *
 * The default is the NEWEST year here, never a typed 2027 (R171): next
 * autumn's refresh adds 2028 and the default moves with it.
 */
export const AVAILABLE_YEARS: readonly number[] = COMPARATOR_YEARS.map((entry) => entry.year).sort(
  (a, b) => b - a,
);

export const DEFAULT_YEAR: number = Math.max(...AVAILABLE_YEARS);

/**
 * R677: the years whose plafond is still ANNOUNCED on or after the day it was
 * due to be final. Pure - the caller passes today (ISO, Europe/Paris) - so
 * both sides of the date are testable without a clock.
 */
export function overdueAnnouncedPasses(
  years: readonly ComparatorYear[],
  isoToday: string,
): readonly ComparatorYear[] {
  return years.filter(
    (entry) => entry.passStatus === 'announced' && entry.passFinalBy !== null && isoToday >= entry.passFinalBy,
  );
}

/** The year's parameters, or undefined - the caller refuses (R657). */
export function comparatorYear(year: number): ComparatorYear | undefined {
  return COMPARATOR_YEARS.find((entry) => entry.year === year);
}

/** R672: one fixed ECB rate, stored with its date, refreshed with the data. */
export const EXCHANGE_RATE: ExchangeRate = {
  chfPerEurTenThousandths: 9239,
  date: '2026-10-27',
};

/**
 * R664: the dataset the reuse terms require the page to name - author,
 * title, link. The words are in lib/fr/lamal.ts (they are French copy); the
 * link and the date are here.
 */
export const PREMIUM_DATASET_URL = 'https://opendata.swiss/fr/dataset/health-insurance-premiums';

/** R668: where a reader chooses an insurer. The page names none. */
export const PRIMINFO_URL = 'https://www.priminfo.admin.ch/fr/praemien';

/** The ECB page the rate was read from (L14). */
export const ECB_RATES_URL =
  'https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html';
