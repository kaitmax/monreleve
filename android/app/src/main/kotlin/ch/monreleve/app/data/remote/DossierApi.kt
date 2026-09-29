package ch.monreleve.app.data.remote

import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.dossier.parseDossier

// AN11 increment 1. The read of GET /api/v1/dossier, through the session (SPEC 11.4, docs/api-v1.md
// section 8). It goes through SessionManager.authenticatedGet, so the R210 refresh-once-and-replay
// machinery covers it exactly as it covers /me and the entries read - one code path, no drift.
//
// IT NEVER LOGS THE BODY: the payload carries the titulaire's name (docs section 9's reason the name is
// returned by section 8 and nowhere else). The transport is already silent; this stays the same.

/** The outcome of asking the server for a year's dossier. */
sealed interface DossierResult {
    data class Loaded(val document: DossierDocument) : DossierResult

    /**
     * A non-401 response the client cannot turn into a document: a 4xx/5xx refusal envelope, or a body
     * that will not parse. The refusals (invalid_year, future_year, titulaire_missing) do not arise in
     * normal use - the app asks for the current year with a titulaire set - so they collapse to one
     * "the server did not return a document" state the screen offers to retry.
     */
    data object Unreadable : DossierResult

    /** Access expired and the refresh failed - an ordinary lapse (R210). */
    data object SessionExpired : DossierResult

    /** A replay ended the session (revoked/unknown on a still-held token), R210. */
    data object SessionEnded : DossierResult

    data object NoSession : DossierResult

    data object NetworkError : DossierResult
}

class DossierApi(private val session: SessionManager) {
    /**
     * Fetch and parse one year's dossier. A 2xx body is parsed; a parse failure (a refusal envelope has
     * no `taxYear`, so parseDossier throws) becomes [DossierResult.Unreadable] rather than a crash - a
     * half-parsed document is never returned.
     */
    suspend fun fetch(year: Int): DossierResult =
        when (val outcome = session.authenticatedGet("/api/v1/dossier?year=$year")) {
            is AuthedOutcome.Ok ->
                runCatching { parseDossier(outcome.body) }
                    .fold({ DossierResult.Loaded(it) }, { DossierResult.Unreadable })
            AuthedOutcome.SessionExpired -> DossierResult.SessionExpired
            AuthedOutcome.SessionEnded -> DossierResult.SessionEnded
            AuthedOutcome.NoSession -> DossierResult.NoSession
            AuthedOutcome.NetworkError -> DossierResult.NetworkError
        }
}
