package ch.monreleve.app.fr

// AN3 increment 4. Kotlin port of web/lib/fr/metrics.ts.

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
