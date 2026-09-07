// web/lib/ui/core/zones.ts
//
// SPEC 6.2. "Zones and statuses are different things."
//
//   Zone   - the RAIL. Where you stand. Three regulatory bands, coloured
//            success / warning / error, and INCLUSIVE ON THE COMPLIANT SIDE
//            per ruling R32: compliant for rate <= 40, fiscal-exposure for
//            40 < rate <= 49.9, social-switch for rate > 49.9.
//   Status - the BADGE. What it means. Four states, one of which
//            (mission-exposure) sits on the GREEN band with a warning badge.
//
// Colouring the rail by Status is a review rejection (SPEC 6.2), which is why
// these are two functions taking two different inputs. zoneFor is a pure
// position test on a rate; statusFor reads a computed result.
//
// This module computes nothing (SPEC 5: "lib/ui imports types from
// calc-engine, never logic; it computes nothing"). It maps. Every threshold
// comes in from the caller's RuleSet, because SPEC 7.7 makes RuleSet the only
// place a threshold may appear - a copy of 40 or 49.9 here would be a second
// source of truth for the numbers the whole product turns on.

import { STATUS_VISUAL } from './zone-tokens';
import { STATUS_COPY } from '@/lib/fr/statuses';
import type { StatusVisual } from './zone-tokens';
import type { RuleSet, TeleworkResult } from '@/lib/calc-engine';

// Re-exported so consumers keep one import site for the whole mapping. The
// definitions live in zone-tokens.ts because that file has no runtime imports
// and can therefore be loaded by the _zones.scss generator; see its header.
export { STATUS_VISUAL, ZONE_BAND_TOKEN } from './zone-tokens';
export type { LucideIconName, StatusVisual } from './zone-tokens';

/** The rail's three regulatory bands. */
export type Zone = 'compliant' | 'fiscal-exposure' | 'social-switch';

/** The badge's four states. */
export type Status = 'compliant' | 'mission-exposure' | 'regime-lost' | 'social-switch';

/**
 * Just the two ceilings, so a caller can pass a whole RuleSet or a narrower
 * object, and so this module cannot reach anything else on it.
 */
export type ZoneThresholds = Pick<RuleSet, 'fiscalCeiling' | 'socialCeiling'>;

/** Fraction to percentage. RuleSet ceilings are fractions; rates are percent. */
const PERCENT = 1e2;

/**
 * Everything a badge needs. SPEC 6.2: "Every status carries icon + label +
 * one-line explanation, identical on web, Android, and PDF." DESIGN-SYSTEM.md
 * section 1: "STATUS IS NEVER COLOUR ALONE: colour + icon + text, always."
 */
export interface StatusPresentation extends StatusVisual {
  readonly label: string;
  readonly explanation: string;
}

/**
 * The visual mapping joined to the French copy. This is the join, and the
 * only place the two halves meet: the token mapping is dependency-free data
 * in zone-tokens.ts so the SCSS generator can read it, and the words are in
 * lib/fr because SPEC section 5 puts every user-facing string there.
 *
 * Built by iterating STATUS_VISUAL rather than by writing four entries out,
 * so a Status added to one half and not the other is a compile error instead
 * of a badge that renders with no words.
 */
export const STATUS_PRESENTATION: Record<Status, StatusPresentation> = Object.fromEntries(
  (Object.keys(STATUS_VISUAL) as Status[]).map((status) => [
    status,
    { ...STATUS_VISUAL[status], ...STATUS_COPY[status] },
  ]),
) as Record<Status, StatusPresentation>;

