package ch.monreleve.app.releve

import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.dossier.pendingEntriesForYear
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// AN11 increment 1 (SPEC 11.4). The Releve screen's state, and the controller that fills it from the
// SERVER's dossier. It lives OUTSIDE ui/ (fence 5): it holds the fetch seam, and the screen reads a plain
// ReleveState. The fetch is a lambda (suspend (Int) -> DossierResult), the same seam idiom as
// AujourdhuiController's requestSync - so MainGraphWiringTest can build the graph with a stub and a JVM
// test can drive the controller against a scripted fetch without a real session or network.
//
// THE DEVICE NEVER RECOMPUTES A FIGURE THE SERVER PROVIDES (FW12). ReleveState.Loaded carries the parsed
// DossierDocument verbatim; the screen renders its fields. The controller reads the year's RuleSet for the
// two ceilings and the simplified basis - the only figures the zone payload does NOT carry - so the screen
// stays free of the engine (the AujourdhuiScreen pattern: thresholds arrive from the controller, R181).
//
// pendingCount (R287) and offline (R288) land in increments 2 and 3; increment 1 fetches and renders.

/**
 * The RuleSet figures the zone payload does not carry: the two ceilings (fractions, for the rail and the
 * band test) and the simplified basis (for the method line). From the year's RuleSet, never typed (R153).
 */
data class ReleveRules(
    val fiscalCeiling: Double,
    val socialCeiling: Double,
    val simplifiedBasisDays: Int,
)

sealed interface ReleveState {
    data object Loading : ReleveState

    data class Loaded(
        val document: DossierDocument,
        val rules: ReleveRules,
        /** R287: days recorded on this device not yet synced, so absent from this server document. */
        val pendingCount: Int,
        /** R288: true when this is the last cached copy, shown offline with its generation date. */
        val offline: Boolean,
    ) : ReleveState

    data class Failed(val reason: ReleveError) : ReleveState
}

private const val HTTP_OK = 200
private const val HTTP_OK_MAX = 299

/** Why a load failed, so the screen shows the right sentence (an expiry reads differently from a replay). */
enum class ReleveError { SESSION_EXPIRED, SESSION_ENDED, NO_SESSION, NETWORK, SERVER }

/** The two documents a person can export (AC2). Each is a server render fetched as bytes. */
enum class ExportKind { PDF, CSV }

/**
 * The result of an export tap, as a one-shot event for the composition root to act on. Ready carries plain
 * types (not a data-layer DTO), so the UI can hand the file to the platform without importing data/remote
 * (fence 5). RequiresConnectivity is SPEC 13.2's "export requires connectivity, and says so".
 */
sealed interface ExportEvent {
    data class Ready(
        val bytes: ByteArray,
        val filename: String,
        val mimeType: String,
    ) : ExportEvent {
        override fun equals(other: Any?): Boolean {
            if (this === other) return true
            if (other !is Ready) return false
            return bytes.contentEquals(other.bytes) && filename == other.filename && mimeType == other.mimeType
        }

        override fun hashCode(): Int = 31 * (31 * bytes.contentHashCode() + filename.hashCode()) + mimeType.hashCode()
    }

    /** SPEC 13.2: the server render could not be reached; the export needs a connection. */
    data object RequiresConnectivity : ExportEvent

    /** The server refused or the session is dead: the file could not be produced. */
    data object Failed : ExportEvent
}

