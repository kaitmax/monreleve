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
