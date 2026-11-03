package ch.monreleve.app.auth

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withTimeoutOrNull

// AN-TOKEN-RACE (R509). A SIGN-OUT NOBODY ASKED FOR KEEPS THE DAYS, AND THE NEXT SIGN-IN SENDS THEM.
//
// A session the server ends - a refused refresh, TOKEN_REPLAYED - clears the tokens and nothing else (R508): the
// account's unsent days stay on the phone, PENDING, tagged with that account. Nothing sent them back up, though. A
// drain was only ever requested by recording a day, so after signing back in the days sat until the next tap
// (AN-PULL's NOTICED 3). Now the sign-in itself sends them - by code (CodeController) and by link
// (CallbackController), the two ways in - through the SAME drain the worker runs (buildSyncEngine, R206).
//
// IN THE SIGN-IN, BEFORE IT REPORTS SIGNED - NOT A WorkManager REQUEST, and the order is the point. SIGNED is what
// sends the code screen to RESOLVING, and RESOLVING brings the account's years down (R481). A drain racing that
// download can land between its GET and its write, and the year written over the just-sent day is the server's
// OLDER copy: the server right, the phone showing the old value. Sent first, the year that comes down already holds
// it. Sent and refused, the day is still PENDING when the year arrives, and R483 keeps it.
//
// AFTER THE ACCOUNT IS SET, and that order matters as much. The drain reads the current account (buildSyncEngine);
// read before the sign-in set it, a sign-in by ANOTHER account would post the previous one's days under the new
// token - the exact thing R303 forbids. ForcedSignOutTest's other-account case is the guard.
//
// BOUNDED, AND IT NEVER FAILS THE SIGN-IN - R440's reasoning, one door over. The timeout is a ceiling on a person
// waiting at the code screen, not a network budget: UrlConnectionTransport would otherwise hold them for its own
// fifteen-plus-fifteen seconds. A send that fails or times out leaves its rows PENDING, where they already were, and
// the next drain takes them. With nothing pending the drain is one local read and no request at all.
//
// IOS-2a R768: MOVED TO :shared commonMain, unedited otherwise, with the two controllers that call it.

/** How long a sign-in waits for its held days to go up. R440's bound for the sign-out's send, for the same reasons. */
internal const val SIGN_IN_SYNC_TIMEOUT_MS = 8_000L

/**
 * R509: send what this phone holds for the account that has just signed in, through [syncNow] - bounded, and never
 * failing the sign-in. A cancelled sign-in stays cancelled.
 */
internal suspend fun sendHeldDays(syncNow: suspend () -> Unit) {
    withTimeoutOrNull(SIGN_IN_SYNC_TIMEOUT_MS) {
        // runCatching, because an offline drain THROWS rather than returning; cancellation is re-thrown (KMP-1b).
        runCatching { syncNow() }.onFailure { if (it is CancellationException) throw it }
    }
}
