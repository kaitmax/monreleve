package ch.monreleve.app.aujourdhui

import ch.monreleve.app.data.local.TallyEntity
import ch.monreleve.app.data.local.toKotlinClock
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.detection.InMemoryNearBorderNoticeStore
import ch.monreleve.app.detection.NearBorderNoticeStore
import ch.monreleve.app.settings.DetectionModeStore
import ch.monreleve.app.settings.InMemoryDetectionModeStore
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.datetime.toKotlinTimeZone
import kotlin.time.ExperimentalTime
import java.time.Clock as JavaClock

// IOS-1b-A R602d. :app's HALF OF THE AUJOURD'HUI CONTROLLER, and it decides nothing - KMP-4's
// JavaTimeCalendarDay shape.
//
// The controller moved to :shared onto kotlin.time. The composition root (MainGraph) and the controller's JVM tests
// still hold a java.time.Clock - a clock AND a zone - so this factory, named like the class, keeps every one of those
// call sites unedited: it splits the java clock into the kotlin.time instant source and the zone the device's claim
// is written in, exactly the two things the java clock carried. Named for what it holds, not AujourdhuiController.kt.
//
// IOS-MOVE-GRAPH (R1310): the composition root's graph no longer calls this - MainGraph moved to :shared commonMain
// and builds the class itself, from the kotlin.time Clock and zone ShellState.kt splits off its java.time Clock.

/** The shared AujourdhuiController, built from a java.time.Clock (its instant source, and its zone for the claim). */
@Suppress("LongParameterList", "FunctionNaming", "ktlint:standard:function-naming")
@OptIn(ExperimentalTime::class) // KMP-DT R590: hands the kotlin.time.Clock seam over - on the allowlist.
fun AujourdhuiController(
    repository: EntryRepository,
    settingsStore: SettingsStore,
    taxYear: Int,
    clock: JavaClock,
    scope: CoroutineScope,
    requestSync: () -> Unit = {},
    detectionModeStore: DetectionModeStore = InMemoryDetectionModeStore(),
    detectionTallies: Flow<List<TallyEntity>> = emptyFlow(),
    nearBorderNoticeStore: NearBorderNoticeStore = InMemoryNearBorderNoticeStore(),
): AujourdhuiController =
    AujourdhuiController(
        repository = repository,
        settingsStore = settingsStore,
        taxYear = taxYear,
        clock = clock.toKotlinClock(),
        deviceZone = clock.zone.toKotlinTimeZone(),
        scope = scope,
        requestSync = requestSync,
        detectionModeStore = detectionModeStore,
        detectionTallies = detectionTallies,
        nearBorderNoticeStore = nearBorderNoticeStore,
    )
