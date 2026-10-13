package ch.monreleve.app.settings

import android.content.Context

// AN-RECON (R342). THE EMPLOYER FIGURE STAYS ON THE PHONE. The attestation rate the person types for a completed
// year is kept here - tagged with the account, per year - so it survives a background kill (R310) and returning
// to the screen, and NOTHING of it reaches the server (there is no /v1 field for it; EntriesWire omits it; sync
// never sees it). It is a PROJECTION input, not a record (R340).
//
// IT SHARES THE DETECTION PREFS FILE (monreleve.detection), the same home the detection mode, the evening opt-in
// and the threshold alert use, so DeviceLocalStore.clearForSignOut() -> SharedPrefsDetectionModeStore.clear()
// sweeps the whole file on sign-out and deletion (R289/R295/R303): a new account on a shared device inherits no
// figure. Keys are namespaced "employer.<accountTag>.<year>" so they cannot collide with the mode/alert/evening
// keys, and so one account's figure is invisible to another. ErasureCensusTest is the sweep's guard (it requires
// every "monreleve.*" store to be erased by deletion); EmployerFigureStoreTest proves the account-tagging.
//
// FAIL CLOSED (R303). With no active account the tag is null: figureFor returns null and save is a no-op, so an
// unresolved account never writes a figure a later account could read.

/** The employer attestation rate the current account entered for a given year - phone-only (R342). */
interface EmployerFigureStore {
    /** The rate saved for [year] under the active account, or null (no figure, or no active account). */
    fun figureFor(year: Int): Double?

    fun save(
        year: Int,
        rate: Double,
    )
}

/** The default for JVM tests and a safe fallback; the app injects the SharedPreferences store. */
class InMemoryEmployerFigureStore(
    private var account: String? = null,
    private val values: MutableMap<String, Double> = mutableMapOf(),
) : EmployerFigureStore {
    /** Test seam: switch the active account, as the magic-link callback does on the device. */
    fun setAccount(tag: String?) {
        account = tag
    }

    /** Test seam: simulate the sign-out sweep of the whole monreleve.detection file. */
    fun clearAll() {
        values.clear()
    }

    private fun keyFor(year: Int): String? = account?.let { "$it.$year" }

    override fun figureFor(year: Int): Double? = keyFor(year)?.let { values[it] }

    override fun save(
        year: Int,
        rate: Double,
    ) {
        keyFor(year)?.let { values[it] = rate }
    }
}

// Shares monreleve.detection (swept on sign-out, R289/R295). The account tag is supplied as a lambda rather than
// by importing AccountStore, so this file carries no dependency on account/. The rate is stored as a String (its
// plain decimal) so a two-decimal percentage keeps its precision; a missing key reads as null (no figure).
private const val EMPLOYER_PREFS = "monreleve.detection"

class SharedPrefsEmployerFigureStore(
    context: Context,
    private val accountTag: () -> String?,
) : EmployerFigureStore {
    private val prefs = context.applicationContext.getSharedPreferences(EMPLOYER_PREFS, Context.MODE_PRIVATE)

    private fun keyFor(year: Int): String? = accountTag()?.let { "employer.$it.$year" }

    override fun figureFor(year: Int): Double? {
        val key = keyFor(year) ?: return null
        return prefs.getString(key, null)?.toDoubleOrNull()
    }

    override fun save(
        year: Int,
        rate: Double,
    ) {
        val key = keyFor(year) ?: return
        prefs.edit().putString(key, rate.toString()).commit()
    }
}
