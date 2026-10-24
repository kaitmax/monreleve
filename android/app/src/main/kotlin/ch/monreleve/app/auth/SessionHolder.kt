package ch.monreleve.app.auth

import android.content.Context
import ch.monreleve.app.BuildConfig
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.UrlConnectionTransport

// AN-TOKEN-RACE (R507). ONE SessionManager PER PROCESS.
//
// WHY. SessionManager's single-flight refresh is a Mutex PER INSTANCE (KMP-3, R451): concurrent callers of ONE
// instance share one rotation. MainActivity built one, and SyncWorker built another on every drain - over the same
// Keystore prefs file - so a screen and the worker meeting an expired access token together each sent the same
// refresh token. The server answers the second as a replay and ends the whole session (tokens.ts, TOKEN_REPLAYED,
// R210): the person was signed out at random. TokenRaceTest reproduces it; this file is the cure.
//
// THE CENSUS (R507), every construction site in main and debug sources at 935c1ac, and what became of it:
//   MainActivity.kt:189               the screens' session                  -> processSession(context)
//   data/sync/SyncWorker.kt:41        every drain's (buildSyncEngine - the voluntary sign-out's bounded drain
//                                     calls it too)                         -> processSession(context)
//   dev/SignInProbeActivity.kt:50     the debug sign-in probe; MAIN sources, declared in the debug manifest
//                                     only                                  -> processSession(applicationContext)
//   src/debug                         none
// fences/OneSessionPerProcessFenceTest refuses any other construction of SessionManager or of a SessionHolder in
// main, debug or :shared commonMain sources.
//
// ONLY THE SessionManager IS THE PROCESS'S. Its Mutex is the state that matters. AuthApi and KeystoreTokenStore hold
// none of their own - every KeystoreTokenStore reads the one prefs file, which Android hands every caller in a process
// as the same object - so the sign-in screens keep building their own for the sign-in calls, and a token one of them
// saves is the token this session loads next.

/**
 * One SessionManager, built on first use under a lock and handed to every later caller. The locking is
 * MonReleveDatabase.get's - double-checked round a @Volatile field. The factory is an argument so a JVM test can hold
 * one over a fake transport and ask it from two sites, exactly as the app asks [processSession] from two.
 */
internal class SessionHolder {
    @Volatile
    private var instance: SessionManager? = null

    fun get(build: () -> SessionManager): SessionManager =
        instance ?: synchronized(this) { instance ?: build().also { instance = it } }
}

/** The process's ONE holder. */
private val processHolder = SessionHolder()

/**
 * THE PROCESS'S SessionManager: the screens', every sync drain's and the debug probe's. Only the first call reads
 * [context], for its application context - the Keystore prefs file is the application's, whoever asks.
 */
internal fun processSession(context: Context): SessionManager =
    processHolder.get {
        SessionManager(
            AuthApi(UrlConnectionTransport(), BuildConfig.API_BASE_URL),
            KeystoreTokenStore(context.applicationContext),
        )
    }
