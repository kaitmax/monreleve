package ch.monreleve.app.dossier

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.datetime.LocalDate
import java.time.DayOfWeek

// AN-SIM (R340). A PROJECTION IS NEVER A RECORD - the unit witness for the simulator.
//
// Computing a simulation reads the recorded days, the rhythm and the settings and runs them through the
// engine; it must write NOTHING - not the record it was handed, which comes back unchanged. simulationResults
// takes values and returns values: it has no seam to the entries table, the mutation queue, the server, the
// releve, the PDF or the annex - so by construction nothing reaches them. This is the chain's handover
// "nothing-written" check at the unit level; the store-level proof (driving the real controller and reading
// Room back on the device) belongs with the on-device walkthrough.

private val USER = AggregatableUser("GE", 100, "SIMPLIFIED240", null, "DAY", null)
private val RHYTHM = mapOf(DayOfWeek.TUESDAY to EntryKind.HOME, DayOfWeek.THURSDAY to EntryKind.HOME)

class SimulationR340Test : FunSpec({
    test("computing a simulation leaves the recorded list unchanged and writes to no store (R340)") {
        val recorded =
            listOf(
                AggregatableEntry("2026-01-05", Portion.FULL, EntryKind.HOME),
                AggregatableEntry("2026-01-06", Portion.FULL, EntryKind.CH),
            )
        val recordedBefore = recorded.toList()

        // Every scenario is run; each builds "recorded + imagined changes" as a NEW list, never an edit of the
        // record, so the record handed in is the record handed back.
        val changes =
            listOf(
                SimChange.ExtraWeekday(DayOfWeek.FRIDAY),
                SimChange.ExtraMonthDays(4),
                SimChange.Rate(80),
                SimChange.Missions(3, 2),
            )
        for (change in changes) {
            val results = simulationResults(USER, recorded, RHYTHM, change, LocalDate.parse("2026-10-09"), 2026)
            results.shouldNotBeNull()
            recorded shouldBe recordedBefore
        }
    }
})
