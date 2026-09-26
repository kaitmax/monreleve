package ch.monreleve.app.design.rail

// AN3 increment 3 (AC2). Kotlin port of web/tests/unit/ui-core/rail-geometry.test.ts,
// case for case, same expected numeric literals. THIS IS THE GEOMETRY
// COMPARISON AC2 asks for: same RailData, same thresholds, same numbers -
// fill fraction, tick positions, tick width, label anchoring - checked
// against literals ported directly from the web suite rather than
// recomputed independently, so a divergence between the two engines shows
// up as a failing assertion here rather than as a visual difference nobody
// happened to look for.

import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.design.Zone
import ch.monreleve.app.design.ZoneThresholds
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.doubles.shouldBeGreaterThan
import io.kotest.matchers.doubles.shouldBeLessThan
import io.kotest.matchers.shouldBe

private val RULES = ruleSetFor(2026)
private val RULE_THRESHOLDS = ZoneThresholds(RULES.fiscalCeiling, RULES.socialCeiling)

private fun inline(
    percentage: Double = 0.0,
    zone: Zone = Zone.COMPLIANT,
    width: Double = 376.0,
    variant: RailVariant = RailVariant.INLINE,
): RailData = RailData(percentage = percentage, zone = zone, width = width, height = TRACK_HEIGHT, variant = variant)

