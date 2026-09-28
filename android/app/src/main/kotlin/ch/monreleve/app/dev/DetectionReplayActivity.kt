package ch.monreleve.app.dev

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
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
import androidx.core.content.ContextCompat
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.detection.BorderPolygon
import ch.monreleve.app.detection.Classification
import ch.monreleve.app.detection.DETECTION_REPLAY_REFRESH
import ch.monreleve.app.detection.Proposal
import ch.monreleve.app.detection.SyntheticTracks
import ch.monreleve.app.detection.classifyCurrentLocation
import ch.monreleve.app.detection.loadBundledBorder
import ch.monreleve.app.detection.replayTrack
import ch.monreleve.app.fr.ReplayCopy
import kotlinx.coroutines.flow.MutableStateFlow

// AN6a increment 5. The AC1 instrument: runs the seven synthetic tracks through the REAL
// pipeline on the emulator (loadBundledBorder reads the shipped asset; replayTrack drives
// DetectionSession.onFix) and shows each track's expected vs observed proposal and PASS/OK. It
// also shows the live geo-fix classification: the host sets a position with `adb emu geo fix`,
// broadcasts DETECTION_REPLAY_REFRESH, and the current-location line updates - the OS location
// layer feeding the classifier. Dev-only, no launcher, reached by adb (see the manifest). No
// string literal here (fence 4): copy is ReplayCopy, values are enum names and track names.

internal data class TrackResult(val name: String, val expected: Proposal?, val actual: Proposal?)

class DetectionReplayActivity : ComponentActivity() {
    private val currentLocation = MutableStateFlow<Classification?>(null)
    private lateinit var border: BorderPolygon

    private val refreshReceiver =
        object : BroadcastReceiver() {
            override fun onReceive(
                context: Context?,
                intent: Intent?,
            ) {
                currentLocation.value = classifyCurrentLocation(applicationContext, border)
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        border = loadBundledBorder(applicationContext)
        currentLocation.value = classifyCurrentLocation(applicationContext, border)
        val results = SyntheticTracks.all.map { TrackResult(it.name, it.expected, replayTrack(border, it)) }
        setContent {
            FrontierTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    ReplayScreen(results, currentLocation.collectAsState().value)
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        ContextCompat.registerReceiver(
            this,
            refreshReceiver,
            IntentFilter(DETECTION_REPLAY_REFRESH),
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        currentLocation.value = classifyCurrentLocation(applicationContext, border)
    }

    override fun onPause() {
        super.onPause()
        unregisterReceiver(refreshReceiver)
    }
}

private fun proposalLabel(proposal: Proposal?): String =
    proposal?.let { listOf(it.tier.name, it.kind.name, it.portion.name).joinToString() } ?: ReplayCopy.WITHHELD

@Composable
private fun ReplayScreen(
    results: List<TrackResult>,
    current: Classification?,
) {
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space12),
    ) {
        Text(text = ReplayCopy.TITLE, style = FrontierType.h2)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.space12)) {
            Text(text = ReplayCopy.CURRENT_LOCATION, style = FrontierType.body)
            Text(text = current?.name ?: ReplayCopy.NONE, style = FrontierType.bodyM)
        }
        results.forEach { result ->
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
                Text(text = result.name, style = FrontierType.bodyM)
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.space12)) {
                    Text(text = proposalLabel(result.expected), style = FrontierType.body)
                    Text(text = proposalLabel(result.actual), style = FrontierType.body)
                    Text(
                        text = if (result.expected == result.actual) ReplayCopy.PASS else ReplayCopy.FAIL,
                        style = FrontierType.bodyM,
                    )
                }
            }
        }
    }
}
