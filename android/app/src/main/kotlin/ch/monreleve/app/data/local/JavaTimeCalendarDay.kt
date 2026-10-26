package ch.monreleve.app.data.local

import kotlinx.datetime.toKotlinTimeZone
import kotlin.time.ExperimentalTime
import kotlin.time.toKotlinInstant
import java.time.Clock as JavaClock
import kotlin.time.Clock as KotlinClock
import kotlin.time.Instant as KotlinInstant

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
@OptIn(ExperimentalTime::class) // KMP-DT R590: calls through the kotlin.time.Clock seam - on the allowlist.
fun todayInParis(clock: JavaClock): String = todayInParis(clock.toKotlinClock())

/** clientClaimedAt from a java.time.Clock - its instant, in the zone it carries: :shared's deviceClaimNow. */
@OptIn(ExperimentalTime::class) // KMP-DT R590: calls through the kotlin.time.Clock seam - on the allowlist.
fun deviceClaimNow(clock: JavaClock): String = deviceClaimNow(clock.toKotlinClock(), clock.zone.toKotlinTimeZone())

/**
 * A java.time.Clock's INSTANT SOURCE as a kotlin.time Clock (kotlinx-datetime's own until 0.7). The zone is
 * not carried; pass it apart.
 *
 * KMP-DT (R553, R590): the conversion is the standard library's java.time.Instant.toKotlinInstant() - the
 * library's own converter, never a hand-written mapping - and kotlin.time's Clock/Instant are @ExperimentalTime
 * on Kotlin 2.2, stable unchanged in 2.3. The opt-in sits on this one function, so the private class this
 * used to build became the object expression below: a class whose supertype is Clock would need the opt-in
 * on the whole class. JavaTimeCalendarDayGoldenTest pins every string this path writes.
 */
@OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Clock and Instant - on the allowlist.
internal fun JavaClock.toKotlinClock(): KotlinClock {
    val source = this
    return object : KotlinClock {
        override fun now(): KotlinInstant = source.instant().toKotlinInstant()
    }
}