class ReleveController(
    private val fetch: suspend (Int) -> DossierResult,
    private val exportBytes: suspend (String) -> BytesOutcome,
    private val repository: EntryRepository,
    private val taxYear: Int,
    private val scope: CoroutineScope,
) {
    // One-shot export events (Channel, not a StateFlow): handing a file to the share sheet is an action that
    // happens once per tap, never a state that re-fires on recomposition.
    private val exportChannel = Channel<ExportEvent>(Channel.BUFFERED)
    val exportEvents: Flow<ExportEvent> = exportChannel.receiveAsFlow()
    private val mutableState = MutableStateFlow<ReleveState>(ReleveState.Loading)
    val state: StateFlow<ReleveState> = mutableState.asStateFlow()

    // R287: the count of days recorded on this device but not yet synced, so absent from the server's
    // document. Observed live from the repository (the one home, R206), and folded into a Loaded state as it
    // changes - a day draining to the server lowers the count on screen without a refetch.
    private var pendingCount = 0

    init {
        scope.launch {
            repository.observeAll().collect { entries ->
                pendingCount = pendingEntriesForYear(entries, taxYear).size
                mutableState.update { current ->
                    if (current is ReleveState.Loaded) current.copy(pendingCount = pendingCount) else current
                }
            }
        }
        load()
    }

    /** Fetch (or refetch) the current year's dossier. Called on init and from the screen's retry. */
    fun load() {
        mutableState.value = ReleveState.Loading
        scope.launch {
            mutableState.value = toState(fetch(taxYear))
        }
    }

    /**
     * Export the PDF or CSV (AC2). Fetches the server render as bytes through the session (R210 handling
     * included) and emits a one-shot event the composition root hands to the platform share sheet (R136).
     * The PDF is rendered by the server's Chromium (SPEC 12), never by the device.
     */
    fun export(kind: ExportKind) {
        scope.launch {
            exportChannel.send(toExportEvent(kind, exportBytes(pathFor(kind))))
        }
    }

    private fun pathFor(kind: ExportKind): String =
        when (kind) {
            ExportKind.PDF -> "/api/v1/export/pdf?year=$taxYear"
            ExportKind.CSV -> "/api/v1/export/csv?year=$taxYear"
        }

    private fun toExportEvent(
        kind: ExportKind,
        outcome: BytesOutcome,
    ): ExportEvent =
        when (outcome) {
            is BytesOutcome.Ok ->
                if (outcome.status in HTTP_OK..HTTP_OK_MAX) {
                    ExportEvent.Ready(
                        bytes = outcome.export.bytes,
                        // R237: the server's Content-Disposition filename, or a year-named fallback if absent.
                        filename = outcome.export.filename ?: fallbackFilename(kind),
                        mimeType = mimeFor(kind),
                    )
                } else {
                    // A 503 renderer error / 422 titulaire_missing: the file could not be produced.
                    ExportEvent.Failed
                }
            // SPEC 13.2: the render could not be reached - the export needs a connection.
            BytesOutcome.NetworkError -> ExportEvent.RequiresConnectivity
            BytesOutcome.SessionExpired, BytesOutcome.SessionEnded, BytesOutcome.NoSession -> ExportEvent.Failed
        }

    private fun mimeFor(kind: ExportKind): String =
        when (kind) {
            ExportKind.PDF -> "application/pdf"
            ExportKind.CSV -> "text/csv"
        }

    private fun fallbackFilename(kind: ExportKind): String =
        when (kind) {
            ExportKind.PDF -> "releve-$taxYear.pdf"
            ExportKind.CSV -> "releve-$taxYear.csv"
        }

    private fun rulesFor(document: DossierDocument): ReleveRules {
        val rules = ruleSetFor(document.taxYear)
        return ReleveRules(rules.fiscalCeiling, rules.socialCeiling, rules.simplifiedBasisDays)
    }

    private fun toState(result: DossierResult): ReleveState =
        when (result) {
            is DossierResult.Loaded ->
                ReleveState.Loaded(result.document, rulesFor(result.document), pendingCount, offline = false)
            is DossierResult.Cached ->
                ReleveState.Loaded(result.document, rulesFor(result.document), pendingCount, offline = true)
            DossierResult.Unreadable -> ReleveState.Failed(ReleveError.SERVER)
            DossierResult.SessionExpired -> ReleveState.Failed(ReleveError.SESSION_EXPIRED)
            DossierResult.SessionEnded -> ReleveState.Failed(ReleveError.SESSION_ENDED)
            DossierResult.NoSession -> ReleveState.Failed(ReleveError.NO_SESSION)
            DossierResult.NetworkError -> ReleveState.Failed(ReleveError.NETWORK)
        }
}
