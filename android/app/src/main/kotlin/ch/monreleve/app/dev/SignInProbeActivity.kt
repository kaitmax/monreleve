package ch.monreleve.app.dev

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.BuildConfig
import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.auth.KeystoreTokenStore
import ch.monreleve.app.auth.RefreshOutcome
import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.ME_PATH
import ch.monreleve.app.data.remote.UrlConnectionTransport
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.ProbeCopy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

// AN4 increment 6. The AC1 walkthrough instrument for the steps with no production
// screen yet (the signed-in area is AN5): after the real callback has stored a
// token, this drives SessionManager against `pnpm dev` - an authenticated call,
// a refresh, another authenticated call, sign-out, and a final call that must be
// refused - and renders each outcome so the walkthrough can screenshot and read
// it. Dev-only (no LAUNCHER, reached by adb naming the component), the same
// pattern as GalleryActivity. No string literal here (fence 4): every word is
// ProbeCopy, the one path is ME_PATH.

internal data class ProbeRow(val step: String, val outcome: String)

class SignInProbeActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val session =
            SessionManager(
                AuthApi(UrlConnectionTransport(), BuildConfig.API_BASE_URL),
                KeystoreTokenStore(applicationContext),
            )
        val rows = MutableStateFlow<List<ProbeRow>>(emptyList())
        lifecycleScope.launch { runProbe(session, rows) }
        setContent {
            FrontierTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    ProbeScreen(rows.collectAsState().value)
                }
            }
        }
    }
}

private suspend fun runProbe(
    session: SessionManager,
    rows: MutableStateFlow<List<ProbeRow>>,
) {
    val log = mutableListOf<ProbeRow>()

    fun record(
        step: String,
        outcome: String,
    ) {
        log.add(ProbeRow(step, outcome))
        rows.value = log.toList()
    }
    record(ProbeCopy.STEP_AUTHED, authedLabel(session.authenticatedGet(ME_PATH)))
    record(ProbeCopy.STEP_REFRESH, refreshLabel(session.refresh()))
    record(ProbeCopy.STEP_AUTHED_AFTER, authedLabel(session.authenticatedGet(ME_PATH)))
    session.signOut()
    record(ProbeCopy.STEP_SIGN_OUT, ProbeCopy.OUTCOME_DONE)
    record(ProbeCopy.STEP_REFUSED, authedLabel(session.authenticatedGet(ME_PATH)))
}

private fun authedLabel(outcome: AuthedOutcome): String =
    when (outcome) {
        is AuthedOutcome.Ok -> ProbeCopy.OUTCOME_OK
        AuthedOutcome.SessionExpired -> ProbeCopy.OUTCOME_EXPIRED
        AuthedOutcome.SessionEnded -> ProbeCopy.OUTCOME_ENDED
        AuthedOutcome.NoSession -> ProbeCopy.OUTCOME_REFUSED
        AuthedOutcome.NetworkError -> ProbeCopy.OUTCOME_NETWORK
    }

private fun refreshLabel(outcome: RefreshOutcome): String =
    when (outcome) {
        is RefreshOutcome.Refreshed -> ProbeCopy.OUTCOME_REFRESHED
        RefreshOutcome.Expired -> ProbeCopy.OUTCOME_EXPIRED
        RefreshOutcome.NoSession -> ProbeCopy.OUTCOME_REFUSED
        RefreshOutcome.NetworkError -> ProbeCopy.OUTCOME_NETWORK
    }

@Composable
private fun ProbeScreen(rows: List<ProbeRow>) {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space12),
    ) {
        Text(text = ProbeCopy.TITLE, style = FrontierType.h2)
        rows.forEach { row ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(text = row.step, style = FrontierType.body)
                Text(text = row.outcome, style = FrontierType.bodyM)
            }
        }
    }
}
