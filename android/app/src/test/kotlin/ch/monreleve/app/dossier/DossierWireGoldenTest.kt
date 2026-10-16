package ch.monreleve.app.dossier

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

// KMP-1 increment 2 (R381). GOLDEN TESTS for the dossier wire read, captured against TODAY's org.json code
// BEFORE parseDossier moves to :shared (increment 6). parseDossier READS, it does not compute (docs/api-v1.md
// 8): every figure is taken from the payload verbatim. The move swaps org.json for kotlinx.serialization; these
// expectations - every figure, the warning polymorphism (code -> sealed DossierWarning), a null startDate, and
// "a truncated body throws rather than returning a plausible zero" - must hold UNCHANGED afterwards. The
// DossierDocument types already live in :shared (KMP-0); only the parse moves.

private val VALID_BODY =
    """
    {
      "taxYear": 2026,
      "period": { "fraction": 1.0, "startDate": null },
      "titulaire": "Camille Rey",
      "generatedAt": "2026-06-18T18:04:00.000Z",
      "canton": "GE",
      "employmentRate": 100,
      "denominatorKind": "SIMPLIFIED240",
      "tiles": { "workedDays": 240, "swissDays": 75, "teleworkDays": 43, "missionDays": 1 },
      "zone": {
        "declarableRate": 42.70, "rawRate": 43.60, "ratesDiffer": true,
        "fiscalCeilingDays": 96, "remainingToFiscal": 5.5, "remainingToSocial": 20, "warnings": []
      },
      "months": [],
      "annex": [],
      "absenceDays": 3,
      "recordedEntries": 5,
      "creditedMissionDays": 1,
      "rateWithoutMissions": 42.08
    }
    """.trimIndent()

// A fuller payload: a prorated period with a startDate, all three warning shapes, one month row, one recorded
// annex row and one unlogged (recorded:false) annex row - the shapes SPEC 12 requires printed.
private val RICH_BODY =
    """
    {
      "taxYear": 2026,
      "period": { "fraction": 0.5, "startDate": "2026-07-01" },
      "titulaire": "Dupont",
      "generatedAt": "2026-06-18T18:04:00.000Z",
      "canton": "VD",
      "employmentRate": 80,
      "denominatorKind": "EXACT",
      "tiles": { "workedDays": 120, "swissDays": 40, "teleworkDays": 20, "missionDays": 2 },
      "zone": {
        "declarableRate": 39.16, "rawRate": 39.16, "ratesDiffer": false,
        "fiscalCeilingDays": 48, "remainingToFiscal": 8, "remainingToSocial": 12,
        "warnings": [
          { "code": "RULE_SET_FALLBACK", "appliedYear": 2026 },
          { "code": "EXACT_METHOD_UNVERIFIED" },
          { "code": "SOME_FUTURE_WARNING" }
        ]
      },
      "months": [
        { "month": 7, "swissDays": 10, "teleworkDays": 5, "missionDaysFrance": 1,
          "missionDaysThirdState": 0, "absenceDays": 1, "cumulativeDeclarableRate": 33.3 }
      ],
      "annex": [
        { "dayDate": "2026-07-01", "recorded": true, "portion": "FULL", "kind": "HOME",
          "absenceReason": null, "note": "domicile", "provenance": "MANUAL", "detectedKind": null,
          "firstRecordedAt": "2026-07-01T10:00:00.000Z", "lastModifiedAt": null,
          "clientClaimedAt": null, "late": false },
        { "dayDate": "2026-07-02", "recorded": false, "portion": null, "kind": null,
          "absenceReason": null, "note": null, "provenance": null, "detectedKind": null,
          "firstRecordedAt": null, "lastModifiedAt": null, "clientClaimedAt": null, "late": false }
      ],
      "absenceDays": 1,
      "recordedEntries": 1,
      "creditedMissionDays": 2,
      "rateWithoutMissions": 35.0
    }
    """.trimIndent()

