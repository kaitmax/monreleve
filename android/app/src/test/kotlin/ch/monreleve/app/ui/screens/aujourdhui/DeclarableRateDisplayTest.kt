package ch.monreleve.app.ui.screens.aujourdhui

import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.DenominatorMethod
import ch.monreleve.app.calc.Granularity
import ch.monreleve.app.calc.TeleworkInput
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.calc.declarableRateFor
import ch.monreleve.app.calc.fixtureFile
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.design.ZoneThresholds
import ch.monreleve.app.design.rail.RailData
import ch.monreleve.app.design.rail.RailVariant
import ch.monreleve.app.design.rail.railGeometry
import ch.monreleve.app.design.zoneFor
import ch.monreleve.app.dossier.parseDossier
import ch.monreleve.app.fr.rail.railAriaLabel
import ch.monreleve.app.fr.text.formatDeclarableRate
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import org.json.JSONObject
import java.math.BigDecimal
import java.math.RoundingMode

// AN-CALENDAR (R479), AN-GRANULARITY (R495). ONE RATE, ONE STRING - and no Float on its way to the screen.
//
// The screen-level proof on the device is RateOneStringInstrumentedTest (one record through both controllers onto both
// screens). These pin the pieces on the JVM, where the gate runs them: the one formatting every screen uses, the hazard
// a Float copy is, the animation that moves a PROGRESS and never the rate (R495), and - from the SHARED Geneva
// fixtures, the file both engines are gated on (R163/R181) - the strings the screens show for the published cases.

private const val NBSP = ' '

private fun engine(days: Int): Double = declarableRateFor(days.toDouble(), 240)

/** One case of fixtures/geneva-cases.json: its id, the engine's input, and the PUBLISHED declarable rate as written. */
private data class GenevaCase(val id: String, val input: TeleworkInput, val published: String)

private fun genevaCases(): List<GenevaCase> {
    val root = JSONObject(fixtureFile("geneva-cases.json").readText())
    val common = root.getJSONObject("commonInput")
    check(common.getJSONObject("denominator").getString("kind") == "simplified240") { "the fixture left 240" }
    check(common.getString("granularity") == "day") { "the fixture left whole days" }
    val cases = root.getJSONArray("cases")
    return (0 until cases.length()).map { i ->
        val case = cases.getJSONObject(i)
        val input = case.getJSONObject("input")
        GenevaCase(
            id = case.getString("id"),
            input =
                TeleworkInput(
                    taxYear = common.getInt("taxYear"),
                    canton = Canton.valueOf(common.getString("canton")),
                    employmentRate = common.getInt("employmentRate"),
                    periodFraction = common.getDouble("periodFraction"),
                    denominator = DenominatorMethod.Simplified240,
                    granularity = Granularity.DAY,
                    teleworkDays = input.getDouble("teleworkDays"),
                    missionDaysFrance = input.getDouble("missionDaysFrance"),
                    missionDaysThirdState = input.getDouble("missionDaysThirdState"),
                ),
            // As the fixture writes it, read as TEXT - so no binary Double stands in for the published figure.
            published = case.getJSONObject("expected").get("declarableRate").toString(),
        )
    }
}

private fun engineRate(case: GenevaCase): Double = (calculateTelework(case.input) as CalcResult.Ok).value.declarableRate

/** The published figure in the screens' own form, written independently: two decimals cut, a comma, U+00A0, "%". */
private fun asTheScreensWriteIt(published: String): String =
    BigDecimal(published).setScale(2, RoundingMode.DOWN).toPlainString().replace('.', ',') + NBSP + "%"

