// web/lib/calc-engine/regime.ts
//
// SPEC section 7.2 step 1. Derived from the canton, never asked.
//
//   regime = canton in {BE, SO, BS, BL, VD, VS, NE, JU} -> 'residence-1983'
//                                                  else -> 'source'
//
// The 40 % ceiling is the same either way. The consequence of breaching it is
// not: under 'source', French tax falls on the excess days; under
// 'residence-1983', the frontalier status itself is at risk. The engine
// reports which regime applies and the wording lives in lib/fr.

import { LATEST_KNOWN_TAX_YEAR, ruleSetFor } from './rules';
import type { Canton, Regime } from './types';

/**
 * The canton list is read from the RuleSet rather than restated here, so the
 * eight cantons exist in exactly one place with their source citation.
 *
 * SPEC section 7.4 gives this function no taxYear parameter, so it resolves
 * the latest known set. calculateTelework resolves its own set from
 * input.taxYear (SPEC 7.7) and does not depend on this default.
 */
export function regimeFor(canton: Canton): Regime {
  const { residence1983Cantons } = ruleSetFor(LATEST_KNOWN_TAX_YEAR);

  return residence1983Cantons.includes(canton) ? 'residence-1983' : 'source';
}
