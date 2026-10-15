package ch.monreleve.app.dossier

import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDate
import kotlinx.datetime.daysUntil

// AN5c increment 2 (R286). The CLIENT'S lateness forecast, used ONLY to warn - the pending line
// escalates as the oldest unsynced day nears the backfill threshold (SPEC 11.3), before it is crossed.
//
// KMP-0 increment 6b (R371, R372): moved to :shared commonMain and migrated from java.time to
// kotlinx-datetime (java.time stays in :app). Package unchanged (ch.monreleve.app.dossier), so no :app
// import changes; the five :app call sites map their java.time values to the shared types at the boundary.
//
// R216 - THE CLIENT MAY PREDICT; IT MUST NOT ADJUDICATE. The « saisie tardive » flag the dossier
// prints is computed by the SERVER from its own firstRecordedAt (web/lib/entries/late.ts), never here.
// This forecast answers a different, prospective question - "if this day reached the server now, would
// it be flagged?" - so the warning can fire while the day is still only pending, before the server has
// observed it. Two things, not one: the server's flag is the record; this is a heads-up.
//
// ONE HOME FOR THE SEVEN (R286/R206). BACKFILL_DAYS is bound to fixtures/late-threshold-cases.json by
// LatenessConformanceTest, the SAME file web/tests/unit/entries/late-fixture.test.ts binds the server's
// LATE_BACKFILL_DAYS to. A one-digit change to the fixture fails both builds; a `7` typed here and a
// `7` in late.ts would be the two copies R206 forbids, and the APK's is the one that cannot be changed.
//
// wouldBeLate mirrors the server's rule exactly - UTC midnight of dayDate, STRICTLY GREATER THAN the
// threshold - so the forecast and the eventual flag agree on the same (dayDate, observedAt).
object LatenessForecast {
    /** SPEC 11.3 backfill threshold, in days. Bound to the shared fixture (R206), never a second copy. */
    const val BACKFILL_DAYS = 7

    private const val MS_PER_DAY: Long = 24L * 60 * 60 * 1000
    private const val BACKFILL_MS: Long = BACKFILL_DAYS * MS_PER_DAY

    /** Would a day dated [dayDate] be flagged late if the server observed it at [observedAt]? */
    fun wouldBeLate(
        dayDate: LocalDate,
        observedAt: Instant,
    ): Boolean = observedAt.toEpochMilliseconds() - startOfStoredDayUtcMs(dayDate) > BACKFILL_MS

    /**
     * Whole days remaining before a still-pending day dated [dayDate] would cross the threshold, as of
     * [asOf] (the Paris day). Zero or negative means it would already be flagged - the OVERDUE case.
     *
     * Returned as Long (as the java.time version was): kotlinx-datetime's daysUntil is Int, so the result
     * is widened explicitly rather than letting a caller's inference silently shift from Long to Int.
     */
    fun daysUntilLate(
        dayDate: LocalDate,
        asOf: LocalDate,
    ): Long = (BACKFILL_DAYS - dayDate.daysUntil(asOf)).toLong()

    // toEpochDays() is whole days since 1970-01-01 UTC, so * MS_PER_DAY is UTC midnight of dayDate in
    // epoch millis - the same instant the server's Date.UTC(y, m, d) produces (web/lib/entries/late.ts).
    // (Int days * Long ms promotes to Long; the product cannot overflow at this domain's dates.)
    private fun startOfStoredDayUtcMs(dayDate: LocalDate): Long = dayDate.toEpochDays() * MS_PER_DAY
}
