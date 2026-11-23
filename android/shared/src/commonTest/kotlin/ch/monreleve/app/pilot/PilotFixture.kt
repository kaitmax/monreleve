package ch.monreleve.app.pilot

import ch.monreleve.app.aujourdhui.AujourdhuiController
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.todayInParis
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.settings.Settings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.DayOfWeek
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.minus
import kotlin.time.Clock
import kotlin.time.ExperimentalTime

// IOS-1b-A R608. THE PILOT'S DATA: AN IN-MEMORY RECORD, SO THE iOS PILOT NEEDS NO SERVER, NO ACCOUNT, NO PRODUCTION.
//
// Part B puts Aujourd'hui on the operator's iPhone before the iOS app has a sign-in, a database or a network. This is
// what it shows instead: the REAL controller and the REAL record path (LocalEntryRepository - the granularity rule
// R492, the account tag read at write time), over an EntryDao that lives in memory and dies with the process. Nothing
// here can reach a server: the controller's requestSync is a no-op, no transport is built, and the rows carry an
// account tag no server issues (PILOT_ACCOUNT), so even a mistaken sync could not file them under a real person.
//
// THE SEED holds a day in EVERY STATE the screen draws - answered whole, answered in halves, pending (on the phone,
// not yet sent), refused by the server, and a past working day left unanswered - so the week strip, the month
// counts and « À traiter » are all populated; and TODAY is whichever state [PilotScenario] names, so the top of the
// screen can be shown in each of its states too. Days are placed relative to the clock's Paris today, on weekdays
// before it, so the fixture reads true on any date the pilot is opened.

/** The account tag on every pilot row - not a server-issued id, so nothing here can be mistaken for a person's day. */
const val PILOT_ACCOUNT = "pilot-fixture"

/** Which state TODAY is in when the pilot opens. Every other state is in the seeded history regardless. */
enum class PilotScenario {
    /** Whole-day mode, today not yet answered: the question and its choices. */
    UNANSWERED,

    /** Half-day mode, today not yet answered: the morning and afternoon asked apart. */
    UNANSWERED_HALF_DAY,

    /** Today answered as a whole day, and acknowledged by the server. */
    ANSWERED_WHOLE,

    /** Today answered in halves - Suisse in the morning, domicile in the afternoon - both acknowledged. */
    ANSWERED_HALVES,

    /** Today answered, still on the phone: the pending line. */
    PENDING,

    /** Today answered, and the server refused it (R198): the refused line, in the error colour. */
    REFUSED,
}

/** An EntryDao in memory - the same contract Room fulfils, with no file and no SQL. Rows die with the process. */
class InMemoryEntryDao(seed: List<EntryEntity> = emptyList()) : EntryDao {
    private val rows = MutableStateFlow(sorted(seed))

    private fun sorted(list: List<EntryEntity>): List<EntryEntity> =
        list.sortedWith(compareBy<EntryEntity>({ it.dayDate }, { it.portion }))

    override suspend fun upsert(entry: EntryEntity) {
        rows.value =
            sorted(rows.value.filterNot { it.dayDate == entry.dayDate && it.portion == entry.portion } + entry)
    }

    override suspend fun byDayPortion(
        dayDate: String,
        portion: Portion,
    ): EntryEntity? = rows.value.firstOrNull { it.dayDate == dayDate && it.portion == portion }

    override suspend fun byAccountDayPortion(
        accountTag: String,
        dayDate: String,
        portion: Portion,
    ): EntryEntity? =
        rows.value.firstOrNull { it.accountTag == accountTag && it.dayDate == dayDate && it.portion == portion }

    override suspend fun pendingForAccount(accountTag: String): List<EntryEntity> =
        rows.value.filter { it.syncState == SyncState.PENDING && it.accountTag == accountTag }

    override fun observeAllForAccount(accountTag: String): Flow<List<EntryEntity>> =
        rows.map { all -> all.filter { it.accountTag == accountTag } }

    override suspend fun all(): List<EntryEntity> = rows.value

    override suspend fun pending(): List<EntryEntity> = rows.value.filter { it.syncState == SyncState.PENDING }

    override fun observePending(): Flow<List<EntryEntity>> =
        rows.map { all -> all.filter { it.syncState == SyncState.PENDING } }

    override fun observeAll(): Flow<List<EntryEntity>> = rows
}

object PilotFixture {
    private const val CANTON = "GE"
    private const val FULL_TIME = 100
    private const val DENOMINATOR = "SIMPLIFIED240"
    private const val WHOLE_DAY = "DAY"
    private const val HALF_DAY = "HALF_DAY"

    // How many working days back the history reaches - enough for this week and the month's counts.
    private const val HISTORY_WEEKDAYS = 8

    /** The pilot's settings: half-day mode for the two scenarios that are about halves, whole-day otherwise. */
    fun settings(scenario: PilotScenario): Settings {
        val granularity =
            when (scenario) {
                PilotScenario.UNANSWERED_HALF_DAY, PilotScenario.ANSWERED_HALVES -> HALF_DAY
                else -> WHOLE_DAY
            }
        return Settings(CANTON, FULL_TIME, DENOMINATOR, null, granularity, null)
    }

