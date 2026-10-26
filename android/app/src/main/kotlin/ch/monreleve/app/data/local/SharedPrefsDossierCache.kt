package ch.monreleve.app.data.local

import android.content.Context

// AN11 increment 3 (R288, D22 / SPEC 13.2). The Android implementation of DossierCache,
// whose contract moved to :shared commonMain in KMP-3 (R446/R447).
//
// WHY THIS FILE EXISTS AT ALL, rather than the interface and the implementation travelling
// together: the contract is what iOS implements and the implementation is what this
// platform happens to use. SharedPreferences is a Context API, so it cannot follow - and
// dragging it across was never the point (R372). The split is the deliverable.
//
// NOTHING HERE CHANGED IN THE MOVE. The preferences file is still monreleve.dossier, the
// key is still "dossier.<year>", and the value is still the server's raw body. Those three
// facts are what an upgrade in place rests on - an already-cached year is read back by
// exactly this key - and OnDeviceFormatGoldenTest pins all three against what was read off
// a running phone before anything moved (R448).
//
// apply(), not commit(), and the contract says why it is allowed to be the weaker one: a
// cached document lost to a process death costs a network round trip, not a sign-out.

private const val DOSSIER_PREFS = "monreleve.dossier"

class SharedPrefsDossierCache(context: Context) : DossierCache {
    private val prefs = context.applicationContext.getSharedPreferences(DOSSIER_PREFS, Context.MODE_PRIVATE)

    override fun load(year: Int): String? = prefs.getString(key(year), null)

    // R559: the body and its stale flag change in ONE edit, so a reader never sees the new body still flagged.
    override fun save(
        year: Int,
        body: String,
    ) {
        prefs.edit().putString(key(year), body).remove(staleKey(year)).apply()
    }

    override fun clear() {
        prefs.edit().clear().apply()
    }

    // AN-RELEVE-FRESH (R559). The flag is its OWN key beside the body, so "dossier.<year>" and its raw value are
    // untouched (R448: a copy cached before this build reads back exactly as it did, and reads as not stale).
    // Shared across instances because Android hands every caller in the process the same SharedPreferences
    // object for a file name - the sync worker's instance and the screen's see one map, which the contract asks.
    override fun markStale(year: Int) {
        prefs.edit().putBoolean(staleKey(year), true).apply()
    }

    override fun isStale(year: Int): Boolean = prefs.getBoolean(staleKey(year), false)

    private fun key(year: Int): String = "dossier.$year"

    private fun staleKey(year: Int): String = "stale.$year"
}
