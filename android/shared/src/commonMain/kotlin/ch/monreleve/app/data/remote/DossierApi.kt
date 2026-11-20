package ch.monreleve.app.data.remote

import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.data.local.DossierCache
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.dossier.parseDossier

// KMP-3 (R446): MOVED WHOLE to :shared commonMain - the class AND DossierResult - which closes two
// entries at once. KMP-1 PARKED DossierResult ("stays in :app with DossierApi; move it with the
// shared-controller work in KMP-2") and KMP-2's deviation 2 then kept the whole file back, reading
// R379's "DossierApi.kt's pure parts" as the PARSE alone because the class orchestrates AuthedOutcome
// and the DossierCache seam, both of which were still in :app. Both of those arrived in this task -
// AuthedOutcome with SessionManager, DossierCache's contract one commit ago - so the reason lapsed and
// the file came whole. Package unchanged (R368); no import in :app moved.
//
// AN11 increments 1, 3. The read of GET /api/v1/dossier, through the session (SPEC 11.4, docs/api-v1.md
// section 8), with the R288 offline cache around it. The authenticated GET is a seam (suspend (String) ->
// AuthedOutcome, i.e. SessionManager::authenticatedGet in the app) so this is JVM-testable against a
// scripted response and a fake cache, without a real session or network. The R210 refresh-once-and-replay
// machinery lives in SessionManager, so it covers this read exactly as it covers /me and the entries read.
//
// IT NEVER LOGS THE BODY: the payload carries the titulaire's name (docs section 9's reason the name is
// returned by section 8 and nowhere else). The transport is already silent; this stays the same.
//
// R288: a successful fetch is CACHED (the raw body); a NETWORK failure falls back to that cache, shown as a
// DATED copy. A session failure does NOT fall back - the problem is the session, not connectivity, and a
// stale document behind a dead session would mislead. A body that will not parse is neither returned nor
// cached (a half-parsed document is never shown).

/** The statuses that mean the server served the document. */
private val HTTP_SUCCESS = 200..299

/** The outcome of asking the server for a year's dossier. */
sealed interface DossierResult {
    data class Loaded(val document: DossierDocument) : DossierResult

    /** R288: the network was unavailable and the last cached copy was served instead - shown dated. */
    data class Cached(val document: DossierDocument) : DossierResult

    /**
     * A non-401 response the client cannot turn into a document: a 4xx/5xx refusal envelope, or a body
     * that will not parse. The refusals (invalid_year, future_year, titulaire_missing) do not arise in
     * normal use - the app asks for the current year with a titulaire set - so they collapse to one
     * "the server did not return a document" state the screen offers to retry.
     */
    data object Unreadable : DossierResult

    /** Access expired and the refresh failed - an ordinary lapse (R210). Not an offline case. */
    data object SessionExpired : DossierResult

    /** A replay ended the session (revoked/unknown on a still-held token), R210. Not an offline case. */
    data object SessionEnded : DossierResult

    data object NoSession : DossierResult

    /** The network was unavailable and there was no usable cache to fall back to. */
    data object NetworkError : DossierResult
}

class DossierApi(
    private val get: suspend (String) -> AuthedOutcome,
    private val cache: DossierCache,
) {
    /**
     * Fetch and parse one year's dossier. A 2xx body is parsed and cached; a parse failure becomes
     * [DossierResult.Unreadable] (and is not cached). A network failure falls back to the last cached copy
     * as [DossierResult.Cached], or [DossierResult.NetworkError] when there is none.
     *
     * AN-STATUS-HONESTY (R1191): a non-2xx is [DossierResult.Unreadable] WITHOUT reading its body - the status
     * decides, not the body's shape. It used to be parsed like a 200, so a refusal was kept out only by failing to
     * parse; one whose body happened to read as a dossier would have been shown and cached as the year. Not a
     * cache fallback either: the server answered, and a refusal is not an outage.
     */
    suspend fun fetch(year: Int): DossierResult =
        when (val outcome = get("/api/v1/dossier?year=$year")) {
            is AuthedOutcome.Ok ->
                if (outcome.status in HTTP_SUCCESS) parseAndCache(year, outcome.body) else DossierResult.Unreadable
            AuthedOutcome.NetworkError -> fromCache(year)
            AuthedOutcome.SessionExpired -> DossierResult.SessionExpired
            AuthedOutcome.SessionEnded -> DossierResult.SessionEnded
            AuthedOutcome.NoSession -> DossierResult.NoSession
        }

    /**
     * AN-RELEVE-FRESH (R560): the cached copy of [year], parsed, WHEN the cache is marked stale (R559) - the
     * figures a screen shows at once while it fetches the server's current record. Null when the year is not
     * stale (no refresh is due), or when there is no copy that parses (nothing to show meanwhile). No network.
     */
    fun staleCopy(year: Int): DossierDocument? {
        val cached = if (cache.isStale(year)) cache.load(year) else null
        return cached?.let { body -> runCatching { parseDossier(body) }.getOrNull() }
    }

    private fun parseAndCache(
        year: Int,
        body: String,
    ): DossierResult =
        runCatching { parseDossier(body) }
            .fold(
                onSuccess = { document ->
                    cache.save(year, body)
                    DossierResult.Loaded(document)
                },
                onFailure = { DossierResult.Unreadable },
            )

    private fun fromCache(year: Int): DossierResult {
        val cached = cache.load(year) ?: return DossierResult.NetworkError
        return runCatching { parseDossier(cached) }
            .fold(
                onSuccess = { DossierResult.Cached(it) },
                onFailure = { DossierResult.NetworkError },
            )
    }
}
