package ch.monreleve.app.data.local

import ch.monreleve.app.fr.format.DATE_TIME_ZONE
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneId

private val PARIS: ZoneId = ZoneId.of(DATE_TIME_ZONE)

// AN5 increment 1. Which calendar day "today" is, for the record (R28).
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
 */
fun todayInParis(clock: Clock): String = LocalDate.ofInstant(clock.instant(), PARIS).toString()
