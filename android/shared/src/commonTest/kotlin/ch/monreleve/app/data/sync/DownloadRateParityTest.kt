package ch.monreleve.app.data.sync

import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.DenominatorMethod
import ch.monreleve.app.calc.Granularity
import ch.monreleve.app.calc.TeleworkInput
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.data.local.toAggregatable
import ch.monreleve.app.dossier.AggregatableUser
import ch.monreleve.app.dossier.toTeleworkInput
import ch.monreleve.app.shared.fixtures.FixtureJson
import ch.monreleve.app.shared.fixtures.Json
import ch.monreleve.app.shared.fixtures.arr
import ch.monreleve.app.shared.fixtures.asObj
import ch.monreleve.app.shared.fixtures.double
import ch.monreleve.app.shared.fixtures.int
import ch.monreleve.app.shared.fixtures.obj
import ch.monreleve.app.shared.fixtures.parseJson
import ch.monreleve.app.shared.fixtures.str
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

// AN-PULL (R488). THE SAME NUMBER EVERYWHERE, AFTER A DOWNLOAD.
//
// The Releve's rate is the SERVER's: buildDossier runs web/lib/dossier/aggregate.ts over the person's rows, then the
// TypeScript engine. Aujourd'hui's rate is the PHONE's: AujourdhuiController.computeYear runs toTeleworkInput over the
// LOCAL rows of the year, then the Kotlin engine. R281 binds the two aggregations to one file -
// fixtures/aggregation-cases.json, whose `expected` is the TeleworkInput BOTH sides must produce - and the Geneva and
// rate fixtures bind the two engines. So the rates agree after a download exactly when the downloaded rows aggregate
// to the fixture's expected input. That is asserted here, for every case in the file the TypeScript suite reads:
// the case's rows go out as a GET body, come down through the real download into the in-memory store, and are then
// aggregated the way Aujourd'hui aggregates them - from the store, not from the payload.

private fun granularityOf(tag: String): Granularity =
    when (tag) {
        "day" -> Granularity.DAY
        "halfDay" -> Granularity.HALF_DAY
        "hours" -> Granularity.HOURS
        else -> error("unknown granularity tag in fixture: $tag")
    }

private fun denominatorOf(json: Json.Obj): DenominatorMethod =
    when (val kind = json.str("kind")) {
        "simplified240" -> DenominatorMethod.Simplified240
        "exact" -> DenominatorMethod.Exact(json.int("totalWorkDays"))
        else -> error("unknown denominator kind in fixture: $kind")
    }

private fun Json.Obj.nullableStr(key: String): String? = (entries[key] as? Json.Str)?.value

private fun Json.Obj.nullableInt(key: String): Int? = (entries[key] as? Json.Num)?.value?.toInt()

private fun expectedInputOf(json: Json.Obj): TeleworkInput =
    TeleworkInput(
        taxYear = json.int("taxYear"),
        canton = Canton.valueOf(json.str("canton")),
        employmentRate = json.int("employmentRate"),
        periodFraction = json.double("periodFraction"),
        denominator = denominatorOf(json.obj("denominator")),
        granularity = granularityOf(json.str("granularity")),
        teleworkDays = json.double("teleworkDays"),
        missionDaysFrance = json.double("missionDaysFrance"),
        missionDaysThirdState = json.double("missionDaysThirdState"),
    )

private fun userOf(json: Json.Obj): AggregatableUser =
    AggregatableUser(
        canton = json.nullableStr("canton"),
        employmentRate = json.int("employmentRate"),
        denominatorKind = json.str("denominatorKind"),
        exactTotalWorkDays = json.nullableInt("exactTotalWorkDays"),
        granularity = json.str("granularity"),
        activityStartDate = json.nullableStr("activityStartDate"),
    )

private fun declarableRateOf(input: TeleworkInput): Double =
    (calculateTelework(input) as? CalcResult.Ok)?.value?.declarableRate ?: error("the engine refused $input")

class DownloadRateParityTest {
    @Test
    fun aujourdhuisRateFromTheDownloadedRowsIsTheReleveRateForEveryAggregationCase() =
        runTest {
            val cases = parseJson(FixtureJson.AGGREGATION_CASES_JSON).asObj().arr("cases").items.map { it.asObj() }
            // Positive control: the fixture was read, and it is the file the TypeScript suite reads.
            assertTrue(cases.size >= 5, "aggregation-cases.json yielded ${cases.size} cases")

            for (case in cases) {
                val id = case.str("id")
                val year = case.int("taxYear")
                val rows =
                    case.arr("entries").items.mapIndexed { index, item ->
                        val entry = item.asObj()
                        serverRow(
                            id = "$id-$index",
                            mutation = "$id-m-$index",
                            day = entry.str("dayDate"),
                            portion = entry.str("portion"),
                            kind = entry.str("kind"),
                            absenceReason = entry.nullableStr("absenceReason"),
                            provenance = entry.str("provenance"),
                        )
                    }
                val rig = DownloadRig(respond = DownloadRig.serving(mapOf(year to rows)))

                val outcome = rig.download.download(year)
                assertIs<YearDownload.Applied>(outcome, "case $id: $outcome")
                assertEquals(rows.size, outcome.inserted, "case $id: every row arrived")

                // Aujourd'hui's computation, verbatim in shape: the account's rows of the year, from the STORE.
                val local = rig.dao.rows.values.filter { it.accountTag == ACCOUNT_A && it.dayDate.startsWith("$year-") }
                val onThePhone = toTeleworkInput(userOf(case.obj("user")), local.map { it.toAggregatable() }, year)
                val releve = expectedInputOf(case.obj("expected"))

                assertEquals(releve, onThePhone, "case $id: the downloaded rows aggregate as the server's do")
                assertEquals(declarableRateOf(releve), declarableRateOf(onThePhone), "case $id: one rate")
            }
        }
}
