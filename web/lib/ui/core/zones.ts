// web/lib/ui/core/zones.ts
//
// SPEC 6.2. "Zones and statuses are different things."
//
//   Zone   - the RAIL. Where you stand. Three regulatory bands,
//            0-40 / 40-49.9 / >= 49.9, coloured success / warning / error.
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

import { STATUS_COPY } from '@/lib/fr/statuses';
import type { RuleSet, TeleworkResult } from '@/lib/calc-engine';

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
 * A Lucide icon name in kebab-case, which is the form DESIGN-SYSTEM.md and the
 * Android port both use. lucide-react keys its icons in PascalCase, so the
 * React layer converts at FW8; a test asserts every name here resolves to a
 * real Lucide icon, because a typo renders an empty badge rather than an
 * error.
 */
export type LucideIconName = string;

/**
 * Everything a badge needs. SPEC 6.2: "Every status carries icon + label +
 * one-line explanation, identical on web, Android, and PDF." DESIGN-SYSTEM.md
 * section 1: "STATUS IS NEVER COLOUR ALONE: colour + icon + text, always."
 */
export interface StatusPresentation {
  readonly label: string;
  readonly explanation: string;
  readonly icon: LucideIconName;
  /** A DESIGN-SYSTEM.md token name. Never a hex - this module has no colours. */
  readonly colourToken: string;
  readonly softColourToken: string;
}

export const STATUS_PRESENTATION: Record<Status, StatusPresentation> = {
  compliant: {
    ...STATUS_COPY.compliant,
    icon: 'circle-check',
    colourToken: '--colour-success',
    softColourToken: '--colour-success-soft',
  },

  // The warning badge on the green band (SPEC 6.2). Success here would make
  // the badge agree with the rail and the exposure invisible.
  'mission-exposure': {
    ...STATUS_COPY['mission-exposure'],
    icon: 'triangle-alert',
    colourToken: '--colour-warning',
    softColourToken: '--colour-warning-soft',
  },

  'regime-lost': {
    ...STATUS_COPY['regime-lost'],
    icon: 'circle-x',
    colourToken: '--colour-error',
    softColourToken: '--colour-error-soft',
  },

  // Distinct icon from regime-lost, deliberately. Both are error-coloured, and
  // a badge that looks identical for "you lost the tax regime" and "your
  // social security affiliation moves" would flatten two different legal
  // consequences into one picture. Raised in the report as a design choice.
  'social-switch': {
    ...STATUS_COPY['social-switch'],
    icon: 'octagon-alert',
    colourToken: '--colour-error',
    softColourToken: '--colour-error-soft',
  },
};

/**
 * Zone to band colour (SPEC 6.2): the three bands are coloured success /
 * warning / error. The rail is coloured by ZONE and never by Status - that is
 * a review rejection - which is why this map is keyed by Zone and lives apart
 * from STATUS_PRESENTATION.
 */
export const ZONE_BAND_TOKEN: Record<Zone, string> = {
  compliant: '--colour-success',
  'fiscal-exposure': '--colour-warning',
  'social-switch': '--colour-error',
};

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
 * Boundaries are inclusive at the bottom of each higher band: exactly 40.00 is
 * fiscal-exposure and exactly 49.90 is social-switch, because the bands are
 * written 0-40 / 40-49.9 / >= 49.9 and a position exactly on a line is on the
 * line, not below it.
 */
export function zoneFor(declarableRate: number, thresholds: ZoneThresholds): Zone {
  if (declarableRate >= thresholds.socialCeiling * PERCENT) return 'social-switch';
  if (declarableRate >= thresholds.fiscalCeiling * PERCENT) return 'fiscal-exposure';

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
 * Note this is deliberately STRICTER than the rail at exactly 49.9 %: the band
 * includes 49.9 because that is where you stand, the badge does not because
 * the ceiling has not been crossed. See REPORT-FW6.txt.
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
