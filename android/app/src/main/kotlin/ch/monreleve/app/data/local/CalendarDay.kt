package ch.monreleve.app.data.local

import ch.monreleve.app.fr.format.DATE_TIME_ZONE
import java.time.Clock
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private val PARIS: ZoneId = ZoneId.of(DATE_TIME_ZONE)

// AN5. Which calendar day "today" is, for the record (R28), and the device's claim
// about when a day was recorded.
//
// THE DEVICE'S TIMEZONE IS NOT Europe/Paris BY ASSUMPTION. A frontalier travels,
// and a device can be set to UTC; naming the day from the device's own zone would
// record the wrong day whenever the device is behind or ahead of Paris across a
// midnight. This is the same trap AN3 documented for the locale: the platform
// default is the user's, and it must not leak into the record.
//
// ONE HOME FOR THE ZONE (R206). The string "Europe/Paris" lives once, in
// fr/format/Dates.kt as DATE_TIME_ZONE, and is imported here rather than retyped -
// the display path and the record path cannot drift onto two different zones.

/**
 * Today's calendar day as an ISO YYYY-MM-DD string, in Europe/Paris.
 *
 * The clock supplies only the instant; the zone is pinned so a device set to any
 * timezone still records the Paris day.
 *
 * clock.instant().atZone(PARIS).toLocalDate() - NOT LocalDate.ofInstant(instant, zone): that overload was
 * added in API 34, and on a minSdk-26 device with no coreLibraryDesugaring it throws NoSuchMethodError at
 * launch (DEVICE-LOOP CRASH 1). Instant.atZone and ZonedDateTime.toLocalDate are both API 26 and compose to
 * exactly what ofInstant is defined as. ApiLevelFenceTest guards the whole class.
 */
fun todayInParis(clock: Clock): String = clock.instant().atZone(PARIS).toLocalDate().toString()

// Explicit seconds, milliseconds and offset, always. OffsetDateTime.toString() and
// the ISO_OFFSET_DATE_TIME formatter both OMIT the seconds field when it is zero,
// producing "...T14:30+02:00" - which the server's zod .datetime({ offset: true })
// rejects. A fixed pattern cannot land on that trap.
private val CLAIM_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSSxxx")

/**
 * The device's clock at the tap, as an ISO instant WITH OFFSET, in the zone the
 * clock carries (the device's own).
 *
 * This is clientClaimedAt: sent verbatim and NEVER trusted as evidence (SPEC 8).
 * The server keeps both this and its own firstRecordedAt, so a reader can see the
 * gap rather than being told one number. The offset reflects where the device
 * thinks it is - which is exactly what a claim is, and why - unlike the day - it is
 * NOT pinned to Paris.
 */
fun deviceClaimNow(clock: Clock): String = OffsetDateTime.now(clock).format(CLAIM_FORMAT)
