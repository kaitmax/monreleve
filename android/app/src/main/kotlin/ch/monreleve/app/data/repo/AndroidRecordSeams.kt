package ch.monreleve.app.data.repo

import android.util.Log
import ch.monreleve.app.BuildConfig
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.toKotlinClock
import kotlinx.datetime.toKotlinTimeZone
import java.time.Clock
import java.util.UUID

// KMP-4 (R463). :app'S HALF OF THE RECORD PATH'S SEAMS - the one place a reader sees what Android passes.
//
// LocalEntryRepository takes every platform fact as a seam: a kotlinx-datetime Clock, the device's TimeZone,
// a reporter for R425's "UNOWNED while signed in" canary, and a mutation-id mint. This file is Android's
// answer to each, and it is the SAME answer the repository used to give itself:
//
//   the clock    the java.time.Clock the caller built, adapted to an instant source (toKotlinClock)
//   the zone     that SAME clock's zone - the one the claim's offset always came from
//   the canary   check(!BuildConfig.DEBUG) { complaint }; Log.e("EntryRepository", complaint) - verbatim
//   the mint     java.util.UUID, as before
//
// WHY A FUNCTION NAMED LIKE THE CLASS. It keeps the constructor :app always called - (dao, java.time.Clock,
// currentAccount, isSignedIn, newMutationId), same order, same defaults - so the three production call sites
// (MainActivity, DevRecorderActivity, EveningActionReceiver) and the fourteen test files that build the
// repository compile UNEDITED. Overload resolution cannot confuse the two: this takes a java.time.Clock, the
// class takes a kotlinx one. An iOS app builds the class with its own four answers.

/**
 * The record repository, built the way :app always built it: [clock] supplies both the instant and the
 * device's zone, R425's canary crashes a debug build and logs in release, and each tap mints a UUID.
 */
fun LocalEntryRepository(
    dao: EntryDao,
    clock: Clock,
    currentAccount: () -> String? = { null },
    isSignedIn: () -> Boolean = { false },
    newMutationId: () -> String = { UUID.randomUUID().toString() },
): LocalEntryRepository =
    LocalEntryRepository(
        dao = dao,
        clock = clock.toKotlinClock(),
        deviceZone = clock.zone.toKotlinTimeZone(),
        currentAccount = currentAccount,
        isSignedIn = isSignedIn,
        reportUnownedWhileSignedIn = ::reportUnownedWhileSignedIn,
        newMutationId = newMutationId,
    )

/**
 * R425's canary, Android's way: DEBUG CRASHES, RELEASE LOGS. A reader's day is not worth losing to keep an
 * app alive, but neither is crashing somebody mid-record in the field over a condition they cannot act on.
 * The log names the condition so it is findable either way. These are the two lines record() held before
 * KMP-4, moved here unchanged; AccountScopeTest catches the debug crash BY TYPE (IllegalStateException).
 */
internal fun reportUnownedWhileSignedIn(complaint: String) {
    check(!BuildConfig.DEBUG) { complaint }
    Log.e("EntryRepository", complaint)
}
