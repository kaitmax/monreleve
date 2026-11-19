package ch.monreleve.app.releve

import ch.monreleve.app.aujourdhui.AujourdhuiController
import ch.monreleve.app.aujourdhui.RecordedKind
import ch.monreleve.app.aujourdhui.Slot
import ch.monreleve.app.auth.AuthedOutcome
import ch.monreleve.app.auth.AuthenticatedPoster
import ch.monreleve.app.auth.BytesOutcome
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.CalcResult
import ch.monreleve.app.calc.calculateTelework
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.MemoryDossierCache
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.local.toAggregatable
import ch.monreleve.app.data.remote.DossierApi
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.sync.SyncEngine
import ch.monreleve.app.data.sync.SyncOutcome
import ch.monreleve.app.dossier.toTeleworkInput
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import ch.monreleve.app.settings.toAggregatableUser
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-RELEVE-FRESH (R558, PARK-X5). THE RELEVE SHOWS THE SERVER'S RECORD AS IT IS NOW. One rig wires the real
// pieces end to end - the Releve controller over the real DossierApi and a DossierCache, the real SyncEngine
// draining the same store, and a fake server that answers POST /api/v1/entries and GET /api/v1/dossier from the
// rows it has actually received. The server's figures are computed by the same engine path Aujourd'hui uses
// (toTeleworkInput + calculateTelework), which is what R281's conformance fixtures prove equal to the web's.
//
// The bug: ReleveController fetched on init, on a year switch and on retry only, so a day recorded and sent
// after sign-in left the Releve on the sign-in snapshot until the app was relaunched (REPORT-KMP-UP2, Q5).

private const val TAX_YEAR = 2026
private const val ACCOUNT = "acct-camille"
private val SETTINGS = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

/** A FakeEntryDao whose observe* flows are HOT, as Room's are: every upsert re-emits, so screens follow the store. */
private class LiveDao(private val inner: FakeEntryDao = FakeEntryDao()) : EntryDao by inner {
    private val all = MutableStateFlow<List<EntryEntity>>(emptyList())

    override suspend fun upsert(entry: EntryEntity) {
        inner.upsert(entry)
        all.value = inner.rows.values.toList()
    }

    override fun observeAll(): Flow<List<EntryEntity>> = all

    override fun observeAllForAccount(accountTag: String): Flow<List<EntryEntity>> =
        all.map { rows -> rows.filter { it.accountTag == accountTag } }

    override fun observePending(): Flow<List<EntryEntity>> =
        all.map { rows -> rows.filter { it.syncState == SyncState.PENDING } }
}

/**
 * The local stack, reduced to what this test turns on: it keeps the rows it has received, answers the entries
 * POST from them (R217: every written row returned), and renders the dossier from them. [online] false is the
 * removed adb reverse: every request is a network fault.
 */
private class FakeServer(private val dao: LiveDao) : AuthenticatedPoster {
    val received = linkedMapOf<String, EntryEntity>()
    var online = true

    /** The server answers the dossier GET, but not with a document (a 5xx envelope): DossierApi reads Unreadable. */
    var dossierBroken = false
    var dossierGets = 0
    private var generation = 0

    override suspend fun authenticatedPost(
        path: String,
        body: String,
    ): PostOutcome {
        if (!online) return PostOutcome.NetworkError
        val items = JSONObject(body).getJSONArray("entries")
        val rows =
            (0 until items.length()).map { index ->
                val item = items.getJSONObject(index)
                val mutId = item.getString("clientMutationId")
                received[mutId] = dao.rows().first { it.clientMutationId == mutId }
                item.put("id", "srv-$mutId")
                    .put("firstRecordedAt", "${item.getString("dayDate")}T18:00:00.000Z")
                    .put("lastModifiedAt", JSONObject.NULL)
                    .toString()
            }
        return PostOutcome.Ok(
            200,
            """{"status":"ok","written":${rows.size},"duplicates":0,"entries":[${rows.joinToString(",")}]}""",
        )
    }

