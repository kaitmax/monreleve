package ch.monreleve.app.calc

// AN2 increment 2: ports web/lib/calc-engine/regime.ts.
//
// SPEC section 7.2 step 1. Derived from the canton, never asked.
//
//   regime = canton in {BE, SO, BS, BL, VD, VS, NE, JU} -> RESIDENCE_1983
//                                                  else -> SOURCE
//
// The 40% ceiling is the same either way. The consequence of breaching it is
// not: under SOURCE, French tax falls on the excess days; under
// RESIDENCE_1983, the frontalier status itself is at risk. The engine
// reports which regime applies; the wording lives in the UI layer.

/**
 * The canton list is read from the RuleSet rather than restated here, so the
 * eight cantons exist in exactly one place with their source citation.
 *
 * SPEC section 7.4 gives this function no taxYear parameter, so it resolves
 * the latest known set. calculateTelework resolves its own set from
 * input.taxYear (SPEC 7.7) and does not depend on this default.
 */
fun regimeFor(canton: Canton): Regime {
    val residence1983Cantons = ruleSetFor(LATEST_KNOWN_TAX_YEAR).residence1983Cantons

    return if (canton in residence1983Cantons) Regime.RESIDENCE_1983 else Regime.SOURCE
}
