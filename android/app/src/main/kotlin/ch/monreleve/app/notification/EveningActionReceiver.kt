package ch.monreleve.app.notification

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.deviceClaimNow
import ch.monreleve.app.data.local.get
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.data.sync.SyncScheduler
import ch.monreleve.app.detection.EveningNotifier
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Clock

// AN-NOTIF (R339). The evening notification's RECORDING RECEIVER: the Android glue around the pure decision
// (EveningTap). A recording button fires an immutable broadcast PendingIntent (EveningAction) to this receiver,
// which reads the tap, writes THROUGH THE ONE REPOSITORY PATH (R206 - the same LocalEntryRepository the in-app tap
// uses, so clientMutationId is born at the tap (AN5), the account tag (R303) and clientClaimedAt (R275) are
// stamped the same way), then turns the notification into a confirmation. D16 holds exactly: a clearly labelled
// button tap IS the person's tap, and nothing is written unless decideEveningTap says so.
//
// OFF THE MAIN THREAD (the prompt's section 4): goAsync() holds the broadcast alive while a coroutine does the
// database read and write on Dispatchers.IO. "Autre…" and "Modifier" are ACTIVITY PendingIntents built by the
// notifier, NOT routed here - Android 12+ forbids a receiver that a notification launched from starting an
// activity, so those open the app directly.
//
// NO COORDINATE IS TOUCHED (D18): this reads only the entry rows and writes a Classification-free record.

class EveningActionReceiver : BroadcastReceiver() {
    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        val tap = eveningTapFrom(intent) ?: return
        val appContext = context.applicationContext
        val pending = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                handle(appContext, tap)
            } finally {
                pending.finish()
            }
        }
    }

    private suspend fun handle(
        context: Context,
        tap: EveningTap,
    ) {
        val clock = Clock.systemDefaultZone()
        val account = SharedPrefsAccountStore(context).current()
        val db = MonReleveDatabase.get(context)
        val today = todayInParis(clock)
        // "Is the day already recorded?" the same way maybeNotifyEvening asks it: any recorded portion suppresses
        // (never nag/overwrite a recorded day), read via the DAO on this single-user device.
        val entries = db.entryDao().all()
        val hasEntry = entries.any { it.dayDate == tap.shownForDay }
        val decision = decideEveningTap(tap, account, today, hasEntry, deviceClaimNow(clock))
        when (decision) {
            is EveningTapResult.Record -> {
                // THE ONE REPOSITORY PATH (R206): the same writer, same stamping, as an in-app tap.
                val repository = LocalEntryRepository(db.entryDao(), clock, currentAccount = { account })
                if (repository.record(decision.command) is RecordResult.Recorded) {
                    SyncScheduler.requestSync(context)
                    EveningNotifier.postConfirmation(context, decision.command.kind.name, decision.command.dayDate)
                } else {
                    // AN-GRANULARITY (R492): refused - a half was recorded for the day between the check above and
                    // this write, and a whole day beside it would count the day twice. Nothing was written, so the
                    // notification never says « Enregistré »; it shows the day as it now stands instead.
                    onIgnored(context, EveningTapRefused.ALREADY_RECORDED, tap, db.entryDao().all())
                }
            }
            is EveningTapResult.Ignore -> onIgnored(context, decision.reason, tap, entries)
        }
    }

    // Section 3: a refused tap writes nothing. A stale tap over an existing entry shows the existing value; a
    // wrong-account or wrong-day tap dismisses the notification (R303 / the future-or-other-day rule).
    private fun onIgnored(
        context: Context,
        reason: EveningTapRefused,
        tap: EveningTap,
        entries: List<ch.monreleve.app.data.local.EntryEntity>,
    ) {
        when (reason) {
            EveningTapRefused.ALREADY_RECORDED -> {
                val existing = entries.firstOrNull { it.dayDate == tap.shownForDay && it.portion == Portion.FULL }
                if (existing != null) {
                    EveningNotifier.postConfirmation(context, existing.kind.name, existing.dayDate)
                } else {
                    EveningNotifier.cancel(context)
                }
            }
            EveningTapRefused.WRONG_ACCOUNT, EveningTapRefused.NOT_TODAY -> EveningNotifier.cancel(context)
        }
    }
}
