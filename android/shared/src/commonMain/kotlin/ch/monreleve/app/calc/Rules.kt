package ch.monreleve.app.calc

// AN2 increment 1: ports web/lib/calc-engine/rules.ts.
//
// THE ONLY PLACE A THRESHOLD MAY APPEAR (SPEC section 7.7). A bare 0.4 or 240
// anywhere else in the engine is a review rejection.
//
// Every constant carries its source per SPEC section 7.1. The primary
// references, with fetch dates, live in docs/regulatory-sources.md.
//
// VERIFICATION PENDING. These figures were drafted from advisory sources.
// They must be checked against admin.ch, the AFC and impots.gouv.fr before
// the Geneva fixtures are frozen. Changing any of them is an ask-first item
// (SPEC section 20). Kept byte-for-byte identical to rules.ts's own values -
// this file does not re-derive them, it transcribes the same source.

/**
 * The eight cantons under the 11 April 1983 accord, where the frontalier
 * status itself is at risk on breach rather than only the tax treatment.
 * Source: amicable agreement on the 11 April 1983 accord.
 */
private val RESIDENCE_1983_CANTONS: List<Canton> =
    listOf(
        Canton.BE,
        Canton.SO,
        Canton.BS,
        Canton.BL,
        Canton.VD,
        Canton.VS,
        Canton.NE,
        Canton.JU,
    )

private val RULES_2026 =
    RuleSet(
        taxYear = 2026,
        // 40% of annual working time (art. 10).
        // Source: avenant of 27 June 2023, in force 1 January 2026.
        fiscalCeiling = 0.4,
        // 49.9%, conditional on a valid A1.
        // Source: EU framework agreement; art. 16 of regulation 883/2004.
        socialCeiling = 0.499,
        // 25%: the bottom of the EU framework agreement's band. The
        // agreement applies from 25% telework in the state of residence up
        // to (but not including) 50%. BELOW 25%, article 13 of regulation
        // (EC) 883/2004 governs instead, and the framework agreement's A1 is
        // not the instrument in question - which is why a warning that fired
        // on any counted day named the wrong document for a third of its
        // audience.
        //
        // Verified at Checkpoint A, 09.09.2026, against
        // bsv.admin.ch/fr/teletravail.
        a1ThresholdRate = 0.25,
        // 10 days per year, INSIDE the 40%. Prorated for part-time and
        // partial years, rounded up - the one rule that favours the user.
        //
        // Source: same avenant. The interpretation is the AMICABLE AGREEMENT
        // OF 30 JUNE 2023, which ge.ch cites.
        missionCapDays = 10,
        // 240 days per year at full time. Absorbs leave, holidays and
        // sickness, so there is no calendar arithmetic and no holiday table.
        // Source: circular no. 45 of 12 June 2019, point 7.5.1.
        simplifiedBasisDays = 240,
        residence1983Cantons = RESIDENCE_1983_CANTONS,
        sources =
            listOf(
                "Fiscal ceiling 40% of annual working time (art. 10) - avenant of " +
                    "27 June 2023, in force 1 January 2026",
                "Mission sub-cap 10 days/year inside the 40% - same avenant; " +
                    "amicable agreement of 30 June 2023.",
                "A1 threshold 25% - EU framework agreement on cross-border telework, " +
                    "applying from 25% to under 50%; below 25%, art. 13 reg. (EC) " +
                    "883/2004 governs. Verified 09.09.2026 against bsv.admin.ch/fr/teletravail",
                "Mission cap proration, proportional and rounded up - amicable " +
                    "agreement of 30 June 2023",
                "Social ceiling 49.9%, conditional on a valid A1 - EU framework " +
                    "agreement, art. 16 reg. 883/2004",
                "Simplified denominator 240 days/year full-time - circular no. 45 " +
                    "of 12 June 2019, pt 7.5.1",
                "Day classification, over 4h = 1 day and 2-4h = half day - " +
                    "circular no. 45, pt 7.5.1",
                "Same 40% ceiling in 1983-accord cantons, frontalier status " +
                    "preserved - amicable agreement on the 11 April 1983 accord",
            ),
    )

/**
 * Every known rule set, keyed by tax year. 2026 is the only set at launch.
 *
 * Adding a year requires a new fixture file for that year, sourced and
 * reviewed, before it can become the default (SPEC section 7.7).
 */
private val RULE_SETS: Map<Int, RuleSet> = mapOf(RULES_2026.taxYear to RULES_2026)

/**
 * The newest set, named directly rather than looked up. A lookup would be
 * typed RuleSet? and need a defensive fallback that no test can reach, which
 * shows up as an uncovered branch against the 100% engine coverage gate.
 * Update this line when a newer year is added.
 */
private val LATEST_KNOWN_RULES: RuleSet = RULES_2026

/**
 * The newest year with its own rule set. Internal: not part of the public
 * surface. Used by helpers whose SPEC 7.4 signature takes no taxYear.
 */
internal val LATEST_KNOWN_TAX_YEAR: Int = LATEST_KNOWN_RULES.taxYear

/**
 * Resolves the rule set for a tax year, falling back to the latest known set
 * for an unknown year.
 *
 * The fallback is surfaced by the returned set naming its own taxYear: a
 * caller passing 2027 gets a set whose taxYear is 2026, so the substitution
 * is visible rather than silent. Nothing is relabelled as the requested
 * year.
 *
 * Total by construction, so it never throws (SPEC section 7). Both sides of
 * the fallback are reachable and tested.
 */
fun ruleSetFor(taxYear: Int): RuleSet = RULE_SETS[taxYear] ?: LATEST_KNOWN_RULES
