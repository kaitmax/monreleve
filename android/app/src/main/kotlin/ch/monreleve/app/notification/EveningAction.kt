package ch.monreleve.app.notification

import android.content.Context
import android.content.Intent
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Provenance

// AN-NOTIF (R339). THE INTENT CONTRACT between the notifier (detection/EveningNotifier, which builds the
// recording buttons' PendingIntents) and the receiver (EveningActionReceiver, which reads them). One home for the
// extra keys and the parse (R206), so the two sides cannot drift.
//
// The intent is EXPLICIT (names the receiver class) and the PendingIntent wrapping it is IMMUTABLE (the notifier),
// so nothing outside the app can redirect it or alter the day/account/kind it carries. The receiver is not
// exported (manifest), so only the app's own PendingIntents reach it.

/** The broadcast action a recording button fires. An identifier, not copy (no fr/ string here). */
const val ACTION_EVENING_RECORD = "ch.monreleve.app.action.EVENING_RECORD"

private const val EXTRA_DAY = "ch.monreleve.app.evening.DAY"
private const val EXTRA_ACCOUNT = "ch.monreleve.app.evening.ACCOUNT"
private const val EXTRA_KIND = "ch.monreleve.app.evening.KIND"
private const val EXTRA_PROVENANCE = "ch.monreleve.app.evening.PROVENANCE"
private const val EXTRA_DETECTED_KIND = "ch.monreleve.app.evening.DETECTED_KIND"

/**
 * The explicit broadcast Intent a recording button fires: it names the receiver and carries the tap - the day and
 * account the notification was shown for, plus what to record. The account is the one shown (R303) - the receiver
 * refuses the write if a different account is signed in when the button is tapped. The intent round-trips an
 * EveningTap, so the notifier builds exactly the tap it wants recorded and eveningTapFrom reads it straight back.
 */
fun eveningRecordIntent(
    context: Context,
    tap: EveningTap,
): Intent =
    Intent(context, EveningActionReceiver::class.java).apply {
        action = ACTION_EVENING_RECORD
        putExtra(EXTRA_DAY, tap.shownForDay)
        putExtra(EXTRA_ACCOUNT, tap.shownForAccount)
        putExtra(EXTRA_KIND, tap.kind.name)
        putExtra(EXTRA_PROVENANCE, tap.provenance.name)
        putExtra(EXTRA_DETECTED_KIND, tap.detectedKind?.name)
    }

/**
 * Read a recording intent back into the pure EveningTap, or null if it is not one or is malformed. Guard-clause
 * parsing: each return rejects a missing/malformed field, so a corrupt intent writes nothing rather than a
 * half-built record - the fail-closed reading, so ReturnCount is suppressed as elsewhere.
 */
@Suppress("ReturnCount")
fun eveningTapFrom(intent: Intent): EveningTap? {
    if (intent.action != ACTION_EVENING_RECORD) return null
    val day = intent.getStringExtra(EXTRA_DAY) ?: return null
    val kind = enumExtra<EntryKind>(intent, EXTRA_KIND) ?: return null
    val provenance = enumExtra<Provenance>(intent, EXTRA_PROVENANCE) ?: return null
    return EveningTap(
        shownForDay = day,
        shownForAccount = intent.getStringExtra(EXTRA_ACCOUNT),
        kind = kind,
        provenance = provenance,
        detectedKind = enumExtra<EntryKind>(intent, EXTRA_DETECTED_KIND),
    )
}

/** An enum extra read by `.name`, null on absent or unknown (a value from a newer build must not crash an old one). */
private inline fun <reified E : Enum<E>> enumExtra(
    intent: Intent,
    key: String,
): E? = intent.getStringExtra(key)?.let { name -> runCatching { enumValueOf<E>(name) }.getOrNull() }
