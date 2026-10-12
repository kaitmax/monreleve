package ch.monreleve.app.parametres

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.settings.InMemoryThresholdAlertStore
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN12 increment 1 (SPEC 11.5, R290). The settings controller. The write path is the real SettingsSaver
// seam (a recording fake here) and the real LocalEntryRepository over a FakeEntryDao, so R290's
// before-and-after is computed over genuinely stored rows through the shipped engine path.

private const val TAX_YEAR = 2026

private val CLOCK: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

private fun settings(
    rate: Int = 100,
    denominator: String = "SIMPLIFIED240",
    exactTotal: Int? = null,
    granularity: String = "DAY",
    startDate: String? = null,
): Settings = Settings("GE", rate, denominator, exactTotal, granularity, startDate)

private class InMemoryStore(initial: Settings) : SettingsStore {
    var current: Settings? = initial

    override fun load(): Settings? = current

    override fun save(settings: Settings) {
        current = settings
    }

    override fun clear() {
        current = null
    }
}

private class RecordingSaver(private val outcome: PostOutcome = PostOutcome.Ok(200, "{}")) : SettingsSaver {
    val bodies = mutableListOf<String>()

    override suspend fun saveSettings(body: String): PostOutcome {
        bodies += body
        return outcome
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class ParametresControllerTest : FunSpec({
    // Seed the shared repository with enough telework days that the declarable rate moves when the
    // denominator changes (10 HOME days: 10/240 at rate 100, 10/120 at rate 50 - two different rates).
    suspend fun repoWithTeleworkDays(dao: FakeEntryDao): LocalEntryRepository {
        val repo = LocalEntryRepository(dao, CLOCK)
        for (day in 1..10) {
            repo.record(RecordCommand(dayDate = "2026-03-%02d".format(day), kind = EntryKind.HOME))
        }
        return repo
    }

    test("AC1: a settings edit is PATCHed as the /api/v1/me body when nothing consequential moves") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK) // no entries: no rate to move
            val store = InMemoryStore(settings(rate = 100))
            val saver = RecordingSaver()
            val controller = ParametresController(saver, store, repo, TAX_YEAR, this)
            advanceUntilIdle()

            controller.onEmploymentRateChange("80")
            controller.save()
            advanceUntilIdle()

            saver.bodies.size shouldBe 1
            saver.bodies.single().contains("\"employmentRate\":80").shouldBeTrue()
            store.load()?.employmentRate shouldBe 80
            controller.state.value.phase shouldBe ParametresPhase.SAVED
        }
    }

    test("R290: a change that MOVES the year's rate is not saved until it is confirmed") {
        runTest {
            val dao = FakeEntryDao()
            val repo = repoWithTeleworkDays(dao)
            val store = InMemoryStore(settings(rate = 100))
            val saver = RecordingSaver()
            val controller = ParametresController(saver, store, repo, TAX_YEAR, this)
            advanceUntilIdle()

            controller.onEmploymentRateChange("50")
            controller.save()
            advanceUntilIdle()

            // R290: before saving, the screen must show the before/after and the PATCH must NOT have fired.
            val change = controller.state.value.pendingRateChange
            change.shouldNotBeNull()
            (change.before != change.after).shouldBeTrue()
            saver.bodies.size shouldBe 0
            store.load()?.employmentRate shouldBe 100
        }
    }

    test("R290: the before/after are the device engine's rates over the device's own entries") {
        runTest {
            val dao = FakeEntryDao()
            val repo = repoWithTeleworkDays(dao)
            val entries = dao.all()
            val store = InMemoryStore(settings(rate = 100))
            val controller = ParametresController(RecordingSaver(), store, repo, TAX_YEAR, this)
            advanceUntilIdle()

            controller.onEmploymentRateChange("50")
            controller.save()
            advanceUntilIdle()

            val change = controller.state.value.pendingRateChange
            change.shouldNotBeNull()
            change.before shouldBe deviceDeclarableRate(settings(rate = 100), entries, TAX_YEAR)
            change.after shouldBe deviceDeclarableRate(settings(rate = 50), entries, TAX_YEAR)
        }
    }

