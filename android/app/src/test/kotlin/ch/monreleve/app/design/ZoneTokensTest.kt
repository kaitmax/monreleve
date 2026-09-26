package ch.monreleve.app.design

// AN3 increment 2. STATUS_PRESENTATION is the join of STATUS_VISUAL (this
// package) and STATUS_COPY (fr/Statuses.kt) by wireKey. The TS reference
// gets a compile-time guarantee that every Status has both halves,
// because Record<Status, ...> makes a missing key a type error; this port
// cannot have that (Zones.kt's header explains why: fr/ carries no
// runtime imports, so STATUS_COPY is keyed by String, not by the enum).
// This file is the runtime equivalent - it fails LOUDLY, on this test
// alone, if a Status is ever added to one half and not the other, rather
// than at whatever later point a badge happens to render it.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

class ZoneTokensTest : FunSpec({
    test("every Status has a STATUS_VISUAL entry") {
        STATUS_VISUAL.keys shouldBe Status.entries.toSet()
    }

    test("every Status has a STATUS_PRESENTATION entry, joined without throwing") {
        STATUS_PRESENTATION.keys shouldBe Status.entries.toSet()
    }

    test("every presentation carries a non-blank label and explanation") {
        for (presentation in STATUS_PRESENTATION.values) {
            (presentation.label.isNotBlank()) shouldBe true
            (presentation.explanation.isNotBlank()) shouldBe true
            presentation.icon shouldNotBe null
        }
    }

    test("regime-lost and social-switch share the error colour but not the icon (SPEC 12)") {
        val regimeLost = STATUS_PRESENTATION.getValue(Status.REGIME_LOST)
        val socialSwitch = STATUS_PRESENTATION.getValue(Status.SOCIAL_SWITCH)

        regimeLost.colour shouldBe socialSwitch.colour
        (regimeLost.icon == socialSwitch.icon) shouldBe false
    }

    test("mission-exposure sits on a warning colour, distinct from compliant's success colour") {
        val compliant = STATUS_PRESENTATION.getValue(Status.COMPLIANT)
        val missionExposure = STATUS_PRESENTATION.getValue(Status.MISSION_EXPOSURE)

        (compliant.colour == missionExposure.colour) shouldBe false
    }

    test("every Zone has a ZONE_BAND_COLOUR entry") {
        ZONE_BAND_COLOUR.keys shouldBe Zone.entries.toSet()
    }

    test("the three band colours are success, warning, error in that order (SPEC 6.2)") {
        ZONE_BAND_COLOUR.getValue(Zone.COMPLIANT) shouldBe LightColors.success
        ZONE_BAND_COLOUR.getValue(Zone.FISCAL_EXPOSURE) shouldBe LightColors.warning
        ZONE_BAND_COLOUR.getValue(Zone.SOCIAL_SWITCH) shouldBe LightColors.error
    }
})