class DossierWireGoldenTest {
    @Test
    fun goldenValidBodyParsesEveryFigureVerbatim() {
        val d = parseDossier(VALID_BODY)
        assertEquals(2026, d.taxYear)
        assertEquals(1.0, d.period.fraction, 0.0)
        assertNull(d.period.startDate)
        assertEquals("Camille Rey", d.titulaire)
        assertEquals("2026-06-18T18:04:00.000Z", d.generatedAt)
        assertEquals("GE", d.canton)
        assertEquals(100, d.employmentRate)
        assertEquals("SIMPLIFIED240", d.denominatorKind)
        assertEquals(240.0, d.tiles.workedDays, 0.0)
        assertEquals(75.0, d.tiles.swissDays, 0.0)
        assertEquals(43.0, d.tiles.teleworkDays, 0.0)
        assertEquals(1.0, d.tiles.missionDays, 0.0)
        assertEquals(42.70, d.zone.declarableRate, 0.0)
        assertEquals(43.60, d.zone.rawRate, 0.0)
        assertTrue(d.zone.ratesDiffer)
        assertEquals(96.0, d.zone.fiscalCeilingDays, 0.0)
        assertEquals(5.5, d.zone.remainingToFiscal, 0.0)
        assertEquals(20.0, d.zone.remainingToSocial, 0.0)
        assertTrue(d.zone.warnings.isEmpty())
        assertTrue(d.months.isEmpty())
        assertTrue(d.annex.isEmpty())
        assertEquals(3.0, d.absenceDays, 0.0)
        assertEquals(5, d.recordedEntries)
        assertEquals(1.0, d.creditedMissionDays, 0.0)
        assertEquals(42.08, d.rateWithoutMissions, 0.0)
    }

    @Test
    fun goldenWarningPolymorphismMapsEachCodeToItsType() {
        val warnings = parseDossier(RICH_BODY).zone.warnings
        assertEquals(3, warnings.size)
        val fallback = warnings[0]
        assertTrue(fallback is DossierWarning.RuleSetFallback)
        assertEquals(2026, (fallback as DossierWarning.RuleSetFallback).appliedYear)
        assertTrue(warnings[1] is DossierWarning.ExactMethodUnverified)
        val other = warnings[2]
        assertTrue(other is DossierWarning.Other)
        assertEquals("SOME_FUTURE_WARNING", (other as DossierWarning.Other).code)
    }

    @Test
    fun goldenProratedPeriodKeepsItsStartDate() {
        val d = parseDossier(RICH_BODY)
        assertEquals(0.5, d.period.fraction, 0.0)
        assertEquals("2026-07-01", d.period.startDate)
    }

    @Test
    fun goldenMonthAndAnnexRowsParseIncludingAnUnloggedDay() {
        val d = parseDossier(RICH_BODY)
        assertEquals(1, d.months.size)
        val m = d.months[0]
        assertEquals(7, m.month)
        assertEquals(10.0, m.swissDays, 0.0)
        assertEquals(1.0, m.missionDaysFrance, 0.0)
        assertEquals(33.3, m.cumulativeDeclarableRate, 0.0)

        assertEquals(2, d.annex.size)
        val recorded = d.annex[0]
        assertTrue(recorded.recorded)
        assertEquals("2026-07-01", recorded.dayDate)
        assertEquals("FULL", recorded.portion)
        assertEquals("HOME", recorded.kind)
        assertEquals("domicile", recorded.note)
        assertEquals("2026-07-01T10:00:00.000Z", recorded.firstRecordedAt)
        assertFalse(recorded.late)

        val unlogged = d.annex[1]
        assertFalse(unlogged.recorded)
        assertEquals("2026-07-02", unlogged.dayDate)
        assertNull(unlogged.portion)
        assertNull(unlogged.kind)
        assertNull(unlogged.firstRecordedAt)
    }

    @Test
    fun goldenATruncatedBodyThrowsRatherThanReturningAPlausibleZero() {
        assertThrows(Exception::class.java) { parseDossier("{ truncated") }
    }
}
