package ch.monreleve.app.ios

import ch.monreleve.app.data.sync.SyncOutcome
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

// IOS-1a R569. THE SYNC TRIGGER, WITHOUT A SCHEDULER YET. Android drains the queue from a WorkManager worker
// after a write; iOS has no scheduler in this task (BGTaskScheduler needs an app: iOS-1c). What exists is the
// part that does not: something that drains the queue AFTER A WRITE and WHEN ASKED (the app will ask on
// foreground).
//
//   drain       what one drain does - in the app, `buildSyncEngine(...).sync()`; a parameter so this is tested
//               with a fake and the real engine is not constructed here (it needs a session, an account, a cache).
//   SINGLE-FLIGHT. Two requests while a drain runs do not start two drains (two drains would post the same
//               batch twice - harmless by R219, but wasteful and racy for the stale flag): they are COALESCED
//               into exactly one more drain after the running one, so a write that lands DURING a drain is never
//               left behind it.
//   FAILURE LEAVES DAYS PENDING: Retryable and Unauthenticated are recorded in [lastOutcome] and nothing else
//               happens here - the rows are still PENDING in the database (SyncEngine's contract), a failure is
//               not retried in a loop, and rescheduling a retry is the scheduler's job (iOS-1c: Retryable ->
//               reschedule, Settled -> done, Unauthenticated -> done and NOT a retry).
//   CANCELLATION cancels: the drain runs in the caller's [scope]; cancelling the scope cancels it, and a drain
//               that was cancelled records no outcome. CancellationException is never swallowed.

class IosSyncTrigger(
    private val scope: CoroutineScope,
    private val drain: suspend () -> SyncOutcome,
) {
    private var running: Job? = null
    private var again = false

    /** What the last COMPLETED drain returned; null before the first one and after a cancelled one. */
    var lastOutcome: SyncOutcome? = null
        private set

    /** Called after a record is written. */
    fun afterWrite() = requestDrain()

    /** Called when the app asks (foreground). Returns the job of the drain that will cover this request. */
    fun requestDrain(): Job {
        val current = running
        if (current != null && current.isActive) {
            again = true
            return current
        }
        val job =
            scope.launch {
                do {
                    again = false
                    lastOutcome = null
                    lastOutcome = drain()
                } while (again)
            }
        running = job
        return job
    }

    // RED STUB (IOS-2f run 1): cancels nothing. Replaced at the R890 code step.

    /**
     * IOS-2f R890: the sign-out's cancelSync (Android's SyncScheduler.cancel). Stops the running drain and drops a
     * request coalesced behind it, so a drain cannot repopulate the queue the sign-out or the deletion is clearing.
     * The trigger stays usable: the next request starts a fresh drain.
     */
    fun cancel() = Unit
}
