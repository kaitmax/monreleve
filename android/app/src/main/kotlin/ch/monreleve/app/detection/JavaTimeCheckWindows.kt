package ch.monreleve.app.detection

import ch.monreleve.app.data.local.toKotlinClock
import kotlin.time.ExperimentalTime
import java.time.Clock as JavaClock

// IOS-1b-A R602b. :app's HALF OF CheckWindows, and it decides nothing - KMP-4's JavaTimeCalendarDay shape.
//
// CheckWindows moved to :shared onto kotlinx-datetime. The sampler, the evening receiver and the session in :app
// still hold a java.time.Clock, so these two overloads keep their call sites unedited by converting the clock's
// INSTANT SOURCE and nothing else; the Paris wall clock is read in :shared, and CheckWindowsParisPinTest pins it.
// Named for what it holds, not CheckWindows.kt, so its JVM facade cannot collide with :shared's (CheckWindowsKt).

/** The check window [clock]'s Paris time falls inside: :shared's currentCheckWindow, from a java.time.Clock. */
@OptIn(ExperimentalTime::class) // KMP-DT R590: calls through the kotlin.time.Clock seam - on the allowlist.
fun currentCheckWindow(clock: JavaClock): CheckWindow? = currentCheckWindow(clock.toKotlinClock())

/** True once the last window has ended in Paris: :shared's afterLastCheckWindow, from a java.time.Clock. */
@OptIn(ExperimentalTime::class) // KMP-DT R590: calls through the kotlin.time.Clock seam - on the allowlist.
fun afterLastCheckWindow(clock: JavaClock): Boolean = afterLastCheckWindow(clock.toKotlinClock())
