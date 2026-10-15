package ch.monreleve.app.dossier

import ch.monreleve.app.data.local.RhythmKind
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.runBlocking
import kotlinx.datetime.LocalDate

// AN-FORECAST (R340). A PROJECTION IS NEVER A RECORD - the unit witness.
//
// Computing a forecast reads the rhythm and the recorded days and runs them through the engine; it must
// write NOTHING back - not the rhythm store, not the recorded days. This asserts it: a recording rhythm
// repository whose save/clear are counted is never written during a compute, and the recorded list handed
// in comes back unchanged (forecastResults builds "recorded + imagined" as a NEW list, never mutating the
// record). forecastResults takes values and returns values - it has no seam to the entries table, the
// mutation queue, the server, the releve, the PDF or the annex - so by construction nothing reaches them.
//
// This is the handover "nothing-written" check at the unit level. The store-level proof - driving the
// forecast through the real controller and reading Room back on the device - belongs with the on-device
// walkthrough, where a real database can be inspected.

private class RecordingRhythmRepository(private val value: WeeklyRhythm) : RhythmRepository {
    var saveCount = 0
        private set
    var clearCount = 0
        private set

    override fun observe(): Flow<WeeklyRhythm> = flowOf(value)

    override suspend fun save(rhythm: WeeklyRhythm) {
        saveCount++
    }

    override suspend fun clear() {
        clearCount++
    }
}

class ForecastR340Test : FunSpec({
    test("computing a forecast writes to no store and leaves the record unchanged (R340)") {
        val rhythmRepo =
            RecordingRhythmRepository(
                WeeklyRhythm(tuesday = RhythmKind.DOMICILE, thursday = RhythmKind.DOMICILE),
            )
        val recorded =
            listOf(
                AggregatableEntry("2026-01-05", Portion.FULL, EntryKind.HOME),
                AggregatableEntry("2026-01-06", Portion.FULL, EntryKind.CH),
            )
        val recordedBefore = recorded.toList()
        val user =
            AggregatableUser(
                canton = "GE",
                employmentRate = 100,
                denominatorKind = "SIMPLIFIED240",
                exactTotalWorkDays = null,
                granularity = "DAY",
                activityStartDate = null,
            )

        val results =
            forecastResults(
                user = user,
                recorded = recorded,
                rhythm = runBlocking { rhythmRepo.observe().first() }.toEntryKindMap(),
                today = LocalDate.parse("2026-10-09"),
                taxYear = 2026,
            )

        results.shouldNotBeNull()
        // The rhythm store is never written during a compute.
        rhythmRepo.saveCount shouldBe 0
        rhythmRepo.clearCount shouldBe 0
        // The recorded days are untouched - the projection is a new list, not an edit of the record.
        recorded shouldBe recordedBefore
    }
})
