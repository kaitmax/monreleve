package ch.monreleve.app.dossier

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContainExactly
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf

// AN-RECON (the comparison). The pure brain of "does your employer have the same figure?": the ONE gap
// function (never UI arithmetic, R340/FW12), the attestation-rate parser, the causes read from the person's
// OWN record, and the view assembly. Takes values, returns values - no store, no engine, no android.

private fun annexRow(
    dayDate: String,
    recorded: Boolean,
): AnnexRow =
    AnnexRow(
        dayDate = dayDate,
        recorded = recorded,
        portion = null,
        kind = null,
        absenceReason = null,
        note = null,
        provenance = null,
        detectedKind = null,
        firstRecordedAt = null,
        lastModifiedAt = null,
        clientClaimedAt = null,
        late = false,
    )

@Suppress("LongParameterList")
private fun document(
    taxYear: Int = 2025,
    declarableRate: Double = 39.16,
    workedDays: Double = 240.0,
    missionDays: Double = 7.0,
    creditedMissionDays: Double = 7.0,
    denominatorKind: String = "SIMPLIFIED240",
    annex: List<AnnexRow> = emptyList(),
): DossierDocument =
    DossierDocument(
        taxYear = taxYear,
        period = DossierPeriod(fraction = 1.0, startDate = null),
        titulaire = "Camille Berger",
        generatedAt = "2026-01-18",
        canton = "GE",
        employmentRate = 100,
        denominatorKind = denominatorKind,
        tiles = DossierTiles(workedDays = workedDays, swissDays = 75.0, teleworkDays = 43.0, missionDays = missionDays),
        zone =
            DossierZone(
                declarableRate = declarableRate,
                rawRate = declarableRate,
                ratesDiffer = false,
                fiscalCeilingDays = 96.0,
                remainingToFiscal = 17.0,
                remainingToSocial = 40.5,
                warnings = emptyList(),
            ),
        months = emptyList(),
        annex = annex,
        absenceDays = 3.0,
        recordedEntries = 50,
        creditedMissionDays = creditedMissionDays,
        rateWithoutMissions = declarableRate,
    )

