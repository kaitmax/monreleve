package ch.monreleve.app.detection

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.util.TimeZone

/**
 * AN6a increment 3, R28. The working window is 07:00-19:00 EUROPE/PARIS, whatever the device's
 * own timezone - the same trap AN5's today-in-Paris closed, on the window that decides which
 * fixes a day's tally counts.
 */
class WorkingWindowTest {
    @Test
    fun theWindowIsAnchoredToParisNotTheDevice() {
        val original = TimeZone.getDefault()
        try {
            for (deviceZone in listOf("UTC", "America/Los_Angeles", "Pacific/Kiritimati")) {
                TimeZone.setDefault(TimeZone.getTimeZone(deviceZone))
                // 2027-06-18 is summer: Paris is UTC+2, so 07:00 Paris = 05:00 UTC, 19:00 = 17:00 UTC.
                val window = workingWindowParis("2027-06-18")
                assertEquals(
                    "07:00 Paris on a device in $deviceZone",
                    Instant.parse("2027-06-18T05:00:00Z").toEpochMilli(),
                    window.first,
                )
                val midDay = Instant.parse("2027-06-18T12:00:00Z").toEpochMilli()
                val beforeStart = Instant.parse("2027-06-18T04:59:00Z").toEpochMilli()
                val atEnd = Instant.parse("2027-06-18T17:00:00Z").toEpochMilli()
                assertTrue("mid-window is inside", isInWorkingWindow(midDay, "2027-06-18"))
                assertFalse("before 07:00 Paris is outside", isInWorkingWindow(beforeStart, "2027-06-18"))
                assertFalse("19:00 Paris (exclusive end) is outside", isInWorkingWindow(atEnd, "2027-06-18"))
            }
        } finally {
            TimeZone.setDefault(original)
        }
    }

    @Test
    fun theWinterOffsetIsHandled() {
        // 2027-01-18 is winter: Paris is UTC+1, so 07:00 Paris = 06:00 UTC.
        assertEquals(
            Instant.parse("2027-01-18T06:00:00Z").toEpochMilli(),
            workingWindowParis("2027-01-18").first,
        )
    }
}
