package ch.monreleve.app.data.local

import kotlinx.datetime.toKotlinInstant
import kotlinx.datetime.toKotlinTimeZone
import java.time.Clock as JavaClock
import kotlinx.datetime.Clock as KotlinClock
import kotlinx.datetime.Instant as KotlinInstant

// KMP-4 (R464). :app's HALF OF CalendarDay, and it decides nothing.
//
// CalendarDay moved to :shared onto kotlinx-datetime. :app's controllers, the evening receiver and the
// detection worker still hold a java.time.Clock - they are out of KMP-4's scope - so these two overloads
// keep their call sites unedited by converting TYPES and nothing else: the Paris day and the claim's fixed
// format are computed in :shared, and CalendarDayGoldenTest pins them there.
//
// A java.time.Clock IS TWO THINGS - an instant source and a zone - and a kotlinx Clock is only the first.
// So the zone is read off the java clock here and handed over separately: the claim's offset is the zone
// the clock was BUILT with (Clock.systemDefaultZone() at the call site), exactly as before the move.
//
// The file is named for what it holds rather than CalendarDay.kt, because a second CalendarDay.kt in the same
// package would compile to the same JVM facade class (CalendarDayKt) as :shared's and collide at dexing.

/** The Paris day of [clock]'s instant: :shared's todayInParis, reached from a java.time.Clock. */
fun todayInParis(clock: JavaClock): String = todayInParis(clock.toKotlinClock())

/** clientClaimedAt from a java.time.Clock - its instant, in the zone it carries: :shared's deviceClaimNow. */
fun deviceClaimNow(clock: JavaClock): String = deviceClaimNow(clock.toKotlinClock(), clock.zone.toKotlinTimeZone())

/** A java.time.Clock's INSTANT SOURCE as a kotlinx-datetime Clock. The zone is not carried; pass it apart. */
internal fun JavaClock.toKotlinClock(): KotlinClock = JavaTimeInstants(this)

private class JavaTimeInstants(
    private val clock: JavaClock,
) : KotlinClock {
    override fun now(): KotlinInstant = clock.instant().toKotlinInstant()
}