/**
 * Which band a declarable rate falls in.
 *
 * THE UNIT TRAP, stated because it is silent and total: RuleSet.fiscalCeiling
 * is the FRACTION 0.4 and socialCeiling the FRACTION 0.499, while
 * declarableRate and rawRate are PERCENTAGES in 0-100 - 39.16, not 0.3916.
 * Comparing the rate against the fraction directly makes every rate look like
 * an exceedance, so a comfortable 30 % would come back 'social-switch'. The
 * ceilings are scaled here, once, and a test asserts a rate of 30 is
 * compliant against the real RuleSet.
 *
 * BOUNDARIES ARE INCLUSIVE ON THE COMPLIANT SIDE (ruling R32): exactly 40.00
 * is COMPLIANT, with zero headroom, and exactly 49.90 is fiscal-exposure. A
 * rate has to EXCEED a ceiling to leave its band, which is why both
 * comparisons below are strict.
 *
 * The fixtures forced this. Geneva case b is teleworkDays 91 with 8 mission
 * days: declarableRate exactly 40, regimeApplies TRUE, 237 of 240 days taxed
 * in Switzerland - and case d is the same at 94/12. Reading 40 as
 * fiscal-exposure painted those rails amber while the ship-blocking fixture
 * said the regime applies, so the rail contradicted the fixture. At the social
 * ceiling the same reading disagreed with the ENGINE: SOCIAL_CEILING_EXCEEDED
 * fires only once remainingToSocial goes negative, so at exactly 49.9 the
 * engine says the ceiling is not exceeded while the old band said it was.
 *
 * THE COMPARISON IS EXACT AND MUST NOT BE ROUNDED. Both scalings are exact in
 * IEEE 754 - 0.4 * 1e2 is 40 and 0.499 * 1e2 is 49.9, verified by test - so
 * there is nothing here to harden. Rewriting these as integer hundredths
 * (Math.round(rate * 1e2) > Math.round(ceiling * 1e4)) looks safer and is
 * not, and under R32's strict > it fails in the DANGEROUS direction:
 * Math.round(40.001 * 1e2) is 4000, which is not > 4000, so a rate genuinely
 * past the fiscal ceiling would be reported compliant. Understating a breach
 * is worse than inventing one. declarableRate is always n/100 today, but
 * zoneFor is exported and FW7 animates the rail, so finer rates will reach
 * it. Tests pin 40.001, 49.901, 39.999 and 49.8999 for that reason.
 *
 * Throws on a non-finite rate. Every `>` against NaN is false, so the
 * unguarded function would fall through and return 'compliant' - painting the
 * success band for a rate that was never computed. That failure is invisible,
 * and it is the one SPEC section 20 cares most about, so it is loud instead.
 * The engine cannot produce NaN here (validate rejects non-finite input); a
 * parsed query parameter or an absent field can.
 */
export function zoneFor(declarableRate: number, thresholds: ZoneThresholds): Zone {
  if (!Number.isFinite(declarableRate)) {
    throw new RangeError(`zoneFor needs a finite percentage, received ${declarableRate}`);
  }

  if (declarableRate > thresholds.socialCeiling * PERCENT) return 'social-switch';
  if (declarableRate > thresholds.fiscalCeiling * PERCENT) return 'fiscal-exposure';

  return 'compliant';
}

/**
 * Which badge a result earns.
 *
 * Order matters and is not arbitrary. Under the regime the engine clamps the
 * declarable numerator to the fiscal ceiling (waterfall.ts,
 * budget = min(missionCap, headroom)), so declarableRate can never exceed 40
 * while regimeApplies is true. Exceeding the SOCIAL ceiling therefore always
 * implies the regime is already lost, and testing regime-lost first would
 * label every social case regime-lost.
 *
 * Needs no thresholds of its own: remainingToSocial is floored to the half-day
 * from (totalWorkDays * socialCeiling - daysCounted), and flooring preserves
 * the sign, so remainingToSocial < 0 is exactly the condition the engine's own
 * SOCIAL_CEILING_EXCEEDED warning fires on. The badge and the warnings
 * therefore cannot disagree.
 *
 * Under ruling R32 this NO LONGER disagrees with the rail at exactly 49.9 %.
 * Both now treat a ceiling as crossed only when it is exceeded, so neither
 * the band nor the badge can claim a social breach the engine does not report.
 * They still differ in KIND - Zone is position, Status is consequence, so
 * regime-lost on the fiscal-exposure band is normal - but they no longer
 * contradict each other about whether a threshold was passed.
 */
export function statusFor(result: TeleworkResult): Status {
  if (result.remainingToSocial < 0) return 'social-switch';
  if (!result.regimeApplies) return 'regime-lost';

  // Only meaningful while the regime applies. In the regime-lost branch
  // frenchTaxedDays is teleworkDays + missions, so it is positive for a reason
  // that has nothing to do with mission exposure - hence the guard above
  // rather than a condition here.
  if (result.frenchTaxedDays > 0) return 'mission-exposure';

  return 'compliant';
}
