package ch.monreleve.app.dossier

import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Clock
import kotlin.time.ExperimentalTime
import kotlin.time.Instant

// KMP-0 increment 6 (R371, R28). The multiplatform Paris-day resolution - the kotlinx-datetime twin of
// :app's data.local.todayInParis (java.time), so iOS names a recorded day EXACTLY as Android does when
// its own controller is written (R367). The moved dossier/forecast functions never call this: they take
// `today` as a parameter (R28, clock-free), and the caller resolves it ONCE. This exists so the Paris-day
// semantics have a platform-free home and a test can pin it across both 2026 DST changes.
//
// THE DEVICE'S ZONE IS NOT ASSUMED TO BE PARIS. A frontalier travels and a device can be set to UTC;
// naming the day from the device's own zone would record the wrong day across a midnight. The zone is
// pinned, the same guard :app's todayInParis documents.
//
// TWO "Europe/Paris" LITERALS, BY NECESSITY. :app keeps its DATE_TIME_ZONE in fr/format (which stayed in
// :app, JVM formatters), and commonMain cannot import from :app - so the shared side holds its own. The
// id is a stable IANA name; a single shared home for it waits on fr/format's multiplatform story (KMP-1).

/** Europe/Paris - the one zone a recorded day is named in, whatever zone the device carries (R28). */
val PARIS_ZONE: TimeZone = TimeZone.of("Europe/Paris")

/**
 * The Paris calendar day of [instant]. DST matters HERE and only here: the instant-to-day boundary moves
 * with Paris's UTC offset (+01:00 in winter, +02:00 in summer), so an instant at 23:30 UTC in winter is
 * already the next Paris day. Every LocalDate computation downstream is zone-free and DST-invariant by
 * construction - a calendar date carries no offset.
 */
@OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Instant - on the allowlist.
fun parisDayOf(instant: Instant): LocalDate = instant.toLocalDateTime(PARIS_ZONE).date

/** Today's Paris calendar day from [clock] (the system clock by default). The caller resolves it ONCE (R28). */
@OptIn(ExperimentalTime::class) // KMP-DT R590: kotlin.time.Clock - on the allowlist.
fun todayInParis(clock: Clock = Clock.System): LocalDate = parisDayOf(clock.now())
