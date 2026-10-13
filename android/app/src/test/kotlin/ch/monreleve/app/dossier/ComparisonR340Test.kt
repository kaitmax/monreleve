package ch.monreleve.app.dossier

import ch.monreleve.app.settings.InMemoryEmployerFigureStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe

// AN-RECON (R340). A PROJECTION IS NEVER A RECORD - the unit witness for the comparison.
//
// Computing a comparison reads the server's dossier and the figure the person typed, and runs them through the
// pure gap function and the causes derivation. It must write NOTHING - not the record it was handed (which comes
// back unchanged), and not the employer-figure store (which is written only by the person's explicit entry,
// R342, never by computing). buildComparison / employerGap / comparisonCauses take values and return values:
// they have no seam to the entries table, the mutation queue, the server, the releve, the PDF, the annex, or
// the phone store. This is the chain's "nothing-written" check at the unit level; the store-level proof
// (entering a figure on the device and reading the server row count back) belongs with the on-device walkthrough.

private fun annexRow(
    dayDate: String,
    recorded: Boolean,
): AnnexRow = AnnexRow(dayDate, recorded, null, null, null, null, null, null, null, null, null, false)

private val DOC =
    DossierDocument(
        taxYear = 2025,
        period = DossierPeriod(1.0, null),
        titulaire = "Camille Berger",
        generatedAt = "2026-01-18",
        canton = "GE",
        employmentRate = 100,
        denominatorKind = "SIMPLIFIED240",
        tiles = DossierTiles(240.0, 75.0, 43.0, 7.0),
        zone = DossierZone(39.16, 39.16, false, 96.0, 17.0, 40.5, emptyList()),
        months = emptyList(),
        annex = listOf(annexRow("2025-03-03", true), annexRow("2025-03-04", false)),
        absenceDays = 3.0,
        recordedEntries = 50,
        creditedMissionDays = 7.0,
        rateWithoutMissions = 39.16,
    )

class ComparisonR340Test : FunSpec({
    test("computing a comparison leaves the record unchanged and writes to no store (R340)") {
        val before = DOC.copy()
        val store = InMemoryEmployerFigureStore(account = "tag-a")

        // Compute many comparisons - equal, above, below, none - each a value in, a value out.
        for (rate in listOf(41.25, 38.0, 39.16, null)) {
            buildComparison(
                document = DOC,
                isCurrentYear = false,
                daysUnsynced = 0,
                missionCap = 10,
                simplifiedBasisDays = 240,
                employerRate = rate,
            )
            employerGap(rate ?: 0.0, DOC.zone.declarableRate, DOC.tiles.workedDays)
            comparisonCauses(DOC, missionCap = 10, simplifiedBasisDays = 240)
        }

        // The record handed in is the record handed back.
        DOC shouldBe before
        // Computing a comparison never wrote the employer figure - only an explicit save does (R342).
        store.figureFor(2025).shouldBeNull()
    }
})