    suspend fun get(path: String): AuthedOutcome {
        if (!online) return AuthedOutcome.NetworkError
        val year = path.substringAfter("/api/v1/dossier?year=").toInt()
        if (year == TAX_YEAR) dossierGets++
        generation++
        val rows = received.values.filter { it.dayDate.startsWith("$year-") }
        val broken = """{"status":"error","code":"render_failed"}"""
        return AuthedOutcome.Ok(200, if (dossierBroken) broken else dossierBody(year, rows, generation))
    }

    private fun dossierBody(
        year: Int,
        rows: List<EntryEntity>,
        generation: Int,
    ): String {
        val telework = rows.count { it.kind == EntryKind.HOME }
        val swiss = rows.count { it.kind == EntryKind.CH }
        val input = toTeleworkInput(SETTINGS.toAggregatableUser(), rows.map { it.toAggregatable() }, year)
        val result = (calculateTelework(input) as CalcResult.Ok).value
        return """
            {
              "taxYear": $year,
              "period": { "fraction": 1.0, "startDate": null },
              "titulaire": "Camille Rey",
              "generatedAt": "2026-10-21T09:0$generation:00.000Z",
              "canton": "GE",
              "employmentRate": 100,
              "denominatorKind": "SIMPLIFIED240",
              "tiles": { "workedDays": 240, "swissDays": $swiss, "teleworkDays": $telework, "missionDays": 0 },
              "zone": {
                "declarableRate": ${result.declarableRate}, "rawRate": ${result.rawRate}, "ratesDiffer": false,
                "fiscalCeilingDays": 96, "remainingToFiscal": 90, "remainingToSocial": 110, "warnings": []
              },
              "months": [],
              "annex": [],
              "absenceDays": 0,
              "recordedEntries": ${rows.size},
              "creditedMissionDays": 0,
              "rateWithoutMissions": ${result.declarableRate}
            }
            """.trimIndent()
    }
}

private suspend fun LiveDao.rows(): List<EntryEntity> = all()

private fun synced(day: String): EntryEntity =
    EntryEntity(
        clientMutationId = "mut-$day",
        dayDate = day,
        portion = Portion.FULL,
        kind = EntryKind.HOME,
        absenceReason = null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = "${day}T12:00:00.000+02:00",
        serverId = "srv-mut-$day",
        firstRecordedAt = "${day}T18:00:00.000Z",
        lastModifiedAt = null,
        syncState = SyncState.SYNCED,
        accountTag = ACCOUNT,
    )

/** The app as it stands after a sign-in: one day already on the server and on the phone, the dossier fetched. */
private class Rig(private val scope: CoroutineScope) {
    // 10:00 UTC is 12:00 in Paris: "today" is 2026-10-21, unambiguous.
    val clock: Clock = Clock.fixed(Instant.parse("2026-10-21T10:00:00Z"), ZoneId.of("Europe/Paris"))
    val dao = LiveDao()
    val server = FakeServer(dao)
    val cache = MemoryDossierCache()
    val repository = LocalEntryRepository(dao, clock, currentAccount = { ACCOUNT }, isSignedIn = { true })
    val dossierApi = DossierApi(server::get, cache)
    var releve = buildReleve()

    /** MainGraph's construction of the Releve controller, over the same DossierApi (R291). */
    fun buildReleve(): ReleveController =
        ReleveController(
            fetch = dossierApi::fetch,
            exportBytes = { BytesOutcome.NetworkError },
            repository = repository,
            taxYear = TAX_YEAR,
            scope = scope,
            staleCopy = dossierApi::staleCopy,
        )

    /** The worker's drain: SyncWorker builds exactly this, from the same store, on every run. */
    suspend fun drain(): SyncOutcome = SyncEngine(dao, server, ACCOUNT, cache).sync()

    /** The person taps "Domicile" on Aujourd'hui for today: a PENDING row, as the repository writes it. */
    suspend fun recordToday() {
        repository.record(ch.monreleve.app.data.repo.RecordCommand(dayDate = "2026-10-21", kind = EntryKind.HOME))
    }

    /** Opening the Releve tab: MainActivity's DisposableEffect on AppTab.RELEVE. (On main, nothing happened here.) */
    fun openReleve() = releve.onOpened()

    /** Leaving the Releve tab for another: the same DisposableEffect's onDispose. */
    fun closeReleve() = releve.onClosed()

    fun shown(): ReleveState.Loaded = releve.state.value.shouldBeInstanceOf<ReleveState.Loaded>()
}

