package ch.monreleve.app.detection

import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.fr.format.DATE_TIME_ZONE
import java.time.LocalDate
import java.time.ZoneId

// AN6a increment 5. The seven synthetic tracks (R197 - each a scenario with its expected result
// written before it runs), replayed through the real sampling path (DetectionSession.onFix) on
// the emulator and asserted in the JVM regression test.
//
// The coordinates are three verified points: central Geneva (inside), Annemasse (France,
// outside), and a real Geneva border vertex (buffer). This file lives in detection/ because a
// TrackPoint names latitude/longitude, which fence 2b permits only here.
//
// EXPECTED RESULTS, HAND-REASONED FROM THE ALGORITHM (not the intuition of the scenario):
//   a commute        - Geneva ~92% of attributed minutes -> HIGH, CH, FULL
//   b telework       - home all day, 100%                 -> HIGH, HOME, FULL
//   c buffer home    - every fix in the 150 m buffer      -> LOW (withheld): nothing to attribute
//   d tunnel gap     - 45 min gap folds onto the Geneva side, still ~94% -> HIGH, CH, FULL
//   e half-day       - ~52% one side, below 70%           -> LOW (withheld): a split day
//   f no fixes       - nothing sampled                    -> LOW (withheld)
//   g train dwell    - border dwell pushes buffer > 40%   -> LOW (withheld)

private val GENEVA = doubleArrayOf(6.1432, 46.2044) // lng, lat - central Geneva, inside
private val FRANCE = doubleArrayOf(6.2347, 46.1919) // Annemasse, outside
private val BORDER = doubleArrayOf(6.21478, 46.19459) // a real Geneva border vertex, buffer

private const val SAMPLE_STEP = 15

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

private fun segment(
    coord: DoubleArray,
    fromMinute: Int,
    toMinute: Int,
): List<TrackPoint> {
    val points = mutableListOf<TrackPoint>()
    var minute = fromMinute
    while (minute <= toMinute) {
        points.add(TrackPoint(latitude = coord[1], longitude = coord[0], minuteOfDay = minute))
        minute += SAMPLE_STEP
    }
    return points
}

/** The instant of a track point: `minuteOfDay` past midnight Europe/Paris on `dayDate` (R28). */
fun trackPointInstant(
    dayDate: String,
    minuteOfDay: Int,
): Long =
    LocalDate.parse(dayDate)
        .atStartOfDay(ZoneId.of(DATE_TIME_ZONE))
        .plusMinutes(minuteOfDay.toLong())
        .toInstant()
        .toEpochMilli()

/**
 * Replay a track through a fresh DetectionSession and return its proposal. Lives in detection/
 * because it reads the points' coordinates; the caller (the dev replay screen, or the JVM test)
 * sees only the Proposal.
 */
fun replayTrack(
    border: BorderPolygon,
    track: SyntheticTrack,
): Proposal? {
    val session = DetectionSession(border)
    for (point in track.points) {
        session.onFix(point.latitude, point.longitude, trackPointInstant(track.dayDate, point.minuteOfDay))
    }
    return session.proposal(track.dayDate)
}

object SyntheticTracks {
    private const val DAY = "2027-06-18"

    val all: List<SyntheticTrack> =
        listOf(
            SyntheticTrack(
                name = "commute: home in France, the day in Geneva",
                dayDate = DAY,
                points = segment(FRANCE, 420, 465) + segment(GENEVA, 480, 1140),
                expected = Proposal(Tier.HIGH, EntryKind.CH, Portion.FULL),
            ),
            SyntheticTrack(
                name = "telework: home all day",
                dayDate = DAY,
                points = segment(FRANCE, 420, 1140),
                expected = Proposal(Tier.HIGH, EntryKind.HOME, Portion.FULL),
            ),
            SyntheticTrack(
                name = "home 120 m from the border: fixes in the buffer",
                dayDate = DAY,
                points = segment(BORDER, 420, 1140),
                expected = null,
            ),
            SyntheticTrack(
                name = "tunnel gap: 45 min with no fix mid-commute",
                dayDate = DAY,
                points = segment(FRANCE, 420, 450) + segment(GENEVA, 465, 720) + segment(GENEVA, 765, 1140),
                expected = Proposal(Tier.HIGH, EntryKind.CH, Portion.FULL),
            ),
            SyntheticTrack(
                name = "morning home, afternoon in Geneva: the half-day case",
                dayDate = DAY,
                points = segment(FRANCE, 420, 750) + segment(GENEVA, 765, 1140),
                expected = null,
            ),
            SyntheticTrack(
                name = "a day with no fixes at all",
                dayDate = DAY,
                points = emptyList(),
                expected = null,
            ),
            SyntheticTrack(
                name = "train crossing that dwells at the border station",
                dayDate = DAY,
                points = segment(BORDER, 420, 720) + segment(GENEVA, 735, 1140),
                expected = null,
            ),
        )
}
