package ch.monreleve.app.forecast

import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.toKotlinClock
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RhythmRepository
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.ThresholdCrossing
import kotlinx.coroutines.CoroutineScope
import kotlinx.datetime.toKotlinLocalDate
import kotlin.time.ExperimentalTime
import java.time.Clock as JavaClock
import java.time.LocalDate as JavaLocalDate

// IOS-2d R813. :app's HALF OF THE FORECAST'S DATES, and it decides nothing - IOS-2c's JavaTimeCalendar shape.
//
// The forecast's date work is kotlinx-datetime and its clock is a kotlin.time Clock. The composition root (MainGraph),
// the controllers' Kotest specs, SettingsFollowedWithoutRestartTest, RateOneStringInstrumentedTest, the evening worker
// (EveningNotifier) and ThresholdForecastTest still hold a java.time Clock or LocalDate, so these keep every one of
// those call sites unedited by converting TYPES and nothing else, with the library's own converters (R553): a java.time
// Clock's instant source becomes the kotlin.time Clock (its zone is not used - the forecast's day was and is the Paris
// day: :app's todayInParis(java.time.Clock) was itself `todayInParis(clock.toKotlinClock())`), and a java.time
// LocalDate becomes the kotlinx one - exactly the conversion projectedThresholdCrossing made on its first use of
// `today` before. Named for what it holds, so its JVM facade class cannot collide with a file of :shared's.
//
// IOS-MOVE-GRAPH (R1310): the composition root's graph no longer calls this - MainGraph moved to :shared commonMain
// and builds the class itself, from the kotlin.time Clock and zone ShellState.kt splits off its java.time Clock.

/** The year-end crossing, from a java.time LocalDate: :app's call into the kotlinx version. */
fun projectedThresholdCrossing(
    settings: Settings,
    entries: List<EntryEntity>,
    rhythm: WeeklyRhythm,
    today: JavaLocalDate,
    taxYear: Int,
): ThresholdCrossing? = projectedThresholdCrossing(settings, entries, rhythm, today.toKotlinLocalDate(), taxYear)

/** The ForecastController, built from a java.time.Clock (its instant source). The same parameters, the same order. */
@Suppress("LongParameterList", "FunctionNaming", "ktlint:standard:function-naming")
@OptIn(ExperimentalTime::class) // KMP-DT R590: hands the kotlin.time.Clock seam over - on the allowlist.
fun ForecastController(
    rhythmRepo: RhythmRepository,
    entryRepo: EntryRepository,
    settingsStore: SettingsStore,
    taxYear: Int,
    clock: JavaClock,
    scope: CoroutineScope,
): ForecastController =
    ForecastController(
        rhythmRepo = rhythmRepo,
        entryRepo = entryRepo,
        settingsStore = settingsStore,
        taxYear = taxYear,
        clock = clock.toKotlinClock(),
        scope = scope,
    )

/** The SimulationController, built from a java.time.Clock (its instant source). The same parameters, the same order. */
@Suppress("LongParameterList", "FunctionNaming", "ktlint:standard:function-naming")
@OptIn(ExperimentalTime::class) // KMP-DT R590: hands the kotlin.time.Clock seam over - on the allowlist.
fun SimulationController(
    rhythmRepo: RhythmRepository,
    entryRepo: EntryRepository,
    settingsStore: SettingsStore,
    taxYear: Int,
    clock: JavaClock,
    scope: CoroutineScope,
    restored: SimulationSnapshot? = null,
): SimulationController =
    SimulationController(
        rhythmRepo = rhythmRepo,
        entryRepo = entryRepo,
        settingsStore = settingsStore,
        taxYear = taxYear,
        clock = clock.toKotlinClock(),
        scope = scope,
        restored = restored,
    )
