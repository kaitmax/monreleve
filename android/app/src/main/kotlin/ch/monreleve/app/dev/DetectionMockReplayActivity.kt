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
import ch.monreleve.app.detection.REPLAY_ACCURACY_EXTRA
import ch.monreleve.app.detection.SyntheticTracks
import ch.monreleve.app.detection.dayProposal
import ch.monreleve.app.detection.detectionOutcome
import ch.monreleve.app.detection.installTestLocationProvider
import ch.monreleve.app.detection.loadBundledBorder
import ch.monreleve.app.detection.removeTestLocationProvider
import ch.monreleve.app.detection.replayTrackThroughProvider
import ch.monreleve.app.fr.ReplayCopy
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

// AN-AUTO increment 7 / R320. The DEBUG-ONLY mock-provider replay (A3). It runs the synthetic tracks through the
// REAL background path on the PHYSICAL phone: detection/replayTrackThroughProvider feeds each point to the OS test
// location provider at its check-window time, the classifier discards the coordinate (D18), and the fix becomes that
// window's check - the sampler's classify path, with the SYNTHETIC timestamp so a day compresses into a replay. Each
// track's PRODUCT outcome under R311 is shown (Proposé for HIGH; Pas sûr for MEDIUM/LOW/withheld).
//
// NO COORDINATE REACHES THIS FILE (D18 / fence 2b): all Location handling lives in detection/; this activity hands a
// SyntheticTrack and reads back a coordinate-free DayChecks. Dev-only, declared only in
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
        // AN-NEXT-2 / R324: an optional coarse accuracy radius (metres) passed as an Intent extra lets this replay
        // the tracks as NETWORK-grade fixes - `--ef <REPLAY_ACCURACY_EXTRA> 10000` makes every fix near the Geneva
        // border "not sure". Absent or <= 0 keeps the precise GPS-era replay (the AN6a demonstration).
        val replayAccuracy = intent.getFloatExtra(REPLAY_ACCURACY_EXTRA, 0f)
        lifecycleScope.launch {
            if (!installTestLocationProvider(manager)) {
                state.value = listOf(unavailable())
                return@launch
            }
            state.value =
                SyntheticTracks.all.map { track ->
                    val checks =
                        if (replayAccuracy > 0f) {
                            replayTrackThroughProvider(applicationContext, manager, border, track, replayAccuracy)
                        } else {
                            replayTrackThroughProvider(applicationContext, manager, border, track)
                        }
                    MockResult(
                        name = track.name,
                        expected = detectionOutcome(track.expected),
                        actual = detectionOutcome(dayProposal(checks)),
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
