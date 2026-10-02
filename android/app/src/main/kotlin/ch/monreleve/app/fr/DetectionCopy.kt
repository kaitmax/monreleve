package ch.monreleve.app.fr

// AN-AUTO. The automatic-detection copy (SPEC 11.2 auto states, R311-R315). Fully accented (R155),
// typographic apostrophes (R126 / U+2019). Reachable from the Aujourd'hui auto surface (R238); until
// that surface is built (increment 5, R314) the strings are declared in CopyReachabilityTest's
// allowlist with the increment they wait for.
//
// R27: WORDS, NEVER A PERCENTAGE. A confidence judgement is about evidence quality, not a statistic;
// the not-sure message explains and directs, it never quotes a number.

object DetectionCopy {
    // R312: shown when a day withholds (MEDIUM or LOW under R311). It says why, in plain words, and what
    // to do - and it is NOT alarming: the honest answer is "we are not sure", not "something is wrong".
    const val NOT_SURE = "Nous ne sommes pas certains de votre position ce jour-là. Indiquez-le vous-même."

    // R313: shown ONCE when the person's recent days are mostly near the border, where detection is unreliable.
    // It offers manual as the more accurate choice without disparaging detection, and leaves the choice to them
    // (D19 - manual is a peer, auto is never forced off). No percentage (R27).
    const val NEAR_BORDER =
        "Vous semblez habiter près de la frontière, là où la détection est souvent incertaine. La saisie " +
            "manuelle y sera plus fiable. Vous pouvez garder la détection automatique ou passer en saisie " +
            "manuelle, comme vous préférez."
}