    test("R290: confirming a consequential change commits it through the PATCH seam") {
        runTest {
            val dao = FakeEntryDao()
            val repo = repoWithTeleworkDays(dao)
            val store = InMemoryStore(settings(rate = 100))
            val saver = RecordingSaver()
            val controller = ParametresController(saver, store, repo, TAX_YEAR, this)
            advanceUntilIdle()

            controller.onEmploymentRateChange("50")
            controller.save()
            advanceUntilIdle()
            controller.confirmSave()
            advanceUntilIdle()

            saver.bodies.size shouldBe 1
            saver.bodies.single().contains("\"employmentRate\":50").shouldBeTrue()
            store.load()?.employmentRate shouldBe 50
            controller.state.value.pendingRateChange shouldBe null
            controller.state.value.phase shouldBe ParametresPhase.SAVED
        }
    }

    test("R290: cancelling a consequential change discards it - nothing is saved") {
        runTest {
            val dao = FakeEntryDao()
            val repo = repoWithTeleworkDays(dao)
            val store = InMemoryStore(settings(rate = 100))
            val saver = RecordingSaver()
            val controller = ParametresController(saver, store, repo, TAX_YEAR, this)
            advanceUntilIdle()

            controller.onEmploymentRateChange("50")
            controller.save()
            advanceUntilIdle()
            controller.cancelSave()
            advanceUntilIdle()

            controller.state.value.pendingRateChange shouldBe null
            saver.bodies.size shouldBe 0
            store.load()?.employmentRate shouldBe 100
        }
    }

    test("a change that leaves the rate unchanged saves directly, without the before/after dialog") {
        runTest {
            // Canton GE -> ZH: both the SOURCE regime, so the declarable rate does not move. A consequential
            // FIELD changed, but R290 gates on the rate MOVING, not on which field - so this saves directly.
            val dao = FakeEntryDao()
            val repo = repoWithTeleworkDays(dao)
            val store = InMemoryStore(settings())
            val saver = RecordingSaver()
            val controller = ParametresController(saver, store, repo, TAX_YEAR, this)
            advanceUntilIdle()

            controller.onCantonChange(Canton.ZH)
            controller.save()
            advanceUntilIdle()

            controller.state.value.pendingRateChange shouldBe null
            saver.bodies.size shouldBe 1
            store.load()?.canton shouldBe "ZH"
            controller.state.value.phase shouldBe ParametresPhase.SAVED
        }
    }

    test("R290: a granularity switch the recorded days cannot support is refused, not silently saved") {
        runTest {
            // A half-day (AM) is recorded, and the settings are HALF_DAY. Switching decompte to DAY would make
            // the recorded half-day uncountable (GranularityMismatch) - the change invalidates the recorded
            // year. deviceDeclarableRate returns null for the edited settings; the controller must refuse it,
            // never read the null as "nothing moved" and save.
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            repo.record(RecordCommand(dayDate = "2026-03-04", kind = EntryKind.HOME, portion = Portion.AM))
            val store = InMemoryStore(settings(granularity = "HALF_DAY"))
            val saver = RecordingSaver()
            val controller = ParametresController(saver, store, repo, TAX_YEAR, this)
            advanceUntilIdle()

            controller.onGranularityChange(ch.monreleve.app.onboarding.GranularityChoice.DAY)
            controller.save()
            advanceUntilIdle()

            controller.state.value.error shouldBe SettingsError.CHANGE_CONFLICTS_WITH_RECORD
            saver.bodies.size shouldBe 0
            store.load()?.granularity shouldBe "HALF_DAY"
        }
    }

    test("an invalid rate names the field and does not save") {
        runTest {
            val dao = FakeEntryDao()
            val repo = repoWithTeleworkDays(dao)
            val store = InMemoryStore(settings(rate = 100))
            val saver = RecordingSaver()
            val controller = ParametresController(saver, store, repo, TAX_YEAR, this)
            advanceUntilIdle()

            controller.onEmploymentRateChange("nonsense")
            controller.save()
            advanceUntilIdle()

            controller.state.value.error.shouldNotBeNull()
            saver.bodies.size shouldBe 0
        }
    }

