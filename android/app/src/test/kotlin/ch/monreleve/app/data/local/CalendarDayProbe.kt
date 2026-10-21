package ch.monreleve.app.data.local

import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// KMP-4 (R464). THE GOLDEN TEST'S CONSTRUCTION, and the only lines that know which types the subject takes.
//
// CalendarDayGoldenTest pins the Paris day and the clientClaimedAt string through these two functions,
// given an instant and the zone the DEVICE carries. Today the subject is the java.time CalendarDay, so a
// device is a java.time.Clock fixed at the instant in that zone - which is exactly what production hands it
// (Clock.systemDefaultZone() is an instant source plus the device's zone).
//
// When CalendarDay moves to :shared, the golden test moves to commonTest by `git mv`, UNEDITED, and this
// file is the one rewritten for the types the moved functions take (R467's "the lines that BUILD the
// subject", applied to a function rather than a constructor). The goldens, the cases and every assertion
// live in the test file, not here.

internal fun parisDayAt(
    instant: String,
    deviceZone: String,
): String = todayInParis(deviceClock(instant, deviceZone))

internal fun claimAt(
    instant: String,
    deviceZone: String,
): String = deviceClaimNow(deviceClock(instant, deviceZone))

private fun deviceClock(
    instant: String,
    deviceZone: String,
): Clock = Clock.fixed(Instant.parse(instant), ZoneId.of(deviceZone))
