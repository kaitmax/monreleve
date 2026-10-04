package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import java.time.LocalDate
import java.time.ZoneId

// R320. The seven AN6a tracks RE-EXPRESSED as positions at the FOUR check times (around 09:30 / 11:00 / 14:30 /
// 16:30 Paris), plus two new cases the four-window model introduces: a MISSED check (three taken, all agreeing),
// and a check DELAYED past its window (its only fix lands outside any window, so the check is MISSED - never
// sampled late). Each scenario's expected DAY outcome under the vote is WRITTEN BEFORE IT RUNS (R197).
//
// The coordinates are three verified points: central Geneva (inside), Annemasse (France, outside), and a real
// Geneva border vertex (buffer/strip). This file lives in detection/ because a TrackPoint names latitude/longitude,
// which fence 2b permits only here. A point is one fix at a minute-of-day Europe/Paris on `dayDate` (R28); a fix
// whose minute falls outside every window is ignored by the session - that is the "delayed, never late" case.

private val GENEVA = doubleArrayOf(6.1432, 46.2044) // lng, lat - central Geneva, inside
private val FRANCE = doubleArrayOf(6.2347, 46.1919) // Annemasse, outside (home)
private val BORDER = doubleArrayOf(6.21478, 46.19459) // a real Geneva border vertex, in the 150 m strip

// The four check-window centre minutes-of-day (Europe/Paris), and one lunchtime minute used to show a late fix.
private const val CHECK1 = 9 * 60 + 30 // 09:30
private const val CHECK2 = 11 * 60 // 11:00
private const val CHECK3 = 14 * 60 + 30 // 14:30
private const val CHECK4 = 16 * 60 + 30 // 16:30
private const val LUNCH_LATE = 13 * 60 // 13:00 - outside every window; a fix here is never a check

data class TrackPoint(
    val latitude: Double,
    val longitude: Double,
    val minuteOfDay: Int,
)

data class SyntheticTrack(
    val name: String,
    val dayDate: String,
    val points: List<TrackPoint>,
    val expected: Proposal?,
)

private fun at(
    coord: DoubleArray,
    minuteOfDay: Int,
): TrackPoint = TrackPoint(latitude = coord[1], longitude = coord[0], minuteOfDay = minuteOfDay)

/** The instant of a track point: `minuteOfDay` past midnight Europe/Paris on `dayDate` (R28). */
fun trackPointInstant(
    dayDate: String,
    minuteOfDay: Int,
): Long =
    LocalDate.parse(dayDate)
        .atStartOfDay(ZoneId.of("Europe/Paris"))
        .plusMinutes(minuteOfDay.toLong())
        .toInstant()
        .toEpochMilli()

/**
 * Replay a track through a fresh DetectionSession and return its DAY proposal. Lives in detection/ because it reads
 * the points' coordinates; the caller (the dev replay screen, or the JVM test) sees only the Proposal.
 *
 * accuracyMeters applies to EVERY fix in the track (AN-NEXT-2 / R324): 0.0 is a perfectly precise fix (the GPS-era
 * behaviour), and a coarse value re-runs the same track as if each fix came from a NETWORK provider that cannot
 * resolve the border within that radius. It is read by the classifier and discarded, never stored (D18).
 */
fun replayTrack(
    border: BorderPolygon,
    track: SyntheticTrack,
    accuracyMeters: Double = 0.0,
): Proposal? {
    val session = DetectionSession(border)
    for (point in track.points) {
        session.onFix(
            point.latitude,
            point.longitude,
            trackPointInstant(track.dayDate, point.minuteOfDay),
            accuracyMeters,
        )
    }
    return session.proposal()
}

/** Replay a track and return its four checks (for the half-day cases and the no-coordinate replay). */
fun replayTrackChecks(
    border: BorderPolygon,
    track: SyntheticTrack,
    accuracyMeters: Double = 0.0,
): DayChecks {
    val session = DetectionSession(border)
    for (point in track.points) {
        session.onFix(
            point.latitude,
            point.longitude,
            trackPointInstant(track.dayDate, point.minuteOfDay),
            accuracyMeters,
        )
    }
    return session.checks()
}

