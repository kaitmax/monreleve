package ch.monreleve.app.detection

import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// R320. THE FOUR DAILY CHECK WINDOWS, Europe/Paris, chosen to AVOID LUNCH - the least reliable moment of a
// working day, when people go out. Detection checks the position FOUR TIMES A DAY, not all day: Android 8+
// delivers background location only a few times an hour, and four checks cost a fraction of the battery.
//
//   around 09:30   11:00   14:30   16:30
//
// EACH CHECK RUNS ANYWHERE INSIDE ITS WINDOW. A check that cannot run inside its window is MISSED, never taken
// late: an 11:00 check delayed to 13:00 would sample lunch, the very thing the windows avoid.
//
// WINDOW LENGTH: +/- CHECK_WINDOW_RADIUS_MINUTES, a 60-minute window per check. Why 60 minutes:
//   - WorkManager delivers background work no more often than every 15 minutes and CANNOT promise an exact
//     time (the exact-alarm permission is restricted to alarm/calendar apps and is deliberately NOT requested,
//     R320), so a window must hold several wake opportunities for a check to land inside it; 60 minutes holds
//     about four at the 15-minute cadence.
//   - It is short enough to keep the windows disjoint AND clear of lunch: window 2 ends at 11:30 and window 3
//     opens at 14:00, so 11:30-14:00 is never sampled.
// The radius is PROPOSED (R276/R320): recorded in docs/detection-model.md and frozen when the field test starts.
//
// PINNED TO PARIS (R28): a device travelling or set to UTC bounds its windows by the Paris wall clock, not its
// own - the same trap AN5's today-in-Paris closed. Nothing here reads a coordinate (D18).

private val PARIS: ZoneId = ZoneId.of("Europe/Paris")

/** Half a check window, in minutes: a check fires anywhere within +/- this of its centre time (PROPOSED). */
const val CHECK_WINDOW_RADIUS_MINUTES = 30

/** One of the four daily checks: its 1-based index and its centre minute-of-day in Europe/Paris. */
data class CheckWindow(val index: Int, val centreMinuteOfDay: Int) {
    val startMinuteOfDay: Int get() = centreMinuteOfDay - CHECK_WINDOW_RADIUS_MINUTES
    val endMinuteOfDay: Int get() = centreMinuteOfDay + CHECK_WINDOW_RADIUS_MINUTES

    fun contains(minuteOfDay: Int): Boolean = minuteOfDay in startMinuteOfDay until endMinuteOfDay
}

/** The four windows, around 09:30 / 11:00 / 14:30 / 16:30 Europe/Paris (R320). */
val CHECK_WINDOWS: List<CheckWindow> =
    listOf(
        CheckWindow(1, 9 * 60 + 30),
        CheckWindow(2, 11 * 60),
        CheckWindow(3, 14 * 60 + 30),
        CheckWindow(4, 16 * 60 + 30),
    )

private fun parisMinuteOfDay(instant: Instant): Int {
    // Instant.atZone / ZonedDateTime.toLocalTime are Java 8 (minSdk 26 safe); LocalTime.ofInstant is not (R308).
    val now = instant.atZone(PARIS).toLocalTime()
    return now.hour * 60 + now.minute
}

/** The check window the current Paris time falls inside, or null when it is between windows (or at lunch). */
fun currentCheckWindow(clock: Clock): CheckWindow? {
    val minute = parisMinuteOfDay(clock.instant())
    return CHECK_WINDOWS.firstOrNull { it.contains(minute) }
}

/** The check window a given instant falls inside (Paris), or null outside any window. */
fun checkWindowAt(epochMillis: Long): CheckWindow? {
    val minute = parisMinuteOfDay(Instant.ofEpochMilli(epochMillis))
    return CHECK_WINDOWS.firstOrNull { it.contains(minute) }
}

/**
 * True once the last window has ended for the day (the evening): the day's vote is final and can be shown.
 * The Aujourd'hui auto surface waits for this before proposing - "Votre journée vous sera proposée ce soir."
 */
fun afterLastCheckWindow(clock: Clock): Boolean {
    return parisMinuteOfDay(clock.instant()) >= CHECK_WINDOWS.last().endMinuteOfDay
}
