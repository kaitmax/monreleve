package ch.monreleve.app.releve

import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.remote.DossierResult
import ch.monreleve.app.dossier.DossierDocument
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
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

/** Why a load failed, so the screen shows the right sentence (an expiry reads differently from a replay). */
enum class ReleveError { SESSION_EXPIRED, SESSION_ENDED, NO_SESSION, NETWORK, SERVER }

class ReleveController(
    private val fetch: suspend (Int) -> DossierResult,
    private val taxYear: Int,
    private val scope: CoroutineScope,
) {
    private val mutableState = MutableStateFlow<ReleveState>(ReleveState.Loading)
    val state: StateFlow<ReleveState> = mutableState.asStateFlow()

    init {
        load()
    }

    /** Fetch (or refetch) the current year's dossier. Called on init and from the screen's retry. */
    fun load() {
        mutableState.value = ReleveState.Loading
        scope.launch {
            mutableState.value = toState(fetch(taxYear))
        }
    }

    private fun rulesFor(document: DossierDocument): ReleveRules {
        val rules = ruleSetFor(document.taxYear)
        return ReleveRules(rules.fiscalCeiling, rules.socialCeiling, rules.simplifiedBasisDays)
    }

    private fun toState(result: DossierResult): ReleveState =
        when (result) {
            is DossierResult.Loaded ->
                ReleveState.Loaded(result.document, rulesFor(result.document), pendingCount = 0, offline = false)
            DossierResult.Unreadable -> ReleveState.Failed(ReleveError.SERVER)
            DossierResult.SessionExpired -> ReleveState.Failed(ReleveError.SESSION_EXPIRED)
            DossierResult.SessionEnded -> ReleveState.Failed(ReleveError.SESSION_ENDED)
            DossierResult.NoSession -> ReleveState.Failed(ReleveError.NO_SESSION)
            DossierResult.NetworkError -> ReleveState.Failed(ReleveError.NETWORK)
        }
}