object SyntheticTracks {
    private const val DAY = "2027-06-18"

    private val HIGH_CH = Proposal(Tier.HIGH, EntryKind.CH, Portion.FULL)
    private val HIGH_HOME = Proposal(Tier.HIGH, EntryKind.HOME, Portion.FULL)
    private val MEDIUM_CH = Proposal(Tier.MEDIUM, EntryKind.CH, Portion.FULL)

    val all: List<SyntheticTrack> =
        listOf(
            // 4 INSIDE -> HIGH CH.
            SyntheticTrack(
                name = "commute: home in France, the day in Geneva",
                dayDate = DAY,
                points = listOf(at(GENEVA, CHECK1), at(GENEVA, CHECK2), at(GENEVA, CHECK3), at(GENEVA, CHECK4)),
                expected = HIGH_CH,
            ),
            // 4 OUTSIDE -> HIGH HOME.
            SyntheticTrack(
                name = "telework: home all day",
                dayDate = DAY,
                points = listOf(at(FRANCE, CHECK1), at(FRANCE, CHECK2), at(FRANCE, CHECK3), at(FRANCE, CHECK4)),
                expected = HIGH_HOME,
            ),
            // 4 BUFFER -> no side -> LOW (withheld).
            SyntheticTrack(
                name = "home 120 m from the border: every check in the strip",
                dayDate = DAY,
                points = listOf(at(BORDER, CHECK1), at(BORDER, CHECK2), at(BORDER, CHECK3), at(BORDER, CHECK4)),
                expected = null,
            ),
            // 3 INSIDE + 1 strip -> MEDIUM CH (withheld under R311).
            SyntheticTrack(
                name = "work trip with a border crossing: one check in the strip",
                dayDate = DAY,
                points = listOf(at(GENEVA, CHECK1), at(GENEVA, CHECK2), at(BORDER, CHECK3), at(GENEVA, CHECK4)),
                expected = MEDIUM_CH,
            ),
            // 2 OUTSIDE + 2 INSIDE -> LOW day (each HALF is decided: HOME am, CH pm).
            SyntheticTrack(
                name = "morning home, afternoon in Geneva: the split day",
                dayDate = DAY,
                points = listOf(at(FRANCE, CHECK1), at(FRANCE, CHECK2), at(GENEVA, CHECK3), at(GENEVA, CHECK4)),
                expected = null,
            ),
            // 4 MISSED -> LOW (withheld).
            SyntheticTrack(
                name = "a day with no fixes at all",
                dayDate = DAY,
                points = emptyList(),
                expected = null,
            ),
            // 2 strip + 2 INSIDE -> two dissenters -> LOW (and near-border).
            SyntheticTrack(
                name = "train crossing that dwells at the border station",
                dayDate = DAY,
                points = listOf(at(BORDER, CHECK1), at(BORDER, CHECK2), at(GENEVA, CHECK3), at(GENEVA, CHECK4)),
                expected = null,
            ),
            // check 3 missed; 3 INSIDE -> HIGH CH (a missed check does not lower the vote).
            SyntheticTrack(
                name = "one check missed: three taken, all in Geneva",
                dayDate = DAY,
                points = listOf(at(GENEVA, CHECK1), at(GENEVA, CHECK2), at(GENEVA, CHECK4)),
                expected = HIGH_CH,
            ),
            // the 13:00 fix is outside every window -> check 2 MISSED; 3 INSIDE -> HIGH CH.
            SyntheticTrack(
                name = "one check delayed past its window: its fix at 13:00 is never a check",
                dayDate = DAY,
                points = listOf(at(GENEVA, CHECK1), at(GENEVA, LUNCH_LATE), at(GENEVA, CHECK3), at(GENEVA, CHECK4)),
                expected = HIGH_CH,
            ),
        )
}
