package ch.monreleve.app.data.local

import android.content.Context

// AN11 increment 3 (R288, D22 / SPEC 13.2: "the app caches the last payload for offline viewing and marks
// it with its computation date"). The last dossier fetched, by year, as the RAW server body - so an offline
// reader still gets the document, dated, rather than a blank screen.
//
// IT STORES THE BYTES THE SERVER SENT, not a reconstruction. The generation date shown offline is the
// cached payload's own generatedAt (server-assigned), never the device's fetch time (R181) - which is why
// caching the raw body and re-parsing it is right: the date travels inside the bytes. A body that will not
// parse is not a cache (the caller discards it), so a corrupt entry can never be shown as a document.
//
// An interface so DossierApi is JVM-testable against a fake; the SharedPreferences implementation needs a
// device. This is not personal data leaving the device - it is the person's own document, on their own
// phone, and it is cleared with everything else on sign-out/account deletion (AN12).

interface DossierCache {
    /** The last cached body for [year], or null if none has been stored. */
    fun load(year: Int): String?

    /** Store the server's raw body for [year], replacing any previous copy. */
    fun save(
        year: Int,
        body: String,
    )

    /** Drop every cached year (account deletion / sign-out, AN12). */
    fun clear()
}

private const val DOSSIER_PREFS = "monreleve.dossier"

class SharedPrefsDossierCache(context: Context) : DossierCache {
    private val prefs = context.applicationContext.getSharedPreferences(DOSSIER_PREFS, Context.MODE_PRIVATE)

    override fun load(year: Int): String? = prefs.getString(key(year), null)

    override fun save(
        year: Int,
        body: String,
    ) {
        prefs.edit().putString(key(year), body).apply()
    }

    override fun clear() {
        prefs.edit().clear().apply()
    }

    private fun key(year: Int): String = "dossier.$year"
}