/** The Releve's rate: [figure] as the server's JSON carries it, through the parser that reads GET /api/v1/dossier. */
private fun releveRateFrom(figure: String): Double =
    parseDossier(
        """
        {"taxYear": 2026, "period": {"fraction": 1, "startDate": null}, "titulaire": "T", "generatedAt": "x",
         "canton": "GE", "employmentRate": 100, "denominatorKind": "SIMPLIFIED240",
         "tiles": {"workedDays": 240, "swissDays": 0, "teleworkDays": 0, "missionDays": 0},
         "zone": {"declarableRate": $figure, "rawRate": $figure, "ratesDiffer": false, "fiscalCeilingDays": 96,
                  "remainingToFiscal": 0, "remainingToSocial": 0, "warnings": []},
         "months": [], "annex": [], "absenceDays": 0, "recordedEntries": 0, "creditedMissionDays": 0,
         "rateWithoutMissions": $figure}
        """.trimIndent(),
    ).zone.declarableRate

class DeclarableRateDisplayTest : FunSpec({
    test("R479 the one formatting states the engine's figure: 1/240 and 2/240") {
        formatDeclarableRate(engine(1)) shouldBe "0,41$NBSP%"
        formatDeclarableRate(engine(2)) shouldBe "0,83$NBSP%"
    }

    test("R479 a Float copy of the same figure states a hundredth less - the hazard R495 keeps off the path") {
        // KMP-4's fingerprints exactly: Aujourd'hui read these where the forecast read the line above.
        formatDeclarableRate(engine(1).toFloat().toDouble()) shouldBe "0,40$NBSP%"
        formatDeclarableRate(engine(2).toFloat().toDouble()) shouldBe "0,82$NBSP%"
        // Geneva's case c, from the fixture: the published 39,16 % is 39,15 % through a Float.
        formatDeclarableRate(engineRate(genevaCases().first { it.id == "c" }).toFloat().toDouble()) shouldBe
            "39,15$NBSP%"
    }

    test("R495 at rest Aujourd'hui's figure IS the engine's Double - the animation moved a progress, not the rate") {
        for (days in listOf(1, 2, 94)) {
            val figure = engine(days)
            rateBetween(engine(days + 7), figure, 1f) shouldBe figure
            formatDeclarableRate(rateBetween(engine(days + 7), figure, 1f)) shouldBe formatDeclarableRate(figure)
        }
    }

    test("R495 between two figures a frame shows a Double between them, from the two Doubles") {
        rateBetween(0.0, engine(2), 0.5f) shouldBe engine(2) * 0.5
        rateBetween(engine(2), engine(1), 0f) shouldBe engine(2)
    }

    test("R495 the Geneva cases, from the shared fixtures, read the same on every screen that states the rate") {
        val cases = genevaCases()
        cases.size shouldBe 6 // positive control: the fixture was read - all six published cases
        for (case in cases) {
            val figure = engineRate(case)
            val expected = asTheScreensWriteIt(case.published)
            val rules = ruleSetFor(case.input.taxYear)
            val thresholds = ZoneThresholds(rules.fiscalCeiling, rules.socialCeiling)

            // Aujourd'hui's figure at rest (RateDisplay), and the forecast's, the simulator's, Parametres' and the
            // comparison's: each hands formatDeclarableRate the Double it holds (RateFloatFenceTest keeps it one).
            formatDeclarableRate(rateBetween(0.0, figure, 1f)) shouldBe expected
            // The rail: its drawn label and its spoken name come from the geometry's percentage.
            val zone = zoneFor(figure, thresholds)
            val rail = railGeometry(RailData(figure, zone, 320.0, 72.0, RailVariant.INLINE), thresholds)
            formatDeclarableRate(rail.percentage) shouldBe expected
            railAriaLabel(formatDeclarableRate(rail.percentage), zone.wireKey) shouldContain expected
            // The Releve: the server's figure, as the fixture publishes it, through the dossier parser.
            formatDeclarableRate(releveRateFrom(case.published)) shouldBe expected
        }
        // The two the ruling names, exactly as the published worked examples print them.
        formatDeclarableRate(engineRate(cases.first { it.id == "c" })) shouldBe "39,16$NBSP%"
        formatDeclarableRate(engineRate(cases.first { it.id == "special" })) shouldBe "4,16$NBSP%"
    }
})
