package ch.monreleve.app.ios

import ch.monreleve.app.account.AccountStore
import ch.monreleve.app.auth.AuthenticatedPoster
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.sync.SyncEngine
import ch.monreleve.app.data.sync.SyncOutcome

// IOS-2f R890. THE SYNC LOGIC THAT NEEDS NO SCHEDULER - Android's SyncWorker.kt minus WorkManager.
//
//   iosSyncDrain   Android's buildSyncEngine(context).sync(): ONE drain of the current account's queue through the
//                  shared SyncEngine. The account is read from the AccountStore WHEN THE DRAIN RUNS, never when the
//                  drain is built (R303: a drain scoped to whoever was signed in at construction would send one
//                  account's queue under another's token); a null account drains nothing (SyncEngine's own rule).
//                  The session is the process's ONE session, passed in, never built here (AN-TOKEN-RACE R507: a second
//                  session racing the screens' refresh replays a token and the server ends the session, R210).
//                  The cache is the one the Releve reads, so a year this drain sends is marked stale there (R559).
//                  It is also iOS's syncNow, as buildSyncEngine(context).sync() is Android's: called directly, so the
//                  caller's bound (Parametres' R440 send, eight seconds) cancels it, and outside the trigger's
//                  single-flight exactly as Android's syncNow runs outside WorkManager's unique work.
//   syncFollowUp   Android's SyncWorker.doWork mapping, the one decision a scheduler makes after a drain: Settled is
//                  DONE (client defects are held FAILED, and retrying a refused payload can never succeed, R198);
//                  Retryable is RETRY_LATER (the network or a garbled 200 - backoff); Unauthenticated is DONE and is
//                  NEVER a retry (no session: the rows stay PENDING, tagged, and the next sign-in sends them, R509 -
//                  retrying would back off forever against an absent session).
// The SCHEDULING itself (BGTaskScheduler: registration, the request, the network precondition, the backoff) needs the
// app host and is PARKED to IOS-1b-B (R893); it calls these two.

// RED STUB (IOS-2f run 1): reads the account ONCE, when the drain is built - the R303 defect the test exists to catch.

/** One drain of the account signed in WHEN IT RUNS - Android's buildSyncEngine(context).sync(), and iOS's syncNow. */
fun iosSyncDrain(
    dao: EntryDao,
    session: AuthenticatedPoster,
    accountStore: AccountStore,
    dossierCache: DossierCache,
): suspend () -> SyncOutcome {
    val accountAtBuild = accountStore.current()
    return { SyncEngine(dao, session, accountAtBuild, dossierCache).sync() }
}

/** What a scheduler does once a drain has returned. */
enum class SyncFollowUp {
    /** Nothing more for this request: drained, or nothing a retry could fix. */
    DONE,

    /** A transient fault: the rows are still PENDING; try again later, with backoff. */
    RETRY_LATER,
}

// RED STUB (IOS-2f run 1): never asks for a retry.

/** SyncWorker.doWork's mapping (Settled -> success, Retryable -> retry, Unauthenticated -> success, never retried). */
@Suppress("UnusedParameter")
fun syncFollowUp(outcome: SyncOutcome): SyncFollowUp = SyncFollowUp.DONE
