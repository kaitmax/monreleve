// web/lib/lamal/cost-sharing.ts
//
// FW-CALCS-A2, R746 (S1): the most a household pays in Switzerland ON TOP OF
// its premiums in a calendar year - the franchise and the capped quote-part.
// Pure. Shown on its own card and NEVER added to either side of the
// comparison (R746).
//
// THE FIGURES ARE REGULATORY, each with its row (docs/regulatory-sources.md,
// L15), read from docs/sources/primes-lamal/sources-2026-11.md:
//
//   share 10 % of costs above the franchise    LAMal art. 64 al. 2 let. b (S1.1)
//   share capped at 700 CHF a year, adult      OAMal art. 103 al. 2 (S1.2)
//   share capped at 350 CHF a year, child      OAMal art. 103 al. 2; LAMal
//                                              art. 64 al. 4 ("réduit de moitié")
//   no franchise for a child                   LAMal art. 64 al. 4 (S1.1)
//   several children with one insurer pay      LAMal art. 64 al. 4, second
//     together at most an adult's franchise    sentence (S1.1)
//     and share
//   all of it applies to insured persons       OAMal art. 103 al. 7 (S1.2)
//     residing in the EU and insured in CH
//
// THE FRANCHISE is the premium data's own (franchiseChf, row L1) - 300 CHF
// for an adult and a young adult, 0 for a child, which is OAMal art. 103
// al. 1's figure - so the cap and the premiums it sits beside are priced on
// the same franchise. A YOUNG ADULT pays as an adult here: the child rules
// stop at 18 (S1.3, S1.5: "jusqu'à 18 ans révolus"), the class bound row L5
// already derives.
//
// THE CHILDREN'S JOINT CAP assumes one insurer for the whole household, which
// is how every Swiss total on the page is formed (compare.ts).
//
// NOT COUNTED, and the page says so: the hospital contribution of LAMal
// art. 64 al. 5 (15 CHF a day, S1.4), which has no annual cap.

import type { ComparatorYear, PersonResult } from './types';

/** OAMal art. 103 al. 2, and LAMal art. 64 al. 2 let. b. */
export const COST_SHARING = {
  /** The quote-part: this share of the costs above the franchise. */
  sharePercent: 10,
  /** Its annual cap for an adult (and a young adult), in CHF. */
  shareCapAdultChf: 700,
  /** Its annual cap for a child, in CHF - half the adult's (LAMal art. 64 al. 4). */
  shareCapChildChf: 350,
} as const;

/** The most one adult pays: franchise + capped share, in CHF. */
function adultCapChf(year: ComparatorYear): number {
  return year.premiums.franchiseChf.adult + COST_SHARING.shareCapAdultChf;
}

/** What the children pay before the joint cap, in CHF. */
function childrenChf(year: ComparatorYear, persons: readonly PersonResult[]): number {
  const children = persons.filter((person) => person.ageClass === 'child').length;

  return children * (year.premiums.franchiseChf.child + COST_SHARING.shareCapChildChf);
}

/**
 * Whether the children's joint cap (LAMal art. 64 al. 4, second sentence)
 * lowers the household's figure - the page then says so.
 */
export function childrenCapApplies(year: ComparatorYear, persons: readonly PersonResult[]): boolean {
  return childrenChf(year, persons) > adultCapChf(year);
}

/** The household's annual maximum on top of the premiums, in CHF centimes. */
export function careCapCentimes(year: ComparatorYear, persons: readonly PersonResult[]): number {
  const grownUps = persons
    .filter((person) => person.ageClass !== 'child')
    .reduce((sum, person) => sum + year.premiums.franchiseChf[person.ageClass] + COST_SHARING.shareCapAdultChf, 0);

  return 100 * (grownUps + Math.min(childrenChf(year, persons), adultCapChf(year)));
}
