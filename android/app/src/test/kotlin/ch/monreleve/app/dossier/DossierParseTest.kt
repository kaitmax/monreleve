package ch.monreleve.app.dossier

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe

// AN11 increment 1. parseDossier reads GET /api/v1/dossier's wire body into a DossierDocument, and reads
// the SERVER's figures - it never recomputes them (FW12).
//
// THE FIXTURE DISAGREES WITH A NAIVE COUNT ON PURPOSE (R120). tiles.workedDays is 240 while the annex
// carries five recorded rows; the declarable rate is 42,70 while the raw rate is 43,60. A device that
// counted its own rows, or recomputed a rate, would produce different numbers - so a test whose fixture
// AGREED with a count would pass on exactly the defect this guards. Every assertion below is the server's
// value, not a value a count could reach.

private val PAYLOAD =
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
        "declarableRate": 42.70,
        "rawRate": 43.60,
        "ratesDiffer": true,
        "fiscalCeilingDays": 96,
        "remainingToFiscal": 5.5,
        "remainingToSocial": 20,
        "warnings": [
          { "code": "RULE_SET_FALLBACK", "requestedYear": 2027, "appliedYear": 2026 },
          { "code": "EXACT_METHOD_UNVERIFIED" },
          { "code": "SOCIAL_CEILING_EXCEEDED" }
        ]
      },
      "months": [
        { "month": 1, "swissDays": 13, "teleworkDays": 8, "missionDaysFrance": 0, "missionDaysThirdState": 0, "absenceDays": 0, "cumulativeDeclarableRate": 3.33 },
        { "month": 2, "swissDays": 12, "teleworkDays": 8, "missionDaysFrance": 0, "missionDaysThirdState": 0, "absenceDays": 0, "cumulativeDeclarableRate": 6.66 },
        { "month": 3, "swissDays": 15, "teleworkDays": 8, "missionDaysFrance": 0, "missionDaysThirdState": 0, "absenceDays": 0, "cumulativeDeclarableRate": 10.00 },
        { "month": 4, "swissDays": 13, "teleworkDays": 7, "missionDaysFrance": 0, "missionDaysThirdState": 0, "absenceDays": 0, "cumulativeDeclarableRate": 12.91 },
        { "month": 5, "swissDays": 14, "teleworkDays": 8, "missionDaysFrance": 0, "missionDaysThirdState": 0, "absenceDays": 0, "cumulativeDeclarableRate": 16.25 },
        { "month": 6, "swissDays": 8, "teleworkDays": 4, "missionDaysFrance": 1, "missionDaysThirdState": 2, "absenceDays": 1, "cumulativeDeclarableRate": 18.33 },
        { "month": 7, "swissDays": 0, "teleworkDays": 0, "missionDaysFrance": 0, "missionDaysThirdState": 0, "absenceDays": 0, "cumulativeDeclarableRate": 18.33 },
        { "month": 8, "swissDays": 0, "teleworkDays": 0, "missionDaysFrance": 0, "missionDaysThirdState": 0, "absenceDays": 0, "cumulativeDeclarableRate": 18.33 },
        { "month": 9, "swissDays": 0, "teleworkDays": 0, "missionDaysFrance": 0, "missionDaysThirdState": 0, "absenceDays": 0, "cumulativeDeclarableRate": 18.33 },
        { "month": 10, "swissDays": 0, "teleworkDays": 0, "missionDaysFrance": 0, "missionDaysThirdState": 0, "absenceDays": 0, "cumulativeDeclarableRate": 18.33 },
        { "month": 11, "swissDays": 0, "teleworkDays": 0, "missionDaysFrance": 0, "missionDaysThirdState": 0, "absenceDays": 0, "cumulativeDeclarableRate": 18.33 },
        { "month": 12, "swissDays": 0, "teleworkDays": 0, "missionDaysFrance": 0, "missionDaysThirdState": 0, "absenceDays": 0, "cumulativeDeclarableRate": 18.33 }
      ],
      "annex": [
        {
          "dayDate": "2026-06-15", "recorded": true, "portion": "FULL", "kind": "CH",
          "absenceReason": null, "note": null, "provenance": "MANUAL", "detectedKind": null,
          "firstRecordedAt": "2026-06-15T18:40:00.000Z", "lastModifiedAt": null,
          "clientClaimedAt": null, "late": false
        },
        {
          "dayDate": "2026-06-16", "recorded": false, "portion": null, "kind": null,
          "absenceReason": null, "note": null, "provenance": null, "detectedKind": null,
          "firstRecordedAt": null, "lastModifiedAt": null, "clientClaimedAt": null, "late": false
        },
        {
          "dayDate": "2026-06-17", "recorded": true, "portion": "FULL", "kind": "HOME",
          "absenceReason": null, "note": "teletravail", "provenance": "MANUAL", "detectedKind": null,
          "firstRecordedAt": "2026-06-25T19:12:00.000Z", "lastModifiedAt": "2026-06-26T09:00:00.000Z",
          "clientClaimedAt": null, "late": true
        },
        {
          "dayDate": "2026-06-18", "recorded": true, "portion": "AM", "kind": "MISSION_FR",
          "absenceReason": null, "note": "Deplacement Lyon", "provenance": "MANUAL", "detectedKind": null,
          "firstRecordedAt": "2026-06-18T20:22:00.000Z", "lastModifiedAt": null,
          "clientClaimedAt": "2026-06-18T20:20:00.000Z", "late": false
        },
        {
          "dayDate": "2026-06-19", "recorded": true, "portion": "FULL", "kind": "ABSENT",
          "absenceReason": "FERIE", "note": null, "provenance": "MANUAL", "detectedKind": null,
          "firstRecordedAt": "2026-06-19T09:15:00.000Z", "lastModifiedAt": null,
          "clientClaimedAt": null, "late": false
        }
      ],
      "absenceDays": 3,
      "recordedEntries": 5
    }
    """.trimIndent()

class DossierParseTest : FunSpec({
    val document = parseDossier(PAYLOAD)

    test("the header carries the server's identification, not a device's") {
        document.taxYear shouldBe 2026
        document.period.fraction shouldBe 1.0
        document.period.startDate shouldBe null
        document.titulaire shouldBe "Camille Rey"
        document.generatedAt shouldBe "2026-06-18T18:04:00.000Z"
        document.canton shouldBe "GE"
        document.employmentRate shouldBe 100
        document.denominatorKind shouldBe "SIMPLIFIED240"
    }

    test("the tiles are the server's figures - workedDays is a basis, not a row count (R120)") {
        document.tiles.workedDays shouldBe 240.0
        document.tiles.swissDays shouldBe 75.0
        document.tiles.teleworkDays shouldBe 43.0
        document.tiles.missionDays shouldBe 1.0
        // The proof the fixture disagrees with a count: 240 worked days against five recorded rows. A device
        // that counted would never reach 240 here.
        document.recordedEntries shouldBe 5
    }

    test("the zone carries both rates and both headrooms verbatim (R224, R239)") {
        document.zone.declarableRate shouldBe 42.70
        document.zone.rawRate shouldBe 43.60
        document.zone.ratesDiffer shouldBe true
        document.zone.fiscalCeilingDays shouldBe 96.0
        document.zone.remainingToFiscal shouldBe 5.5
        document.zone.remainingToSocial shouldBe 20.0
    }

    test("the warnings are parsed by code, the two informational ones distinctly (docs section 8.2)") {
        document.zone.warnings shouldHaveSize 3
        document.zone.warnings shouldContain DossierWarning.RuleSetFallback(2026)
        document.zone.warnings shouldContain DossierWarning.ExactMethodUnverified
        document.zone.warnings shouldContain DossierWarning.Other("SOCIAL_CEILING_EXCEEDED")
    }

    test("all twelve months are present, with the two mission columns kept separate") {
        document.months shouldHaveSize 12
        val june = document.months[5]
        june.month shouldBe 6
        june.missionDaysFrance shouldBe 1.0
        june.missionDaysThirdState shouldBe 2.0
        june.cumulativeDeclarableRate shouldBe 18.33
    }

    test("the annex carries recorded rows, a gap row, a late row and an absence, in wire codes") {
        document.annex shouldHaveSize 5
        document.absenceDays shouldBe 3.0

        val recorded = document.annex[0]
        recorded.recorded shouldBe true
        recorded.dayDate shouldBe "2026-06-15"
        recorded.kind shouldBe "CH"
        recorded.provenance shouldBe "MANUAL"
        recorded.firstRecordedAt shouldBe "2026-06-15T18:40:00.000Z"
        recorded.late shouldBe false

        val gap = document.annex[1]
        gap.recorded shouldBe false
        gap.portion shouldBe null
        gap.kind shouldBe null
        gap.firstRecordedAt shouldBe null

        val late = document.annex[2]
        late.late shouldBe true
        late.lastModifiedAt shouldBe "2026-06-26T09:00:00.000Z"

        val absence = document.annex[4]
        absence.kind shouldBe "ABSENT"
        absence.absenceReason shouldBe "FERIE"
    }
})
