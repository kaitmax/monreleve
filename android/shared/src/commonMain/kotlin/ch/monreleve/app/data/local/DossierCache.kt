package ch.monreleve.app.data.local

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
//
// KMP-3 (R446): the CONTRACT moved to :shared commonMain and the Android implementation stayed, as
// :app's data/local/SharedPrefsDossierCache.kt. Package unchanged (R368), so no import in :app moved.
// The preferences file name, the "dossier.<year>" key and the raw-body value did not change by a
// character - which is what lets an already-cached year be read back after an upgrade in place (R448).

/**
 * The device's copy of the last releve the server sent, one entry per tax year.
 *
 * KMP-3 (R447): this contract is written to be implemented from the text alone, because iOS
 * will be. Anything an implementer would otherwise infer from the Android class below is
 * stated here instead.
 *
 * ## What an implementation must guarantee
 *
 * **It stores the server's bytes verbatim.** The value is the response body as received -
 * not a re-encoding, not a parsed object put back together. The generation date an offline
 * reader sees is the payload's own server-assigned `generatedAt`, which travels INSIDE
 * those bytes, and the device's own fetch time must never stand in for it (R181).
 *
 * **[load] returns null for a year that was never saved**, even when other years were.
 * Null means "there is no offline copy", which is what makes the caller show a network
 * error instead of a blank document.
 *
 * **[save] replaces that year's entry and leaves every other year alone.** Years are
 * independent: refreshing 2026 must not drop a cached 2025.
 *
 * **[clear] erases EVERY year**, not the current one. It runs on sign-out and on account
 * deletion, where the point is that nothing of one person's document outlives them on a
 * shared device (R295/R289). [clear] on an empty cache is a no-op and must not throw.
 *
 * **Durability is weaker here than for the token store, deliberately.** A cached document
 * lost to a process death costs a network round trip, not a sign-out, so this does not
 * need TokenStore's written-before-return guarantee. It must still survive an ordinary app
 * restart, which is the whole point of caching it.
 *
 * ## What an implementation must never do
 *
 * It must not log or transmit the body: the payload carries the titulaire's name, which
 * GET /api/v1/me deliberately omits and which exists in this one response for this one
 * purpose. It must not repair, normalise or re-serialise a stored body - a body that will
 * not parse is discarded by the caller, never shown half-read.
 */
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
