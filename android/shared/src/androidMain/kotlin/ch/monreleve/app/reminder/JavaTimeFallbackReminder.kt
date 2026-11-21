package ch.monreleve.app.reminder

import kotlinx.datetime.toKotlinTimeZone
import java.time.ZoneId
import kotlin.time.ExperimentalTime
import kotlin.time.toJavaInstant
import kotlin.time.toKotlinInstant
import java.time.Instant as JavaInstant

// IOS-MOVE-REMINDER (R1290, R1294). THE JAVA.TIME FACE OF THE COMMON 19:00 FALLBACK, AND IT DECIDES NOTHING -
// JavaTimeCalendarDay's shape (KMP-4), on :shared's Android side.
//
// nextFallbackAt, bootFallbackAt and reachedFallbackTime moved to commonMain on kotlinx-datetime (FallbackReminder.kt).
// :app's runtime (FallbackReminderRuntime.kt: WorkManager's delay, the reboot link, the wake's time gate) and its pin
// (FallbackReminderTest) still hold java.time Instants and ZoneIds, so these three overloads keep both UNEDITED by
// converting TYPES and nothing else: the instant through the standard library's own converters, the zone through
// kotlinx-datetime's. Every comparison and every calendar step is the common function's, and
// FallbackReminderGoldenTest pins that function against what the java.time versions returned before the move.
//
// WHY HERE AND NOT IN :app. MovedTwinsFenceTest refuses a moved NAME anywhere in :app (R1293), and these overloads
// share the moved names by design (that is what keeps the callers unedited). :shared's androidMain is the same module
// as the common functions, Android-only by construction, and holds no logic. The file is named for what it holds,
// not FallbackReminder.kt, so its JVM facade (JavaTimeFallbackReminderKt) cannot collide with the common one.

/** :shared's nextFallbackAt, from and to java.time. */
@OptIn(ExperimentalTime::class) // KMP-DT R590 / IOS-MOVE-REMINDER R1290: kotlin.time.Instant - on the allowlist.
fun nextFallbackAt(
    now: JavaInstant,
    zone: ZoneId,
): JavaInstant = nextFallbackAt(now.toKotlinInstant(), zone.toKotlinTimeZone()).toJavaInstant()

/** :shared's bootFallbackAt, from and to java.time. */
@OptIn(ExperimentalTime::class) // KMP-DT R590 / IOS-MOVE-REMINDER R1290: kotlin.time.Instant - on the allowlist.
fun bootFallbackAt(
    now: JavaInstant,
    zone: ZoneId,
): JavaInstant = bootFallbackAt(now.toKotlinInstant(), zone.toKotlinTimeZone()).toJavaInstant()

/** :shared's reachedFallbackTime, from java.time. */
@OptIn(ExperimentalTime::class) // KMP-DT R590 / IOS-MOVE-REMINDER R1290: kotlin.time.Instant - on the allowlist.
fun reachedFallbackTime(
    now: JavaInstant,
    zone: ZoneId,
): Boolean = reachedFallbackTime(now.toKotlinInstant(), zone.toKotlinTimeZone())