class RailGeometryTest : FunSpec({
    context("the constants mirror their tokens rather than inventing values") {
        test("uses the 8 px track and the 4 px protrusion SPEC 6.3 states") {
            TRACK_HEIGHT shouldBe 8.0
            TICK_PROTRUSION shouldBe 4.0
        }

        test("derives the pill radius from the height, so no radius literal exists") {
            railGeometry(inline(), RULE_THRESHOLDS).track.rx shouldBe TRACK_HEIGHT / 2
        }
    }

    context("the track and the fill") {
        test("spans the requested width at the requested height") {
            val g = railGeometry(inline(width = 376.0), RULE_THRESHOLDS)

            g.track.x shouldBe 0.0
            g.track.width shouldBe 376.0
            g.track.height shouldBe TRACK_HEIGHT
        }

        test("draws no fill at 0 percent") {
            railGeometry(inline(percentage = 0.0), RULE_THRESHOLDS).fill.width shouldBe 0.0
        }

        test("fills the whole track at 100 percent") {
            railGeometry(inline(percentage = 100.0, width = 376.0), RULE_THRESHOLDS).fill.width shouldBe 376.0
        }

        test("fills proportionally at 34.58 percent") {
            // 376 * 34.58 / 100 = 130.0208, rounded to three decimals.
            railGeometry(inline(percentage = 34.58, width = 376.0), RULE_THRESHOLDS).fill.width shouldBe 130.021
        }

        test("rounds every coordinate to three decimals, whatever the arithmetic order") {
            val g = railGeometry(inline(percentage = 49.9, width = 376.0), RULE_THRESHOLDS)

            g.fill.width shouldBe 187.624
        }
    }

    context("the two ticks come from the RuleSet (R35)") {
        test("places them at the fiscal and social ceilings") {
            val g = railGeometry(inline(width = 1000.0), RULE_THRESHOLDS)

            g.ticks[0].percentage shouldBe RULES.fiscalCeiling * 1e2
            g.ticks[1].percentage shouldBe RULES.socialCeiling * 1e2
            g.ticks[0].x shouldBe 400 - TICK_WIDTH / 2
            g.ticks[1].x shouldBe 499 - TICK_WIDTH / 2
        }

        test("moves the ticks when the rule set moves") {
            val shifted = ZoneThresholds(fiscalCeiling = 0.5, socialCeiling = 0.6)
            val g = railGeometry(inline(width = 1000.0), shifted)

            g.ticks[0].x shouldBe 500 - TICK_WIDTH / 2
            g.ticks[1].x shouldBe 600 - TICK_WIDTH / 2
        }

        test("protrudes 4 px above and below the bar") {
            val g = railGeometry(inline(), RULE_THRESHOLDS)

            g.ticks[0].y shouldBe g.track.y - TICK_PROTRUSION
            g.ticks[0].height shouldBe TRACK_HEIGHT + TICK_PROTRUSION * 2
        }
    }

    context("tick labels are anchored outward (R39)") {
        test("ends the fiscal label at its tick and starts the social label at its") {
            val g = railGeometry(inline(width = 1000.0), RULE_THRESHOLDS)

            g.ticks[0].labelAnchor shouldBe LabelAnchor.END
            g.ticks[0].labelX shouldBe 400.0
            g.ticks[1].labelAnchor shouldBe LabelAnchor.START
            g.ticks[1].labelX shouldBe 499.0
        }

        test("keeps the labels apart at the 200 px thumbnail width") {
            val g = railGeometry(inline(width = COMPACT_MIN_WIDTH), RULE_THRESHOLDS)

            g.ticks[0].labelAnchor shouldBe LabelAnchor.END
            g.ticks[1].labelAnchor shouldBe LabelAnchor.START
            g.ticks[1].labelX shouldBeGreaterThan g.ticks[0].labelX
        }
    }

    context("clamping bounds the geometry and never the label") {
        test("clamps a negative rate to an empty fill and reports it") {
            val g = railGeometry(inline(percentage = -5.0), RULE_THRESHOLDS)

            g.fill.width shouldBe 0.0
            g.clampedFill shouldBe true
            g.percentage shouldBe -5.0
        }

        test("clamps an over-100 rate to a full fill and reports it") {
            val g = railGeometry(inline(percentage = 140.0, width = 376.0), RULE_THRESHOLDS)

            g.fill.width shouldBe 376.0
            g.clampedFill shouldBe true
            g.percentage shouldBe 140.0
        }

        test("does not report clamping for a rate inside the track") {
            railGeometry(inline(percentage = 60.0), RULE_THRESHOLDS).clampedFill shouldBe false
            railGeometry(inline(percentage = 0.0), RULE_THRESHOLDS).clampedFill shouldBe false
            railGeometry(inline(percentage = 100.0), RULE_THRESHOLDS).clampedFill shouldBe false
        }
    }

    context("the variants") {
        test("inline takes its width from RailData and carries NO band names (R45)") {
            val g = railGeometry(inline(width = 500.0), RULE_THRESHOLDS)

            g.svgWidth shouldBe 500.0
            g.bandNamesShown shouldBe false
            g.bandNameRows shouldBe emptyList()
        }

        test("social keeps them, as a left-anchored stack below the rail (R45)") {
            val g = railGeometry(inline(variant = RailVariant.SOCIAL, width = 0.0), RULE_THRESHOLDS)

            g.bandNamesShown shouldBe true
            g.bandNameRows.map { it.zone } shouldBe listOf(Zone.COMPLIANT, Zone.FISCAL_EXPOSURE, Zone.SOCIAL_SWITCH)
            g.bandNameX shouldBe g.track.x
            val ys = g.bandNameRows.map { it.y }
            (ys.min() > g.ticks[0].labelY) shouldBe true
            (ys[1] - ys[0]) shouldBe (ys[2] - ys[1])
        }

        test("compact drops the band names and enforces a 200 px minimum") {
            val narrow = railGeometry(inline(variant = RailVariant.COMPACT, width = 120.0), RULE_THRESHOLDS)

            narrow.svgWidth shouldBe COMPACT_MIN_WIDTH
            narrow.clampedWidth shouldBe true
            narrow.bandNamesShown shouldBe false
        }

        test("compact leaves a wide enough request alone") {
            val wide = railGeometry(inline(variant = RailVariant.COMPACT, width = 400.0), RULE_THRESHOLDS)

            wide.svgWidth shouldBe 400.0
            wide.clampedWidth shouldBe false
        }

        test("social is 1200 x 630 with the rail at 80 percent of the width, centred (R48)") {
            val g = railGeometry(inline(variant = RailVariant.SOCIAL, width = 0.0), RULE_THRESHOLDS)

            g.svgWidth shouldBe SOCIAL_WIDTH
            g.svgHeight shouldBe SOCIAL_HEIGHT
            g.track.width shouldBe SOCIAL_WIDTH * 0.8
            g.track.x shouldBe (SOCIAL_WIDTH - SOCIAL_WIDTH * 0.8) / 2
            g.bandNamesShown shouldBe true
        }

        test("doubles the social track height, and only there (R48)") {
            val social = railGeometry(inline(variant = RailVariant.SOCIAL, width = 0.0), RULE_THRESHOLDS)

            social.track.height shouldBe SOCIAL_TRACK_HEIGHT
            social.track.rx shouldBe SOCIAL_TRACK_HEIGHT / 2
            railGeometry(inline(), RULE_THRESHOLDS).track.height shouldBe TRACK_HEIGHT
            railGeometry(inline(variant = RailVariant.COMPACT, width = 300.0), RULE_THRESHOLDS).track.height shouldBe
                TRACK_HEIGHT
        }

        test("divides the social track into three band segments (R48)") {
            val g = railGeometry(inline(variant = RailVariant.SOCIAL, width = 0.0), RULE_THRESHOLDS)

            g.bandSegments.map { it.zone } shouldBe listOf(Zone.COMPLIANT, Zone.FISCAL_EXPOSURE, Zone.SOCIAL_SWITCH)
            val total = g.bandSegments.sumOf { it.width }
            (Math.abs(total - g.track.width) < 0.001) shouldBe true
            g.bandSegments[0].x shouldBe g.track.x
            for (i in 1 until g.bandSegments.size) {
                val previous = g.bandSegments[i - 1]
                (Math.abs(g.bandSegments[i].x - (previous.x + previous.width)) < 0.001) shouldBe true
            }
        }

        test("derives the segments from the RuleSet, not from constants (R48)") {
            val shifted =
                railGeometry(
                    inline(variant = RailVariant.SOCIAL, width = 0.0),
                    ZoneThresholds(fiscalCeiling = 0.5, socialCeiling = 0.6),
                )

            (Math.abs(shifted.bandSegments[0].width - shifted.track.width * 0.5) < 0.001) shouldBe true
            (Math.abs(shifted.bandSegments[1].width - shifted.track.width * 0.1) < 0.001) shouldBe true
        }

        test("gives no band segments to inline or compact") {
            railGeometry(inline(), RULE_THRESHOLDS).bandSegments shouldBe emptyList()
            railGeometry(inline(variant = RailVariant.COMPACT, width = 300.0), RULE_THRESHOLDS).bandSegments shouldBe
                emptyList()
        }

        test("derives a total height that leaves room for ticks and labels") {
            val g = railGeometry(inline(), RULE_THRESHOLDS)

            g.svgHeight shouldBeGreaterThan (TRACK_HEIGHT + TICK_PROTRUSION * 2)
            g.ticks[0].labelY shouldBeLessThan g.svgHeight
        }

        test("makes inline and compact the same SHAPE after R45") {
            val a = railGeometry(inline(width = 400.0), RULE_THRESHOLDS)
            val b = railGeometry(inline(variant = RailVariant.COMPACT, width = 400.0), RULE_THRESHOLDS)

            b.svgHeight shouldBe a.svgHeight
            b.track shouldBe a.track
        }
    }

    context("a non-finite rate is refused here too (R33)") {
        test("throws rather than computing a NaN coordinate") {
            runCatching { railGeometry(inline(percentage = Double.NaN), RULE_THRESHOLDS) }.isFailure shouldBe true
            runCatching {
                railGeometry(inline(percentage = Double.POSITIVE_INFINITY), RULE_THRESHOLDS)
            }.isFailure shouldBe true
        }

        test("refuses a width that cannot produce a track") {
            runCatching { railGeometry(inline(width = Double.NaN), RULE_THRESHOLDS) }.isFailure shouldBe true
            runCatching { railGeometry(inline(width = 0.0), RULE_THRESHOLDS) }.isFailure shouldBe true
            runCatching { railGeometry(inline(width = -10.0), RULE_THRESHOLDS) }.isFailure shouldBe true
        }
    }
})
