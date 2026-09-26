package ch.monreleve.app.design

// AN3 increment 2. Kotlin port of web/lib/ui/core/zones.ts.
//
// SPEC 6.2. "Zones and statuses are different things."
//
//   Zone   - the RAIL. Where you stand. Three regulatory bands, coloured
//            success / warning / error, and INCLUSIVE ON THE COMPLIANT SIDE
//            per ruling R32: compliant for rate <= 40, fiscal-exposure for
//            40 < rate <= 49.9, social-switch for rate > 49.9.
//   Status - the BADGE. What it means. Four states, one of which
//            (mission-exposure) sits on the GREEN band with a warning
//            badge.
//
// Colouring the rail by Status is a review rejection (SPEC 6.2), which is
// why these are two functions taking two different inputs. zoneFor is a
// pure position test on a rate; statusFor reads a computed result.
//
// This file computes nothing calc/ does not already own (SPEC 5): every
// threshold comes in from the caller's RuleSet, because SPEC 7.7 makes
// RuleSet the only place a threshold may appear.
//
// wireKey ON EACH ENUM, matching a genuine architectural fact rather than
// decoration: fr/Statuses.kt cannot import Status without inverting the
// dependency direction ui/core -> fr that SPEC 5 requires (fr/ carries no
// runtime imports at all, matching the web side's lib/fr). STATUS_COPY is
// therefore keyed by this plain String, and the join in ZoneTokens.kt looks
// it up by wireKey rather than by the enum directly - the one place this
// port's static guarantee is weaker than the TS reference's, recorded
// rather than hidden: TS's Record<Status, ...> makes a missing entry a
// compile error; ZonesJoinTest.kt makes it a failing test instead.

import ch.monreleve.app.calc.TeleworkResult

/** The rail's three regulatory bands. */
enum class Zone(val wireKey: String) {
    COMPLIANT("compliant"),
    FISCAL_EXPOSURE("fiscal-exposure"),
    SOCIAL_SWITCH("social-switch"),
}

/** The badge's four states. */
enum class Status(val wireKey: String) {
    COMPLIANT("compliant"),
    MISSION_EXPOSURE("mission-exposure"),
    REGIME_LOST("regime-lost"),
    SOCIAL_SWITCH("social-switch"),
}

/**
 * Just the two ceilings, so a caller can pass a narrower object and this
 * file cannot reach anything else on a RuleSet.
 */
data class ZoneThresholds(val fiscalCeiling: Double, val socialCeiling: Double)

/** Fraction to percentage. RuleSet ceilings are fractions; rates are percent. */
private const val PERCENT = 1e2

/**
 * Which band a declarable rate falls in.
 *
 * THE UNIT TRAP, stated because it is silent and total: fiscalCeiling is
 * the FRACTION 0.4 and socialCeiling the FRACTION 0.499, while
 * declarableRate and rawRate are PERCENTAGES in 0-100 - 39.16, not 0.3916.
 * Comparing the rate against the fraction directly makes every rate look
 * like an exceedance. The ceilings are scaled here, once.
 *
 * BOUNDARIES ARE INCLUSIVE ON THE COMPLIANT SIDE (ruling R32): exactly
 * 40.00 is COMPLIANT, with zero headroom, and exactly 49.90 is
 * fiscal-exposure. A rate has to EXCEED a ceiling to leave its band, which
 * is why both comparisons below are strict >.
 *
 * THE COMPARISON IS EXACT AND MUST NOT BE ROUNDED. 0.4 * 1e2 is exactly 40
 * and 0.499 * 1e2 is exactly 49.9 in IEEE 754 (verified by test), so there
 * is nothing here to harden - rewriting this as rounded integer hundredths
 * would fail in the DANGEROUS direction, reporting a rate genuinely past a
 * ceiling as compliant.
 *
 * Throws on a non-finite rate: every `>` against NaN is false, so an
 * unguarded function would fall through to COMPLIANT - painting the
 * success band for a rate that was never computed.
 */
fun zoneFor(
    declarableRate: Double,
    thresholds: ZoneThresholds,
): Zone {
    require(declarableRate.isFinite()) {
        "zoneFor needs a finite percentage, received $declarableRate"
    }

    return when {
        declarableRate > thresholds.socialCeiling * PERCENT -> Zone.SOCIAL_SWITCH
        declarableRate > thresholds.fiscalCeiling * PERCENT -> Zone.FISCAL_EXPOSURE
        else -> Zone.COMPLIANT
    }
}

/**
 * Convenience overload: a whole RuleSet satisfies ZoneThresholds
 * structurally on the web side; here the two fields are read explicitly.
 */
fun zoneFor(
    declarableRate: Double,
    rules: ch.monreleve.app.calc.RuleSet,
): Zone = zoneFor(declarableRate, ZoneThresholds(rules.fiscalCeiling, rules.socialCeiling))

/**
 * Which badge a result earns.
 *
 * Order matters and is not arbitrary. Under the regime the engine clamps
 * the declarable numerator to the fiscal ceiling, so declarableRate can
 * never exceed 40 while regimeApplies is true. Exceeding the SOCIAL
 * ceiling therefore always implies the regime is already lost, and testing
 * regime-lost first would label every social case regime-lost.
 *
 * Needs no thresholds of its own: remainingToSocial is floored to the
 * half-day from (totalWorkDays * socialCeiling - daysCounted), and
 * flooring preserves the sign, so remainingToSocial < 0 is exactly the
 * condition the engine's own SocialCeilingExceeded warning fires on.
 */
fun statusFor(result: TeleworkResult): Status {
    return when {
        result.remainingToSocial < 0 -> Status.SOCIAL_SWITCH
        !result.regimeApplies -> Status.REGIME_LOST
        // Only meaningful while the regime applies. In the regime-lost
        // branch frenchTaxedDays is teleworkDays + missions, so it is
        // positive for a reason that has nothing to do with mission
        // exposure - hence the guard above rather than a condition here.
        result.frenchTaxedDays > 0 -> Status.MISSION_EXPOSURE
        else -> Status.COMPLIANT
    }
}
