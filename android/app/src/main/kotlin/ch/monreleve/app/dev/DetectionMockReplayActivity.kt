package ch.monreleve.app.dev

import android.location.LocationManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.detection.DetectionOutcome
import ch.monreleve.app.detection.SyntheticTracks
import ch.monreleve.app.detection.computeProposal
import ch.monreleve.app.detection.detectionOutcome
import ch.monreleve.app.detection.installTestLocationProvider
import ch.monreleve.app.detection.loadBundledBorder
import ch.monreleve.app.detection.removeTestLocationProvider
import ch.monreleve.app.detection.replayTrackThroughProvider
import ch.monreleve.app.fr.ReplayCopy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

// AN-AUTO increment 7. The DEBUG-ONLY mock-provider replay (A3). It runs the seven synthetic tracks through the
// REAL background path on the PHYSICAL phone: detection/replayTrackThroughProvider feeds each point to the OS
// test location provider, the classifier discards the coordinate (D18), and recordFix builds the tally - the
// sampler's classify-and-persist path, with the SYNTHETIC timestamp so a day compresses into a replay. Each
// track's PRODUCT outcome under R311 is shown (Proposé for HIGH; Pas sûr for MEDIUM/LOW/withheld).
//
// NO COORDINATE REACHES THIS FILE (D18 / fence 2b): all Location handling lives in detection/; this activity
// hands a SyntheticTrack and reads back a coordinate-free DailyTally. Dev-only, declared only in
// src/debug/AndroidManifest.xml (checkReleaseNoDevComponent proves it absent from the release APK). Reached by:
//   adb shell am start -n ch.monreleve.app/ch.monreleve.app.dev.DetectionMockReplayActivity
// Requires the app set as the mock-location app first (restore to deny afterwards):
//   adb shell appops set ch.monreleve.app android:mock_location allow
//
// No string literal here (fence 4): copy is ReplayCopy, values are enum/track names.

internal data class MockResult(
    val name: String,
    val expected: DetectionOutcome,
    val actual: DetectionOutcome,
)

class DetectionMockReplayActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val border = loadBundledBorder(applicationContext)
        val manager = getSystemService(LOCATION_SERVICE) as LocationManager
        val state = MutableStateFlow<List<MockResult>?>(null)
        setContent {
            FrontierTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    MockReplayScreen(state.collectAsState().value)
                }
            }
        }
        lifecycleScope.launch {
            if (!installTestLocationProvider(manager)) {
                state.value = listOf(unavailable())
                return@launch
            }
            state.value =
                SyntheticTracks.all.map { track ->
                    val tally = replayTrackThroughProvider(applicationContext, manager, border, track)
                    MockResult(
                        name = track.name,
                        expected = detectionOutcome(track.expected),
                        actual = detectionOutcome(computeProposal(tally, emptyList(), track.dayDate)),
                    )
                }
            removeTestLocationProvider(manager)
        }
    }

    private fun unavailable(): MockResult =
        MockResult(
            name = ReplayCopy.MOCK_UNAVAILABLE,
            expected = DetectionOutcome.NotSure,
            actual = DetectionOutcome.NotSure,
        )
}

private fun outcomeLabel(outcome: DetectionOutcome): String =
    when (outcome) {
        is DetectionOutcome.Proposed -> ReplayCopy.proposedOutcome(outcome.proposal.kind.name)
        DetectionOutcome.NotSure -> ReplayCopy.OUTCOME_NOT_SURE
    }

@Composable
private fun MockReplayScreen(results: List<MockResult>?) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space12),
    ) {
        Text(text = ReplayCopy.MOCK_TITLE, style = FrontierType.h2)
        if (results == null) {
            Text(text = ReplayCopy.RUNNING, style = FrontierType.body)
            return@Column
        }
        results.forEach { result ->
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
                Text(text = result.name, style = FrontierType.bodyM)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.space12)) {
                    Text(text = outcomeLabel(result.expected), style = FrontierType.body)
                    Text(text = outcomeLabel(result.actual), style = FrontierType.body)
                    Text(
                        text = if (result.expected == result.actual) ReplayCopy.PASS else ReplayCopy.FAIL,
                        style = FrontierType.bodyM,
                    )
                }
            }
        }
    }
}
