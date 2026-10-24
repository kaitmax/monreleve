package ch.monreleve.app.detection

import android.content.Context
import android.content.SharedPreferences

// AN-AUTO increment 5 (R313). The "told once" flag for the near-border suggestion.
//
// R313 tells a near-border resident ONCE that detection is unreliable where they live and offers manual -
// respected either way (D19: manual is a peer, auto is never forced off). "Once" is a persisted boolean:
// once the person has been told, a later re-crossing of the threshold does not nag again. The decision of
// WHICH way they go (keep auto, or switch to manual in Parametres) is theirs; this only records that the
// one-time notice has been shown.
//
// IT SHARES THE DETECTION PREFS FILE (monreleve.detection), so SharedPrefsDetectionModeStore.clear() on
// sign-out and deletion wipes it with the mode and the sampling cursor (ErasureCensusTest covers that file
// name) - a new account on a shared device starts fresh and is told once, as they should be. Turning auto
// mode OFF does NOT clear it (stopSampling clears only the cursor): re-enabling auto must not re-nag.
//
// NO COORDINATE, by construction - it holds a single boolean. The near-border RULE (shouldSuggestManual...)
// reads only the aggregate tally (buffer-fix share), never a position.

/** Whether the one-time near-border notice has been shown to this account on this device. */
interface NearBorderNoticeStore {
    fun hasShown(): Boolean

    fun markShown()
}

/** The test/default in-memory store. */
class InMemoryNearBorderNoticeStore(private var shown: Boolean = false) : NearBorderNoticeStore {
    override fun hasShown(): Boolean = shown

    override fun markShown() {
        shown = true
    }
}

private const val DETECTION_PREFS = "monreleve.detection"
private const val KEY_NEAR_BORDER_SHOWN = "nearBorderNoticeShown"

class SharedPrefsNearBorderNoticeStore internal constructor(
    private val prefs: SharedPreferences,
) : NearBorderNoticeStore {
    // AN-FORCED-SIGNOUT (R527): the shared file as an argument, so a JVM test can read what a clear leaves of it.
    constructor(context: Context) : this(
        context.applicationContext.getSharedPreferences(DETECTION_PREFS, Context.MODE_PRIVATE),
    )

    override fun hasShown(): Boolean = prefs.getBoolean(KEY_NEAR_BORDER_SHOWN, false)

    override fun markShown() {
        prefs.edit().putBoolean(KEY_NEAR_BORDER_SHOWN, true).commit()
    }
}