@OptIn(ExperimentalCoroutinesApi::class)
private suspend fun TestScope.signedIn(): Rig {
    val rig = Rig(backgroundScope)
    rig.dao.upsert(synced("2026-10-20"))
    rig.server.received["mut-2026-10-20"] = synced("2026-10-20")
    runCurrent()
    return rig
}

@OptIn(ExperimentalCoroutinesApi::class)
class ReleveFreshTest : FunSpec({
    test("R558: a day recorded and sent after sign-in reaches the Releve when it is opened, without a relaunch") {
        runTest {
            val rig = signedIn()
            rig.openReleve()
            runCurrent()
            // The sign-in snapshot: the server holds one telework day.
            rig.shown().document.tiles.teleworkDays shouldBe 1.0
            rig.closeReleve()

            rig.recordToday()
            rig.drain() shouldBe SyncOutcome.Settled(written = 1, defects = 0)
            rig.server.received.size shouldBe 2
            runCurrent()

            rig.openReleve()
            runCurrent()
            rig.shown().document.tiles.teleworkDays shouldBe 2.0
        }
    }

    test("R560: online and stale - the cached figures at once, marked as updating, then the server's") {
        runTest {
            val rig = signedIn()
            rig.recordToday()
            rig.drain()
            runCurrent()
            rig.cache.isStale(TAX_YEAR) shouldBe true

            rig.openReleve()
            // Before the fetch answers: the copy, not a spinner, and it says it is updating.
            rig.shown().updating shouldBe true
            rig.shown().document.tiles.teleworkDays shouldBe 1.0
            runCurrent()
            rig.shown().updating shouldBe false
            rig.shown().offline shouldBe false
            rig.shown().document.tiles.teleworkDays shouldBe 2.0
            // The fresh copy is cached and is no longer stale.
            rig.cache.isStale(TAX_YEAR) shouldBe false
        }
    }

    test("R560: online and fresh - opening the Releve fetches nothing beyond what it fetched before") {
        runTest {
            val rig = signedIn()
            // The sign-in fetch, exactly one, as before this ruling.
            rig.server.dossierGets shouldBe 1
            repeat(3) {
                rig.openReleve()
                runCurrent()
                rig.closeReleve()
            }
            rig.server.dossierGets shouldBe 1
            rig.shown().updating shouldBe false
            // Positive control: the same opening DOES fetch once the year is stale.
            rig.cache.markStale(TAX_YEAR)
            rig.openReleve()
            runCurrent()
            rig.server.dossierGets shouldBe 2
        }
    }

    test("R560: offline and stale - the cached figures, dated by their own generation, possibly out of date") {
        runTest {
            val rig = signedIn()
            val signInCopy = rig.shown().document
            rig.recordToday()
            rig.drain()
            runCurrent()
            rig.server.online = false

            rig.openReleve()
            runCurrent()
            val shown = rig.shown()
            shown.offline shouldBe true
            shown.updating shouldBe false
            shown.document shouldBe signInCopy
            // Still stale: the next opening with a connection fetches.
            rig.cache.isStale(TAX_YEAR) shouldBe true
            rig.server.online = true
            rig.closeReleve()
            rig.openReleve()
            runCurrent()
            rig.shown().offline shouldBe false
            rig.shown().document.tiles.teleworkDays shouldBe 2.0
        }
    }

    test("R560: a refresh the server cannot answer keeps the copy, says so, and changes nothing") {
        runTest {
            val rig = signedIn()
            val signInCopy = rig.shown().document
            val cachedBody = rig.cache.load(TAX_YEAR)
            rig.recordToday()
            rig.drain()
            runCurrent()
            rig.server.dossierBroken = true

            rig.openReleve()
            runCurrent()
            val shown = rig.shown()
            shown.refreshFailed shouldBe true
            shown.updating shouldBe false
            shown.offline shouldBe false
            shown.document shouldBe signInCopy
            // Nothing was changed: the cached body is the same bytes and the year is still stale, so it retries.
            rig.cache.load(TAX_YEAR) shouldBe cachedBody
            rig.cache.isStale(TAX_YEAR) shouldBe true
        }
    }

    test("R560: with the Releve open, a sync that sends a day refreshes it without another opening") {
        runTest {
            val rig = signedIn()
            rig.openReleve()
            runCurrent()
            rig.recordToday()
            runCurrent()
            rig.drain()
            runCurrent()
            rig.shown().document.tiles.teleworkDays shouldBe 2.0
        }
    }

    test("R560: with the Releve closed, a sync fetches nothing until the next opening") {
        runTest {
            val rig = signedIn()
            rig.openReleve()
            runCurrent()
            rig.closeReleve()
            val before = rig.server.dossierGets
            rig.recordToday()
            runCurrent()
            rig.drain()
            runCurrent()
            rig.server.dossierGets shouldBe before
            rig.openReleve()
            runCurrent()
            rig.server.dossierGets shouldBe before + 1
        }
    }

    test("R560: a relaunch over a stale cache opens on the copy, marked as updating, then the server's") {
        runTest {
            val rig = signedIn()
            rig.recordToday()
            rig.drain()
            runCurrent()

            rig.releve = rig.buildReleve()
            rig.shown().updating shouldBe true
            rig.shown().document.tiles.teleworkDays shouldBe 1.0
            runCurrent()
            rig.shown().updating shouldBe false
            rig.shown().document.tiles.teleworkDays shouldBe 2.0
        }
    }

    // -------------------------------------------------------------------------------------------------------------
    // R561: WHAT IS NOT SENT IS SAID, NOT COUNTED IN. The count is the store's, read as the screen renders; the
    // document's figures stay the server's; Aujourd'hui (which counts local days) may differ by exactly those days,
    // and R281's equality holds again once they are sent.
    // -------------------------------------------------------------------------------------------------------------

    test("R561: the sentence, singular and plural, accented, with the no-break space before the colon (R91)") {
        ReleveCopy.pendingNotSynced(1) shouldBe
            "1 journée enregistrée sur ce téléphone n’a pas encore été envoyée\u00A0: ce relevé ne la compte " +
            "pas encore."
        ReleveCopy.pendingNotSynced(3) shouldBe
            "3 journées enregistrées sur ce téléphone n’ont pas encore été envoyées\u00A0: ce relevé ne les compte " +
            "pas encore."
    }

    test("R561: a day not yet sent is said on the Releve and not counted in; once sent, R281's equality holds") {
        runTest {
            val rig = signedIn()
            val settings =
                object : SettingsStore {
                    override fun load(): Settings = SETTINGS

                    override fun save(settings: Settings) = Unit

                    override fun clear() = Unit
                }
            val aujourdhui = AujourdhuiController(rig.repository, settings, TAX_YEAR, rig.clock, backgroundScope)
            rig.openReleve()
            runCurrent()

            fun aujourdhuiRate(): Double? = aujourdhui.state.value.year?.result?.declarableRate
            // Before: one day, on the server and the phone alike - the two screens agree (R281).
            rig.shown().pendingCount shouldBe 0
            rig.shown().document.zone.declarableRate shouldBe aujourdhuiRate()

            // The adb reverse is removed: the day is recorded on Aujourd'hui and cannot be sent.
            rig.server.online = false
            aujourdhui.record(RecordedKind.DOMICILE, Slot.FULL)
            runCurrent()
            rig.drain() shouldBe SyncOutcome.Retryable
            runCurrent()
            val unsent = rig.shown()
            // Said: one day not yet sent, counted from the store.
            unsent.pendingCount shouldBe 1
            ReleveCopy.pendingNotSynced(unsent.pendingCount) shouldBe ReleveCopy.pendingNotSynced(1)
            // Not counted in: the document is still the server's, one telework day, and Aujourd'hui differs.
            unsent.document.tiles.teleworkDays shouldBe 1.0
            unsent.document.zone.declarableRate shouldNotBe aujourdhuiRate()

            // The reverse is restored and the day is sent: the notice goes and the two rates are one again.
            rig.server.online = true
            rig.drain() shouldBe SyncOutcome.Settled(written = 1, defects = 0)
            runCurrent()
            val sent = rig.shown()
            sent.pendingCount shouldBe 0
            sent.updating shouldBe false
            sent.document.tiles.teleworkDays shouldBe 2.0
            sent.document.zone.declarableRate shouldBe aujourdhuiRate()
        }
    }
})
