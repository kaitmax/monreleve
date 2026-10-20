package ch.monreleve.app.ui.screens.aujourdhui

import ch.monreleve.app.R
import ch.monreleve.app.aujourdhui.RecordedKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

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
// THE EXPECTED SET IS BUILT FROM THE DRAWABLE NAMES, by reflection over R.drawable, rather than from
// kindIcon itself - so the two descriptions have to agree (R206) instead of one echoing the other.

private val ANSWER_DRAWABLE_NAMES =
    listOf("ic_building_2", "ic_house", "ic_briefcase", "ic_plane", "ic_calendar_x")

private fun drawableIdNamed(name: String): Int = R.drawable::class.java.getDeclaredField(name).getInt(null)

class KindIconMappingTest {
    @Test
    fun theFiveAnswerDrawablesResolve() {
        // Positive control: reflection found real, distinct resource ids. A lookup that silently produced 0
        // for everything would make both assertions below vacuously true.
        val ids = ANSWER_DRAWABLE_NAMES.map { drawableIdNamed(it) }
        assertTrue("a drawable id resolved to 0 - R.drawable was not generated as expected", ids.none { it == 0 })
        assertEquals("the five answer drawables must be five distinct resources", 5, ids.toSet().size)
    }

    @Test
    fun everyRecordedKindHasItsOwnGlyph() {
        val byKind = RecordedKind.entries.associateWith { kindIcon(it) }
        assertEquals(
            "two kinds share a glyph, so two different answers would read the same: $byKind",
            RecordedKind.entries.size,
            byKind.values.toSet().size,
        )
    }

    @Test
    fun everyGlyphAKindPointsAtIsOneOfTheAttributedAnswerDrawables() {
        val allowed = ANSWER_DRAWABLE_NAMES.map { drawableIdNamed(it) }.toSet()
        val offenders = RecordedKind.entries.filter { kindIcon(it) !in allowed }
        assertTrue(
            "these kinds point at a drawable outside the attributed answer set: $offenders",
            offenders.isEmpty(),
        )
    }
}
