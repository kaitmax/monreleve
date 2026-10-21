package ch.monreleve.app.parametres

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.repo.FakeEntryDao
import ch.monreleve.app.data.repo.LocalEntryRepository
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldNotContain
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-CALENDAR (R475, found on the S9). A PARAMETRES SAVE KEEPS WHAT PARAMETRES DOES NOT EDIT.
//
// WHAT HAPPENED. With the controllers now reading the settings when they use them, switching « Décompte des
// journées » on the S9 turned Aujourd'hui's « Bonjour Test » into « Bonjour » at once. ParametresController builds
// the settings it saves from the six fields it edits and nothing else, and SettingsStore.save REPLACES the whole set
// (R447: "callers load, copy, and save the result") - so every save erased the holder's name from the device. The
// server kept it (the PATCH omits an absent name), and the next launch's completeness check (R335) fetched it back
// from /me, which is why nothing showed while Aujourd'hui kept a copy taken at construction. Reading at use made the
// gap visible for the rest of the session; this closes it.
//
// THE WIRE IS UNCHANGED, and that half is asserted too: the PATCH still carries only what the screen edits, so a
// save that does not touch the name says nothing about it to the server (MeWire: "omitted when absent").

private val CLOCK: Clock = Clock.fixed(Instant.parse("2026-06-15T10:00:00Z"), ZoneId.of("Europe/Paris"))

private class Stored(var current: Settings?) : SettingsStore {
    override fun load(): Settings? = current

    override fun save(settings: Settings) {
        current = settings
    }

    override fun clear() {
        current = null
    }
}

private class Patches : SettingsSaver {
    val bodies = mutableListOf<String>()

    override suspend fun saveSettings(body: String): PostOutcome {
        bodies += body
        return PostOutcome.Ok(200, "{}")
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class ParametresKeepsTheNameTest : FunSpec({
    test("R475 a Parametres save keeps the holder's name on the device, and says nothing about it to the server") {
        runTest {
            val store = Stored(Settings("GE", 100, "SIMPLIFIED240", null, "HALF_DAY", null, name = "Test Calendrier"))
            val patches = Patches()
            val repo = LocalEntryRepository(FakeEntryDao(), CLOCK)
            val controller = ParametresController(patches, store, repo, 2026, this)
            advanceUntilIdle()

            controller.onGranularityChange(GranularityChoice.DAY)
            controller.save()
            advanceUntilIdle()

            controller.state.value.phase shouldBe ParametresPhase.SAVED
            store.load()?.granularity shouldBe "DAY"
            store.load()?.name shouldBe "Test Calendrier"
            patches.bodies.single() shouldNotContain "\"name\""
        }
    }
})
