package ch.monreleve.app.ui.screens.aujourdhui

import ch.monreleve.app.aujourdhui.RecordedKind
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// AN-ANSWER-ICON (R430/R251). AnswerIconInstrumentedTest proves on a DEVICE that « Domicile » closes into a
// house - the behavioural claim - but the JVM gate COMPILES the androidTest source set and does not RUN it,
// so without this the mapping has no coverage in the gate at all. R251's shape: where no suite covers a file,
// the answer is a suite rather than an exemption.
//
// IT ASSERTS THE INVARIANTS, NOT THE MAPPING (R171). A test saying kindIcon(SUISSE) == ic_building_2 is the
// production line retyped, and would pass on any mapping at all; the device test is where that claim lives,
// against literal drawables. What is checked here is what the device test cannot see in one run:
//
//   1. every kind has a glyph and no two kinds share one - a day answered « Domicile » and a day answered
//      « Mission (France) » must not look identical at a glance, which is the whole point of the icon;
//   2. every glyph a kind points at is one of the five AnswerIconDrawablesTest owns - so a kind cannot be
//      pointed at a drawable that is committed but unattributed in docs/lucide-icons.md, or at one of the
//      status glyphs, which R432 keeps separate.
//
// IOS-1b-A R604: MOVED FROM :app's unit tests to :shared commonTest with the screen, so it runs on the JVM AND on
// the iOS simulator. kindIcon now returns a Glyph (design/Glyph.kt), not an Android drawable Int, so the
// comparison is by the drawable's FILE NAME (Glyph.fileName) instead of by reflection over :app's R.drawable -
// the "five resolve to five distinct drawables" check moved to :app's GlyphDrawablesExistTest, which can read R.
// The two invariants above are unchanged; only the type they compare changed.

private val ANSWER_DRAWABLE_NAMES =
    listOf("ic_building_2", "ic_house", "ic_briefcase", "ic_plane", "ic_calendar_x")

class KindIconMappingTest {
    @Test
    fun everyRecordedKindHasItsOwnGlyph() {
        val byKind = RecordedKind.entries.associateWith { kindIcon(it) }
        assertEquals(
            RecordedKind.entries.size,
            byKind.values.toSet().size,
            "two kinds share a glyph, so two different answers would read the same: $byKind",
        )
    }

    @Test
    fun everyGlyphAKindPointsAtIsOneOfTheAttributedAnswerDrawables() {
        val allowed = ANSWER_DRAWABLE_NAMES.toSet()
        assertEquals(5, allowed.size, "positive control: the attributed set names five distinct drawables")
        val offenders = RecordedKind.entries.filter { kindIcon(it).fileName !in allowed }
        assertTrue(offenders.isEmpty(), "these kinds point at a drawable outside the attributed answer set: $offenders")
    }
}
