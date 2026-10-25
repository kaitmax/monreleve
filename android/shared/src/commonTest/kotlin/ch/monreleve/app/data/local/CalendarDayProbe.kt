package ch.monreleve.app.data.local

import kotlinx.datetime.TimeZone
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// KMP-4 (R464). THE GOLDEN TEST'S CONSTRUCTION, and the only lines that know which types the subject takes.
//
// CalendarDayGoldenTest pins the Paris day and the clientClaimedAt string through these two functions,
// given an instant and the zone the DEVICE carries. The subject is now the kotlinx-datetime CalendarDay in
// :shared, so a device is a Clock fixed at the instant PLUS the zone it carries - the two halves one
// java.time.Clock used to hold together, which :app's bridge now hands over separately.
//
// This file is the one REWRITTEN when CalendarDay moved (R467's "the lines that BUILD the subject", applied
// to a function rather than a constructor); CalendarDayGoldenTest moved beside it by `git mv`, UNEDITED. The
// goldens, the cases and every assertion live in the test file, not here.

// The device's zone is deliberately NOT handed to todayInParis: the moved function takes no zone at all, so
// the Paris day cannot depend on the device's - which is what the cases assert.
@Suppress("UnusedParameter")
@OptIn(ExperimentalTime::class) // KMP-DT R590: calls through the kotlin.time.Clock seam - on the allowlist.
internal fun parisDayAt(
    instant: String,
    deviceZone: String,
): String = todayInParis(fixedAt(instant))

@OptIn(ExperimentalTime::class) // KMP-DT R590: calls through the kotlin.time.Clock seam - on the allowlist.
internal fun claimAt(
    instant: String,
    deviceZone: String,
): String = deviceClaimNow(fixedAt(instant), TimeZone.of(deviceZone))

@OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Clock and Instant - on the allowlist.
private fun fixedAt(instant: String): Clock =
    object : Clock {
        override fun now(): Instant = Instant.parse(instant)
    }