    // AN-STATE S4 (R310). The restore seed is proven on the JVM - the SavedStateHandle-shaped half of R310.
    test("a restored snapshot reopens the edited fields (R310)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            val store = InMemoryStore(settings(rate = 100))
            val controller =
                ParametresController(
                    RecordingSaver(),
                    store,
                    repo,
                    TAX_YEAR,
                    this,
                    restored = ParametresSnapshot(canton = Canton.VD, employmentRate = "80"),
                )
            advanceUntilIdle()
            controller.state.value.canton shouldBe Canton.VD
            controller.state.value.employmentRate shouldBe "80"
        }
    }

    test("a restored sign-out confirmation reopens with the unsynced count re-derived (R310)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = repoWithTeleworkDays(dao) // 10 pending (never synced) rows
            val store = InMemoryStore(settings(rate = 100))
            val controller =
                ParametresController(
                    RecordingSaver(),
                    store,
                    repo,
                    TAX_YEAR,
                    this,
                    restored = ParametresSnapshot(signOutOpen = true),
                )
            advanceUntilIdle()
            val prompt = controller.state.value.signOutPrompt
            prompt.shouldNotBeNull()
            prompt.unsyncedDays shouldBe 10 // re-derived from the record, not transcribed (R181)
        }
    }

    test("a restored delete confirmation reopens with counts re-derived (R310)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = repoWithTeleworkDays(dao)
            val store = InMemoryStore(settings(rate = 100))
            val controller =
                ParametresController(
                    RecordingSaver(),
                    store,
                    repo,
                    TAX_YEAR,
                    this,
                    restored = ParametresSnapshot(deleteOpen = true),
                )
            advanceUntilIdle()
            val prompt = controller.state.value.deletePrompt
            prompt.shouldNotBeNull()
            prompt.recordedDays shouldBe 10
        }
    }

    test("a restored R290 confirmation RECOMPUTES before/after and does NOT persist (R310)") {
        runTest {
            val dao = FakeEntryDao()
            val repo = repoWithTeleworkDays(dao) // the rate moves when denominator -> EXACT/120
            val store = InMemoryStore(settings(rate = 100))
            val saver = RecordingSaver()
            val controller =
                ParametresController(
                    saver,
                    store,
                    repo,
                    TAX_YEAR,
                    this,
                    // the edited fields that moved the rate, plus the flag that the confirm dialog was open.
                    restored =
                        ParametresSnapshot(
                            canton = Canton.GE,
                            employmentRate = "50",
                            denominator = DenominatorChoice.EXACT,
                            exactTotalWorkDays = "120",
                            saveConfirmOpen = true,
                        ),
                )
            advanceUntilIdle()
            // the before/after is recomputed from the record, not a persisted pair ...
            controller.state.value.pendingRateChange.shouldNotBeNull()
            // ... and crucially the restore did NOT commit (no PATCH, no local save).
            saver.bodies.size shouldBe 0
            store.load()?.employmentRate shouldBe 100
        }
    }

    test("AN-ALERT: the threshold-alert toggle flips the store and the state, off by default") {
        runTest {
            val dao = FakeEntryDao()
            val repo = LocalEntryRepository(dao, CLOCK)
            val store = InMemoryStore(settings())
            val alertStore = InMemoryThresholdAlertStore()
            val controller =
                ParametresController(RecordingSaver(), store, repo, TAX_YEAR, this, thresholdAlertStore = alertStore)
            advanceUntilIdle()

            controller.state.value.thresholdAlertEnabled shouldBe false

            controller.setThresholdAlert(true)
            alertStore.isEnabled().shouldBeTrue()
            controller.state.value.thresholdAlertEnabled.shouldBeTrue()

            controller.setThresholdAlert(false)
            alertStore.isEnabled() shouldBe false
            controller.state.value.thresholdAlertEnabled shouldBe false
        }
    }
})
