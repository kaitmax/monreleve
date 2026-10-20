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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import ch.monreleve.app.account.SharedPrefsAccountStore
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.MonReleveDatabase
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.sync.SyncScheduler
import ch.monreleve.app.design.FrontierTheme
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.RecorderCopy
import ch.monreleve.app.fr.format.formatDate
import kotlinx.coroutines.launch
import java.time.Clock
import java.time.LocalDate

// AN5 increment 5. The dev recorder: enough to record a day and SEE the pending
// state persist, so the AN5 walkthrough can drive a real write and a real drain.
// The production Aujourd'hui is AN8/AN9; this mirrors the gallery and the sign-in
// probe - dev-only, no launcher entry, reached by adb naming the component:
//   adb shell am start -n ch.monreleve.app/ch.monreleve.app.dev.DevRecorderActivity
// Recording writes through EntryRepository (never the DAO) and then asks the
// SyncScheduler to drain; pending rows show "En attente de synchronisation" as a
// persistent row state (DESIGN-SYSTEM section 2), not a toast. No string literal
// here (fence 4): every word is RecorderCopy, the kind is its wire name, the day is
// formatDate.

class DevRecorderActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val clock = Clock.systemDefaultZone()
        val repository =
            LocalEntryRepository(
                MonReleveDatabase.get(applicationContext).entryDao(),
                clock,
                // AN-FIX F4 / R303: the dev recorder tags and shows rows under the account signed in now,
                // the same as the production shell - so the cross-account reproduction drives the real scope.
                // AN-ACCOUNT-TAG (R423/R424): READ AT WRITE TIME, like the shell. This said "signed in now"
                // and meant "signed in when this activity was built", which is the same sentence the defect
                // hid behind in MainActivity.
                currentAccount = { SharedPrefsAccountStore(applicationContext).current() },
            )
        val today = todayInParis(clock)
        setContent {
            FrontierTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    val entries by repository.observeAll().collectAsState(initial = emptyList())
                    RecorderScreen(
                        today = today,
                        entries = entries,
                        onRecord = { day, kind ->
                            lifecycleScope.launch {
                                repository.record(RecordCommand(dayDate = day, kind = kind))
                                SyncScheduler.requestSync(applicationContext)
                            }
                        },
                        onSync = { SyncScheduler.requestSync(applicationContext) },
                    )
                }
            }
        }
    }
}

private fun stateLabel(state: SyncState): String =
    when (state) {
        SyncState.PENDING -> RecorderCopy.STATE_PENDING
        SyncState.SYNCED -> RecorderCopy.STATE_SYNCED
        SyncState.FAILED -> RecorderCopy.STATE_FAILED
    }

@Composable
private fun RecorderScreen(
    today: String,
    entries: List<EntryEntity>,
    onRecord: (String, EntryKind) -> Unit,
    onSync: () -> Unit,
) {
    var offset by remember { mutableStateOf(0L) }
    val day = LocalDate.parse(today).minusDays(offset).toString()
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space12),
    ) {
        Text(text = RecorderCopy.TITLE, style = FrontierType.h2)
        Text(text = formatDate(day), style = FrontierType.body)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space12)) {
            Button(onClick = { offset += 1 }) { Text(text = RecorderCopy.EARLIER) }
            Button(onClick = { if (offset > 0) offset -= 1 }) { Text(text = RecorderCopy.LATER) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space12)) {
            Button(onClick = { onRecord(day, EntryKind.HOME) }) { Text(text = RecorderCopy.RECORD_HOME) }
            Button(onClick = { onRecord(day, EntryKind.CH) }) { Text(text = RecorderCopy.RECORD_CH) }
        }
        Button(onClick = onSync) { Text(text = RecorderCopy.SYNC) }
        if (entries.isEmpty()) {
            Text(text = RecorderCopy.EMPTY, style = FrontierType.body)
        } else {
            entries.forEach { entry ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space12)) {
                        Text(text = formatDate(entry.dayDate), style = FrontierType.body)
                        Text(text = entry.kind.name, style = FrontierType.body)
                    }
                    Text(text = stateLabel(entry.syncState), style = FrontierType.bodyM)
                }
            }
        }
    }
}