class EmployerComparisonTest : FunSpec({
    // THE GAP FUNCTION - the design sample (sample data): 41,25 % vs 39,16 % on a 240 basis.
    test("employerGap: the design sample is 2,09 points and about 5,0 days") {
        val gap = employerGap(employerRate = 41.25, releveRate = 39.16, basisDays = 240.0)
        gap.points shouldBe 2.09
        gap.environDays shouldBe 5.0
    }

    test("employerGap: environ is rounded DOWN to the half-day, never over") {
        // 1,00 point on a 150 basis is exactly 1,5 days.
        employerGap(40.0, 39.0, 150.0).environDays shouldBe 1.5
        // 1,00 point on a 155 basis is 1,55 days -> floored down to 1,5, never rounded up to 2,0.
        employerGap(40.0, 39.0, 155.0).environDays shouldBe 1.5
    }

    test("employerGap: identical figures are zero points and zero days") {
        val gap = employerGap(39.16, 39.16, 240.0)
        gap.points shouldBe 0.0
        gap.environDays shouldBe 0.0
    }

    test("employerGap: an employer figure BELOW the releve is a positive gap (absolute)") {
        val gap = employerGap(employerRate = 38.0, releveRate = 39.16, basisDays = 240.0)
        gap.points shouldBe 1.16
        // 1,16 / 100 * 240 = 2,784 days -> floor(5,568)/2 = 2,5.
        gap.environDays shouldBe 2.5
    }

    // THE PARSER - French format, comma, optional percent and (non-breaking) spaces.
    test("parseEmployerRate: accepts the French forms and rejects the rest") {
        parseEmployerRate("41,25 %") shouldBe 41.25
        parseEmployerRate("41,25") shouldBe 41.25
        parseEmployerRate("41.25") shouldBe 41.25
        parseEmployerRate("41,25 %") shouldBe 41.25
        parseEmployerRate("  41,25 % ") shouldBe 41.25
        parseEmployerRate("").shouldBeNull()
        parseEmployerRate("abc").shouldBeNull()
        parseEmployerRate("150").shouldBeNull()
        parseEmployerRate("-5").shouldBeNull()
    }

    // THE CAUSES - facts from the record only, never a guess about the employer.
    test("comparisonCauses: missions when logged, method always, unrecorded when present, several employers always") {
        val doc =
            document(
                missionDays = 7.0,
                creditedMissionDays = 7.0,
                annex = listOf(annexRow("2025-03-03", recorded = true), annexRow("2025-03-04", recorded = false)),
            )
        val causes = comparisonCauses(doc, missionCap = 10, simplifiedBasisDays = 240)
        causes.shouldContainExactly(
            ComparisonCause.Missions(missionDays = 7.0, creditedDays = 7.0, cap = 10),
            ComparisonCause.Method(denominatorKind = "SIMPLIFIED240", simplifiedBasisDays = 240),
            ComparisonCause.UnrecordedDays(count = 1),
            ComparisonCause.SeveralEmployers,
        )
    }

    test("comparisonCauses: no missions row and no unrecorded row when there are none") {
        val doc = document(missionDays = 0.0, creditedMissionDays = 0.0, annex = listOf(annexRow("2025-03-03", true)))
        val causes = comparisonCauses(doc, missionCap = 10, simplifiedBasisDays = 240)
        causes.shouldContainExactly(
            ComparisonCause.Method(denominatorKind = "SIMPLIFIED240", simplifiedBasisDays = 240),
            ComparisonCause.SeveralEmployers,
        )
    }

    test("comparisonCauses: credited below logged is carried through (the regime-lost case)") {
        val doc = document(missionDays = 12.0, creditedMissionDays = 0.0)
        val missions = comparisonCauses(doc, missionCap = 10, simplifiedBasisDays = 240).first()
        missions.shouldBeInstanceOf<ComparisonCause.Missions>()
        missions.missionDays shouldBe 12.0
        missions.creditedDays shouldBe 0.0
    }

    // THE VIEW - the server's figure (R287) is the releve's declarableRate; the basis is tiles.workedDays.
    test("buildComparison: a completed year carries the server rate, the basis and the gap") {
        val doc = document(taxYear = 2025, declarableRate = 39.16, workedDays = 240.0)
        val view =
            buildComparison(
                document = doc,
                isCurrentYear = false,
                daysUnsynced = 0,
                missionCap = 10,
                simplifiedBasisDays = 240,
                employerRate = 41.25,
            )
        view.releveRate shouldBe 39.16
        view.basisDays shouldBe 240.0
        view.isCurrentYear shouldBe false
        view.gap.shouldBeInstanceOf<ComparisonGap>()
        view.gap?.points shouldBe 2.09
    }

    test("buildComparison: the current year carries no gap (the comparison is refused)") {
        val doc = document(taxYear = 2026)
        val view =
            buildComparison(
                document = doc,
                isCurrentYear = true,
                daysUnsynced = 0,
                missionCap = 10,
                simplifiedBasisDays = 240,
                employerRate = 41.25,
            )
        view.isCurrentYear shouldBe true
        view.gap.shouldBeNull()
    }

    test("buildComparison: no employer figure yet means no gap, but the causes still stand") {
        val doc = document(taxYear = 2025)
        val view =
            buildComparison(
                document = doc,
                isCurrentYear = false,
                daysUnsynced = 0,
                missionCap = 10,
                simplifiedBasisDays = 240,
                employerRate = null,
            )
        view.gap.shouldBeNull()
        view.causes.isNotEmpty() shouldBe true
    }

    test("buildComparison: pending days surface as daysUnsynced") {
        val view =
            buildComparison(
                document = document(taxYear = 2025),
                isCurrentYear = false,
                daysUnsynced = 3,
                missionCap = 10,
                simplifiedBasisDays = 240,
                employerRate = 41.25,
            )
        view.daysUnsynced shouldBe 3
    }
})
