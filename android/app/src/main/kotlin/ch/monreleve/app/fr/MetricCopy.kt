package ch.monreleve.app.fr

// AN3 increment 4. Kotlin port of web/lib/fr/metrics.ts.
//
// `threshold` IS AN ALREADY-FORMATTED PERCENTAGE - the web source's own
// words: "the output of formatPercent, so '40,0 %' ... Passing a NUMBER
// here would put the formatting decision in two places." Never a French
// noun phrase ("le plafond fiscal"): AN3 increment 6's gallery first
// called this with one, and MetricCopy had no other caller to have
// caught it (a genuine live orphan - CopyReachabilityTest.kt's census
// only ever matched `const val`, never `fun`; see that fence's own
// header). "de le plafond fiscal" rendered, and was wrong twice over -
// not French, AND not the calling convention this file documents. Fixed
// at the call site (dev/GalleryComponentSections.kt now passes a
// formatted percentage, matching SPEC 9.3's own "jours restants avant
// 40 %" / "avant 49,9 %"), not by teaching this function to accept a
// shape the web reference never intended it to.

object MetricCopy {
    /** The ordinary state: headroom left before a ceiling. */
    fun remaining(threshold: String): String = "Jours restants avant $threshold"

    /**
     * SPEC 7.2 step 6: "Negative values are reported, never clamped." A
     * negative headroom is a different sentence about a different
     * quantity, not a differently formatted number - and it names the
     * ceiling that was passed.
     */
    fun over(threshold: String): String = "Jours au-dessus de $threshold"
}
