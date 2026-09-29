package ch.monreleve.app.design

// AN3 increment 4. Logic-level tests for the six new components' pure
// helper functions - the part a screenshot cannot check directly.

import ch.monreleve.app.fr.DayCellCopy
import ch.monreleve.app.fr.LegendCopy
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

class ComponentLogicTest : FunSpec({
    context("ConfidenceTier") {
        test("each tier's segment count matches its ordinal position") {
            ConfidenceTier.LOW.filledSegments shouldBe 1
            ConfidenceTier.MEDIUM.filledSegments shouldBe 2
            ConfidenceTier.HIGH.filledSegments shouldBe 3
        }

        test("every tier has a distinct word, never a percentage") {
            val words = ConfidenceTier.entries.map { it.word }

            words.toSet().size shouldBe 3
            words.none { it.contains('%') } shouldBe true
        }
    }

    context("DayKind") {
        test("all four SPEC 847 letters are present, one each") {
            val letters = DayKind.entries.map { it.letter }

            letters shouldBe listOf("S", "D", "M", "A")
        }

        test("each kind resolves a colour from the shared Colours bundle") {
            val colours =
                Colours(
                    switzerland = LightColors.switzerlandMain,
                    france = LightColors.franceMain,
                    neutral = LightColors.textSecondary,
                    tertiary = LightColors.textTertiary,
                )

            DayKind.SUISSE.dotColour(colours) shouldBe LightColors.switzerlandMain
            DayKind.DOMICILE.dotColour(colours) shouldBe LightColors.franceMain
        }
    }

    context("DayCellCopy - the TalkBack announcement (SPEC 966)") {
        test("names kind, quality and correction together") {
            val description = DayCellCopy.contentDescription(14, "M", "LATE", corrected = true)

            description.contains("14") shouldBe true
            description.contains("Mission") shouldBe true
            description.contains("retard") shouldBe true
            description.contains("corrigé") shouldBe true
        }

        test("names 'Non renseigné' when the kind is null - never silent") {
            DayCellCopy.contentDescription(3, null, "NONE", corrected = false).contains("Non renseigné") shouldBe true
        }

        test("omits the correction clause when not corrected") {
            DayCellCopy.contentDescription(1, "S", "ON_TIME", corrected = false).contains("corrigé") shouldBe false
        }

        // R292 / PARKAN-22: a split half-day (Suisse morning, Domicile afternoon) must read as split -
        // TalkBack names BOTH halves. A cell announced as Suisse alone would say less than the record.
        test("a split half-day names both halves - matin and apres-midi (R292)") {
            val description =
                DayCellCopy.contentDescription(
                    dayOfMonth = 5,
                    kindLetter = "S",
                    qualityName = "ON_TIME",
                    corrected = false,
                    secondKindLetter = "D",
                )

            description.contains("matin Suisse") shouldBe true
            description.contains("après-midi Domicile") shouldBe true
            // The morning kind must not stand alone as the day's only kind (the AN10 misstatement).
            description.contains("Jour 5, Suisse,") shouldBe false
        }

        // SPEC 966: "colour and shape convey nothing on their own." The
        // quality bar IS colour-only on screen (one shape, four colours) -
        // this is what keeps that true anyway: every RecordQuality has its
        // own French phrase in the announcement, so a screen-reader user
        // gets the same distinction a sighted user gets from the bar's tint.
        test("every RecordQuality has a distinct, named phrase - never a bare fallback to its enum name") {
            val phrases =
                RecordQuality.entries.map {
                    DayCellCopy.contentDescription(1, "S", it.name, corrected = false)
                }

            phrases.toSet().size shouldBe RecordQuality.entries.size
            RecordQuality.entries.forEach { quality -> phrases.none { it.contains(quality.name) } shouldBe true }
        }
    }

    context("LegendCopy") {
        test("resolves every real DayKind letter without throwing") {
            for (kind in DayKind.entries) {
                LegendCopy.forKind(kind.letter)
            }
        }

        test("refuses an unknown letter loudly rather than returning something plausible") {
            runCatching { LegendCopy.forKind("Z") }.isFailure shouldBe true
        }
    }

    context("increment 4's own use of STATUS_PRESENTATION - zoneFor/statusFor themselves are covered in ZonesTest.kt") {
        test("STATUS_PRESENTATION covers every Status the badge can render") {
            Status.entries.forEach { status -> STATUS_PRESENTATION.getValue(status) }
        }
    }
})
