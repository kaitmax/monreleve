package ch.monreleve.app.detection

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

// IOS-1b-A R602b. THE PIN, written and run green on the java.time CheckWindows BEFORE it moved to :shared and
// onto kotlinx-datetime. For every minute of an ordinary day and of both 2026 DST change days (UTC midnight to
// UTC midnight, so the Paris wall clock skips an hour on one and repeats one on the other), the window index
// and the "after the last window" flag must equal what java.time's own Paris wall clock says. The oracle is
// java.time, computed here, independently of the code under test - so after the port this same test proves
// the kotlinx version answers exactly as the java.time version did, minute for minute.
class CheckWindowsParisPinTest {
    private val paris = ZoneId.of("Europe/Paris")

    private fun oracleMinute(epochMillis: Long): Int {
        val t = Instant.ofEpochMilli(epochMillis).atZone(paris).toLocalTime()
        return t.hour * 60 + t.minute
    }

    @Test
    fun everyMinuteOfThreeDaysMatchesTheParisWallClock() {
        var checked = 0
        for (day in listOf("2026-06-15", "2026-03-29", "2026-10-25")) {
            val start = Instant.parse("${day}T00:00:00Z").toEpochMilli()
            for (m in 0 until 24 * 60) {
                val epoch = start + m * 60_000L + 59_000L // the last second of each minute
                val minute = oracleMinute(epoch)
                val expected = CHECK_WINDOWS.firstOrNull { it.contains(minute) }?.index
                assertEquals("checkWindowAt $day +$m min", expected, checkWindowAt(epoch)?.index)
                val clock = java.time.Clock.fixed(Instant.ofEpochMilli(epoch), paris)
                assertEquals("currentCheckWindow $day +$m min", expected, currentCheckWindow(clock)?.index)
                assertEquals(
                    "afterLastCheckWindow $day +$m min",
                    minute >= CHECK_WINDOWS.last().endMinuteOfDay,
                    afterLastCheckWindow(clock),
                )
                checked++
            }
        }
        assertEquals(3 * 24 * 60, checked)
    }
}