    /**
     * The seeded rows for [today] (an ISO Paris day): the history - one past weekday in each state, the oldest left
     * unanswered - and today in [scenario]'s state.
     */
    fun seed(
        scenario: PilotScenario,
        today: String,
    ): List<EntryEntity> {
        val history = weekdaysBefore(LocalDate.parse(today), HISTORY_WEEKDAYS)
        // history[0] is the most recent weekday; the last one is deliberately left unanswered (MISSING).
        val past =
            listOf(
                row(history[0].toString(), Portion.FULL, EntryKind.CH, SyncState.SYNCED),
                row(history[1].toString(), Portion.AM, EntryKind.CH, SyncState.SYNCED),
                row(history[1].toString(), Portion.PM, EntryKind.HOME, SyncState.SYNCED),
                row(history[2].toString(), Portion.FULL, EntryKind.HOME, SyncState.PENDING),
                row(history[3].toString(), Portion.FULL, EntryKind.CH, SyncState.FAILED),
                row(history[4].toString(), Portion.FULL, EntryKind.MISSION_FR, SyncState.SYNCED),
                row(history[5].toString(), Portion.FULL, EntryKind.HOME, SyncState.SYNCED),
                // A second day in halves, the other way round, so the two halves days sum to whole counts: in whole-day
                // mode the engine refuses a half count (calc/Validate.kt), and the year panel would show no rate.
                row(history[6].toString(), Portion.AM, EntryKind.HOME, SyncState.SYNCED),
                row(history[6].toString(), Portion.PM, EntryKind.CH, SyncState.SYNCED),
            )
        val todays =
            when (scenario) {
                PilotScenario.UNANSWERED, PilotScenario.UNANSWERED_HALF_DAY -> emptyList()
                PilotScenario.ANSWERED_WHOLE -> listOf(row(today, Portion.FULL, EntryKind.CH, SyncState.SYNCED))
                PilotScenario.ANSWERED_HALVES ->
                    listOf(
                        row(today, Portion.AM, EntryKind.CH, SyncState.SYNCED),
                        row(today, Portion.PM, EntryKind.HOME, SyncState.SYNCED),
                    )
                PilotScenario.PENDING -> listOf(row(today, Portion.FULL, EntryKind.HOME, SyncState.PENDING))
                PilotScenario.REFUSED -> listOf(row(today, Portion.FULL, EntryKind.CH, SyncState.FAILED))
            }
        return past + todays
    }

    /**
     * The real Aujourd'hui controller over the in-memory record, for [scenario] on [clock]'s Paris today. NO SERVER:
     * requestSync is a no-op and nothing builds a transport. [newMutationId] is the platform's id source (iOS has
     * one in iosMain); a tap writes one row with it, exactly as the app's own path does. The seams are listed, not
     * bundled - the controller's own reasoning (AujourdhuiController's @Suppress).
     */
    @Suppress("LongParameterList")
    @OptIn(ExperimentalTime::class) // KMP-DT R590: the kotlin.time.Clock seam - on the allowlist.
    fun controller(
        scenario: PilotScenario,
        scope: CoroutineScope,
        clock: Clock,
        deviceZone: TimeZone,
        newMutationId: () -> String,
        dao: InMemoryEntryDao = InMemoryEntryDao(seed(scenario, todayInParis(clock))),
    ): AujourdhuiController {
        val today = todayInParis(clock)
        val repository =
            LocalEntryRepository(
                dao = dao,
                clock = clock,
                deviceZone = deviceZone,
                currentAccount = { PILOT_ACCOUNT },
                reportUnownedWhileSignedIn = {},
                newMutationId = newMutationId,
            )
        return AujourdhuiController(
            repository = repository,
            settingsStore = InMemorySettingsStore(settings(scenario)),
            taxYear = LocalDate.parse(today).year,
            clock = clock,
            deviceZone = deviceZone,
            scope = scope,
        )
    }

    private fun weekdaysBefore(
        day: LocalDate,
        count: Int,
    ): List<LocalDate> =
        generateSequence(day.minus(1, DateTimeUnit.DAY)) { it.minus(1, DateTimeUnit.DAY) }
            .filter { it.dayOfWeek != DayOfWeek.SATURDAY && it.dayOfWeek != DayOfWeek.SUNDAY }
            .take(count)
            .toList()

    private fun row(
        day: String,
        portion: Portion,
        kind: EntryKind,
        sync: SyncState,
    ): EntryEntity {
        val synced = sync == SyncState.SYNCED
        return EntryEntity(
            clientMutationId = "pilot-$day-$portion",
            dayDate = day,
            portion = portion,
            kind = kind,
            absenceReason = null,
            note = null,
            provenance = Provenance.MANUAL,
            detectedKind = null,
            detectedAt = null,
            clientClaimedAt = "${day}T17:00:00.000+02:00",
            serverId = if (synced) "pilot-srv-$day-$portion" else null,
            firstRecordedAt = if (synced) "${day}T15:00:00.000Z" else null,
            lastModifiedAt = null,
            syncState = sync,
            accountTag = PILOT_ACCOUNT,
        )
    }
}
