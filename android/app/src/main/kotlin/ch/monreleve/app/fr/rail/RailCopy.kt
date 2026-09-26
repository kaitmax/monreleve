package ch.monreleve.app.fr.rail

// AN3 increment 3. Kotlin port of web/lib/fr/rail.ts. Every word the rail
// renders.
//
// KEYED BY ZONE'S WIRE KEY, NEVER BY STATUS (matching the web file's own
// reasoning): 'compliant' and 'social-switch' are members of both Zone and
// Status, so reusing STATUS_COPY's words here would conflate the two axes
// SPEC 6.2 keeps separate. Keyed by String rather than importing
// design.Zone directly, for the same dependency-direction reason
// fr/StatusCopy.kt gives (fr/ carries no runtime imports).
//
// RULING R36. The three band names are parallel: each states what happens
// to you in that band rather than describing a position.
//
// NO THRESHOLD NUMBERS in any of these strings - the figures come from the
// year's RuleSet.

val ZONE_BAND_NAME: Map<String, String> =
    mapOf(
        "compliant" to "Imposition Suisse",
        "fiscal-exposure" to "Imposition France",
        "social-switch" to "Sécurité sociale France",
    )

private val ZONE_SPOKEN: Map<String, String> =
    mapOf(
        "compliant" to "imposition en Suisse",
        "fiscal-exposure" to "une partie est imposable en France",
        "social-switch" to "seuil de sécurité sociale dépassé",
    )

/**
 * The rail's accessible name, assembled from the ALREADY-FORMATTED rate -
 * the copy stays here, the figure stays with the formatter.
 */
fun railAriaLabel(
    formattedRate: String,
    zoneWireKey: String,
): String {
    val spoken = ZONE_SPOKEN[zoneWireKey] ?: error("no ZONE_SPOKEN entry for '$zoneWireKey'")

    return "Taux de télétravail déclarable $formattedRate, $spoken."
}

/**
 * Wrapped in an object rather than left as top-level consts, so
 * CopyReachabilityTest.kt's census (which reads an enclosing `object Name`
 * to build the `Name.CONST` reference it greps for) actually covers these -
 * a bare top-level `const val` was found, on that fence's own re-run
 * against this file, to evade the census entirely.
 */
object RailCopy {
    /**
     * The social card's accessible name. Names NO rate and NO zone (R44):
     * that card is generic, illustrating where the thresholds sit rather
     * than reporting anyone's result.
     */
    const val RAIL_SOCIAL_ARIA = "Illustration des deux seuils de télétravail déclarable."

    /** Ruling R33's third state. A statement, not a bare adjective. */
    const val RAIL_UNAVAILABLE_LABEL = "Taux indisponible"

    const val RAIL_UNAVAILABLE_ARIA = "Taux de télétravail déclarable indisponible."
}
