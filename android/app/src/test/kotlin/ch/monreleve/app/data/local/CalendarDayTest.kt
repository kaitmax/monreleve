package ch.monreleve.app.data.local

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.util.TimeZone

/**
 * AN5 increment 1, R28: "today" is the Europe/Paris calendar day, never the
 * device's. THE DEVICE TIMEZONE IS CHANGED for every case - both by injecting a
 * clock in a foreign zone AND by moving the JVM default with TimeZone.setDefault,
 * because a naive implementation could read either one. The default is restored in
 * a finally so no other suite inherits it.
 *
 * Each case is an instant where the Paris day differs from the device day, in both
 * directions and at both of Paris's offsets:
 *   - summer, device BEHIND Paris (UTC / Los Angeles): 23:30Z is 01:30 next-day in
 *     Paris (+2) but still the previous day at UTC and in California;
 *   - winter, device BEHIND Paris (UTC): 23:30Z is 00:30 next-day in Paris (+1);
 *   - device AHEAD of Paris (Kiritimati, +14): 10:30Z is still today in Paris (+2)
 *     but already tomorrow on the far side of the date line.
 *
 * The trap implementation (LocalDate.now(clock), which reads the clock's zone)
 * fails all three; the fix (the instant, with Paris pinned) passes all three.
 */
class CalendarDayTest {
    private data class Case(val instant: String, val deviceZone: String, val parisDay: String)

    private val cases =
        listOf(
            Case("2027-06-17T23:30:00Z", "UTC", "2027-06-18"),
            Case("2027-06-17T23:30:00Z", "America/Los_Angeles", "2027-06-18"),
            Case("2027-01-17T23:30:00Z", "UTC", "2027-01-18"),
            Case("2027-06-17T10:30:00Z", "Pacific/Kiritimati", "2027-06-17"),
        )

    @Test
    fun todayIsTheParisDayWhateverTheDeviceTimezone() {
        val original = TimeZone.getDefault()
        try {
            for (case in cases) {
                TimeZone.setDefault(TimeZone.getTimeZone(case.deviceZone))
                val clock = Clock.fixed(Instant.parse(case.instant), ZoneId.of(case.deviceZone))
                assertEquals(
                    "instant ${case.instant} on a device in ${case.deviceZone} must record the Paris day",
                    case.parisDay,
                    todayInParis(clock),
                )
            }
        } finally {
            TimeZone.setDefault(original)
        }
    }
}
