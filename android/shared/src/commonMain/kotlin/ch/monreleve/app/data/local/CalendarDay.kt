package ch.monreleve.app.data.local

import ch.monreleve.app.dossier.parisDayOf
import kotlinx.datetime.TimeZone
import kotlinx.datetime.format
import kotlinx.datetime.format.DateTimeComponents
import kotlinx.datetime.format.char
import kotlinx.datetime.offsetAt
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// AN5. Which calendar day "today" is, for the record (R28), and the device's claim
// about when a day was recorded.
//
// KMP-4 (R464, PARK-B1): MOVED FROM :app, and rewritten from java.time onto kotlinx-datetime with every
// output byte unchanged - CalendarDayGoldenTest pinned both outputs on the java.time code first and moved
// here with this file, unedited. :app keeps a java.time bridge (JavaTimeCalendarDay.kt) for the callers
// that still hold a java.time.Clock; it converts types and decides nothing.
//
// THE DEVICE'S TIMEZONE IS NOT Europe/Paris BY ASSUMPTION. A frontalier travels,
// and a device can be set to UTC; naming the day from the device's own zone would
// record the wrong day whenever the device is behind or ahead of Paris across a
// midnight. This is the same trap AN3 documented for the locale: the platform
// default is the user's, and it must not leak into the record.
//
// ONE HOME FOR THE PARIS DAY (R206). The day comes from dossier/ParisDay.kt's parisDayOf, the one
// multiplatform Paris-day resolution, so the record path and the forecast cannot name a day two ways. The
// java.time version imported :app's DATE_TIME_ZONE; that constant stays in :app for display formatting,
// and this file no longer needs it.

/**
 * Today's calendar day as an ISO YYYY-MM-DD string, in Europe/Paris.
 *
 * The clock supplies only the instant; the zone is pinned so a device set to any timezone still records
 * the Paris day.
 */
@OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Clock, stable unchanged in Kotlin 2.3 - on the allowlist.
fun todayInParis(clock: Clock): String = parisDayOf(clock.now()).toString()

// Explicit seconds, milliseconds and offset, always - the java.time pattern "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"
// written as kotlinx-datetime's format DSL. OffsetDateTime.toString() and the ISO_OFFSET_DATE_TIME formatter
// both OMIT a zero seconds field, producing "...T14:30+02:00" - which the server's zod
// .datetime({ offset: true }) rejects. kotlinx's own ISO offset format writes a zero offset as "Z", where
// "xxx" writes "+00:00". A fixed format cannot land on either.
private val CLAIM_FORMAT =
    DateTimeComponents.Format {
        year()
        char('-')
        monthNumber()
        char('-')
        day()
        char('T')
        hour()
        char(':')
        minute()
        char(':')
        second()
        char('.')
        secondFraction(3)
        offsetHours()
        char(':')
        offsetMinutesOfHour()
    }

/**
 * The device's clock at the tap, as an ISO instant WITH OFFSET, in [deviceZone] - the zone the device
 * carries, captured where the caller built its clock, exactly as a java.time.Clock carried it.
 *
 * This is clientClaimedAt: sent verbatim and NEVER trusted as evidence (SPEC 8).
 * The server keeps both this and its own firstRecordedAt, so a reader can see the
 * gap rather than being told one number. The offset reflects where the device
 * thinks it is - which is exactly what a claim is, and why - unlike the day - it is
 * NOT pinned to Paris.
 *
 * MILLISECONDS ARE TRUNCATED, as java.time's "SSS" truncated them, so a sub-millisecond clock can never
 * round 59.9996 up into the next minute. Measured in KMP-4: kotlinx-datetime 0.6.1's secondFraction(3)
 * already truncates - removing the explicit cut below leaves every golden green - so the cut is not what
 * makes the golden pass today. It is kept so the claim does not rest on a formatting detail of a library
 * whose next series (0.7) is a known upgrade. KMP-DT: still kept on 0.7.1, where Instant is kotlin.time's.
 */
@OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Clock and Instant - on the allowlist.
fun deviceClaimNow(
    clock: Clock,
    deviceZone: TimeZone,
): String {
    val instant = Instant.fromEpochMilliseconds(clock.now().toEpochMilliseconds())
    return instant.format(CLAIM_FORMAT, deviceZone.offsetAt(instant))
}
