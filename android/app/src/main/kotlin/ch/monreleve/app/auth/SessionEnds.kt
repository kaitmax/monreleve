package ch.monreleve.app.auth

import ch.monreleve.app.account.DeviceLocalStore
import ch.monreleve.app.data.local.EntryEntity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

// AN-FORCED-SIGNOUT (R520). A SIGN-OUT NOBODY ASKED FOR LANDS ON SIGN-IN, AND SAYS HOW MANY DAYS WAIT.
//
// WHAT WAS WRONG (PARK-T1, seen on the S9 by AN-TOKEN-RACE). When the server ended the session - a refused refresh, a
// replay, a revoke-all - SessionManager cleared the tokens and nothing else (R508), which keeps the days. But nothing
// moved the person: the shell stayed open on screens that could no longer reach the server, and its only exit was
// Parametres' « Se déconnecter » - the VOLUNTARY sign-out, whose send has no session to send with, so it warned and,
// confirmed, WIPED the days the forced sign-out had just kept.
//
// THE SIGNAL. SessionManager tells its owner when, and only when, the SERVER ended the session (its onEnded - the three
// forced clears, never the voluntary wipe). The process's session (SessionHolder.kt) records each ending here, and the
// shell collects this and leaves for sign-in (destinationAfterSessionEnd). One counter per process, because there is
// one session per process (R507) and WorkManager runs in it - so an ending the worker meets in the background moves a
// shell that is open in the foreground.
//
// THE STATE IS NOT STORED, AND DOES NOT NEED TO BE (R181). A session the server ended keeps its account tag and loses
// its tokens (R508). A voluntary sign-out and a deletion clear the tag with everything else (R295/R289); a fresh
// install never had one. So "not signed in, an account still current" IS the forced state, readable at any launch,
// whether or not this process saw the ending happen.

/** Every session the server ended in this process, counted - the shell reacts to each new value. */
internal class SessionEnds {
    private val count = MutableStateFlow(0)

    val ends: StateFlow<Int> = count.asStateFlow()

    fun record() {
        count.update { it + 1 }
    }
}

/** THE PROCESS'S record of server-ended sessions, beside its one session (SessionHolder.kt). */
internal val processSessionEnds = SessionEnds()

/**
 * WHAT THE PROCESS DOES WHEN THE SERVER ENDS ITS SESSION - SessionManager's onEnded, for the process's session
 * (SessionHolder.kt) and for every test device built the way the app is. R521's clear FIRST, so a shell that the
 * signal moves to sign-in finds the settings and the cached releve already gone; then the signal (R520).
 */
internal suspend fun onServerEndedSession(
    store: DeviceLocalStore,
    ends: SessionEnds,
) {
    store.clearForSessionEnd()
    ends.record()
}

/**
 * R520: is this the state a sign-out nobody asked for leaves behind - no session, yet an account still current?
 * Both are read by the caller when it asks, never captured (R423).
 */
internal fun sessionClosedByServer(
    signedIn: Boolean,
    currentAccount: String?,
): Boolean = !signedIn && currentAccount != null

/**
 * R520: the number of DAYS the sign-in notice names, from the current account's PENDING rows (observePending - the
 * account's own, never another's, R303). DISTINCT dates, because half-day mode writes two rows for one date
 * (ParametresController.pendingDatesNow counts the same way, for the same reason).
 */
internal fun heldDays(accountPending: List<EntryEntity>): Int = accountPending.map { it.dayDate }.distinct().size
