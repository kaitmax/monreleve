package ch.monreleve.app.detection

import ch.monreleve.app.fr.format.DATE_TIME_ZONE
import java.time.LocalDate
import java.time.ZoneId

// AN6a increment 3. The working window a day's tally covers: 07:00-19:00 Europe/Paris by
// default (SPEC 13.1, editable later). PINNED TO PARIS (R28): a device travelling or set to
// UTC must bound the window by the Paris wall clock, not its own - the same trap AN5's
// today-in-Paris closed. The window is stored on the tally as minutes-of-day so a past
// tally keeps the window it was computed under even if the user later edits it.

const val WORKING_WINDOW_START_MINUTE = 7 * 60 // 07:00

const val WORKING_WINDOW_END_MINUTE = 19 * 60 // 19:00

private val PARIS: ZoneId = ZoneId.of(DATE_TIME_ZONE)

/**
 * The [start, end) instants of one day's working window, as epoch millis, anchored to
 * `startMinuteOfDay`/`endMinuteOfDay` in Europe/Paris on the given ISO calendar day. The
 * device's own timezone is never consulted.
 */
fun workingWindowParis(
    dayDate: String,
    startMinuteOfDay: Int = WORKING_WINDOW_START_MINUTE,
    endMinuteOfDay: Int = WORKING_WINDOW_END_MINUTE,
): LongRange {
    val day = LocalDate.parse(dayDate)
    val start = day.atStartOfDay(PARIS).plusMinutes(startMinuteOfDay.toLong()).toInstant().toEpochMilli()
    val end = day.atStartOfDay(PARIS).plusMinutes(endMinuteOfDay.toLong()).toInstant().toEpochMilli()
    return start until end
}

/** Whether a fix instant falls inside the day's Paris working window. */
fun isInWorkingWindow(
    epochMillis: Long,
    dayDate: String,
    startMinuteOfDay: Int = WORKING_WINDOW_START_MINUTE,
    endMinuteOfDay: Int = WORKING_WINDOW_END_MINUTE,
): Boolean = epochMillis in workingWindowParis(dayDate, startMinuteOfDay, endMinuteOfDay)
