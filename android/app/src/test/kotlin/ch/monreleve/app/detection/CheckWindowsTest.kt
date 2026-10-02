package ch.monreleve.app.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Clock
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

/**
 * R320. The four daily check windows, Europe/Paris: around 09:30 / 11:00 / 14:30 / 16:30, each +/- 30
 * minutes. A time between windows - including lunch - belongs to no window, so a wake there samples
 * nothing (a check that cannot run inside its window is MISSED, never taken late).
 */
class CheckWindowsTest {
    private val paris = ZoneId.of("Europe/Paris")

    private fun clockAt(
        hour: Int,
        minute: Int,
    ): Clock {
        val instant =
            LocalDate.of(2026, 10, 15)
                .atTime(LocalTime.of(hour, minute))
                .atZone(paris)
                .toInstant()
        return Clock.fixed(instant, paris)
    }

    @Test
    fun thereAreFourWindowsAtTheStatedParisTimes() {
        assertEquals(
            listOf(9 * 60 + 30, 11 * 60, 14 * 60 + 30, 16 * 60 + 30),
            CHECK_WINDOWS.map { it.centreMinuteOfDay },
        )
        assertEquals(listOf(1, 2, 3, 4), CHECK_WINDOWS.map { it.index })
    }

    @Test
    fun aWindowIsSixtyMinutesWide() {
        assertEquals(30, CHECK_WINDOW_RADIUS_MINUTES)
        val first = CHECK_WINDOWS.first()
        assertEquals(9 * 60, first.startMinuteOfDay)
        assertEquals(10 * 60, first.endMinuteOfDay)
    }

    @Test
    fun currentWindowInsideEachWindow() {
        assertEquals(1, currentCheckWindow(clockAt(9, 30))?.index)
        assertEquals(1, currentCheckWindow(clockAt(9, 5))?.index)
        assertEquals(2, currentCheckWindow(clockAt(11, 20))?.index)
        assertEquals(3, currentCheckWindow(clockAt(14, 55))?.index)
        assertEquals(4, currentCheckWindow(clockAt(16, 10))?.index)
    }

    @Test
    fun noWindowBetweenWindowsAndAtLunch() {
        assertNull(currentCheckWindow(clockAt(8, 0))) // before the first window
        assertNull(currentCheckWindow(clockAt(10, 15))) // between windows 1 and 2
        assertNull(currentCheckWindow(clockAt(12, 30))) // lunch - the thing the windows avoid
        assertNull(currentCheckWindow(clockAt(13, 30))) // still lunch
        assertNull(currentCheckWindow(clockAt(15, 30))) // between windows 3 and 4
        assertNull(currentCheckWindow(clockAt(18, 0))) // after the last window
    }

    @Test
    fun afterLastWindowIsTrueOnlyPastSeventeenHundred() {
        assertFalse(afterLastCheckWindow(clockAt(16, 59)))
        assertTrue(afterLastCheckWindow(clockAt(17, 0)))
        assertTrue(afterLastCheckWindow(clockAt(20, 0)))
    }

    @Test
    fun checkWindowAtMapsAnInstantToItsWindowAndNullOutsideAny() {
        val inWindowTwo = LocalDate.of(2026, 10, 15).atTime(11, 0).atZone(paris).toInstant().toEpochMilli()
        assertEquals(2, checkWindowAt(inWindowTwo)?.index)
        val atLunch = LocalDate.of(2026, 10, 15).atTime(12, 30).atZone(paris).toInstant().toEpochMilli()
        assertNull(checkWindowAt(atLunch))
    }
}
