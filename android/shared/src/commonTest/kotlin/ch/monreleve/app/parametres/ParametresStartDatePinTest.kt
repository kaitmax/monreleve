package ch.monreleve.app.parametres

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.pilot.InMemorySettingsStore
import ch.monreleve.app.settings.Settings
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertTrue

// IOS-2e R827. THE START DATE'S VALIDATION, PINNED BEFORE ITS PARSER IS SWAPPED.
//
// ParametresController.validate refused a start date that java.time.LocalDate.parse could not read (after trimming
// it, a blank one meaning the whole year). R827 allows kotlinx.datetime.LocalDate.parse in its place ONLY if the two
// accept and refuse the same strings. This pin was written and run green against the java.time line as it stood,
// through the controller's public API (onActivityStartDateChange, save) - so what it pins is the VALIDATION a person
// meets, the trim included - and it builds the controller with an explicit test wire, kotlin.test only, so it can
// move to commonTest with the controller unedited (R829).
//
// Each vector records three things: the error the screen is given, the start dates the save sent (none, the whole year
// as null, or the trimmed day), and whatever was thrown. Accepted days in the tax year save; a day the parser accepts
// but the engine places outside the period is PERIOD_INVALID (the engine's judgement, R196), never START_DATE_INVALID.
// Every mismatch is collected before failing.

private const val TAX_YEAR = 2026
private val STORED = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

/** What one start date did: the error shown, the start dates sent with a save, and anything thrown. */
private data class Seen(
    val error: SettingsError?,
    val sent: List<String?>,
    val thrown: String? = null,
)

private val SAVED_WHOLE_YEAR = Seen(null, listOf(null))
private val REFUSED = Seen(SettingsError.START_DATE_INVALID, emptyList())
private val OUTSIDE_THE_PERIOD = Seen(SettingsError.PERIOD_INVALID, emptyList())

private fun saved(day: String) = Seen(null, listOf(day))

@OptIn(ExperimentalCoroutinesApi::class)
class ParametresStartDatePinTest {
    private class PatchWire : ParametresWire {
        val sent = mutableListOf<Settings>()

        override fun patchBody(settings: Settings): String {
            sent += settings
            return "patch"
        }

        override fun consentBody(enable: Boolean): String = "consent"

        override fun reminderBody(enable: Boolean): String = "reminder"

        override fun deleteBody(): String = "delete"

        override fun parseReceipt(body: String): DeleteOutcome.Done = DeleteOutcome.Done(0, false)
    }

    private class Accepting : SettingsSaver {
        override suspend fun saveSettings(body: String): PostOutcome = PostOutcome.Ok(200, "{}")
    }

    private class NoRows : EntryRepository {
        override suspend fun record(command: RecordCommand): RecordResult =
            throw UnsupportedOperationException("Parametres never records a day")

        override fun observePending(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())

        override fun observeAll(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())
    }

    private fun TestScope.attempt(start: String): Seen {
        val wire = PatchWire()
        val controller =
            ParametresController(
                saver = Accepting(),
                store = InMemorySettingsStore(STORED),
                repository = NoRows(),
                taxYear = TAX_YEAR,
                scope = backgroundScope,
                wire = wire,
            )
        runCurrent()
        controller.onActivityStartDateChange(start)
        val thrown = runCatching { controller.save() }.exceptionOrNull()
        runCurrent()
        val sent = wire.sent.map { it.activityStartDate }
        return Seen(controller.state.value.error, sent, thrown?.let { it::class.simpleName })
    }

    @Test
    fun eachStartDateIsAcceptedOrRefusedAsTheValidationDidOnJavaTime() =
        runTest {
            val vectors =
                listOf(
                    // plain, and the leap-day pair
                    "2026-03-01" to saved("2026-03-01"),
                    "2024-02-29" to saved("2024-02-29"),
                    "2026-02-29" to REFUSED,
                    // impossible days and months
                    "2026-04-31" to REFUSED,
                    "2026-13-01" to REFUSED,
                    "2026-00-10" to REFUSED,
                    "2026-01-00" to REFUSED,
                    "2026-01-32" to REFUSED,
                    // single-digit fields
                    "2026-1-5" to REFUSED,
                    "2026-01-5" to REFUSED,
                    "2026-1-05" to REFUSED,
                    // a sign, five-digit years, years 0 and -1
                    "+2026-01-05" to REFUSED,
                    "12026-01-05" to REFUSED,
                    "+12026-01-05" to OUTSIDE_THE_PERIOD,
                    "+10000-01-01" to OUTSIDE_THE_PERIOD,
                    "10000-01-01" to REFUSED,
                    "02026-01-05" to REFUSED,
                    "0000-01-01" to saved("0000-01-01"),
                    "-0001-12-31" to saved("-0001-12-31"),
                    // surrounding whitespace: the controller trims before it asks
                    " 2026-03-01 " to saved("2026-03-01"),
                    "\t2026-03-01\n" to saved("2026-03-01"),
                    // empty and blank: the whole year
                    "" to SAVED_WHOLE_YEAR,
                    "   " to SAVED_WHOLE_YEAR,
                    // a time or zone suffix, other shapes
                    "2026-03-01T00:00" to REFUSED,
                    "2026-03-01T00:00:00Z" to REFUSED,
                    "2026-03-01Z" to REFUSED,
                    "2026-03" to REFUSED,
                    "20260301" to REFUSED,
                    "2026/03/01" to REFUSED,
                    "01.03.2026" to REFUSED,
                    "2026-W09-7" to REFUSED,
                    "2026-060" to REFUSED,
                    "abc" to REFUSED,
                )
            val mismatches = mutableListOf<String>()
            for ((start, expected) in vectors) {
                val seen = attempt(start)
                if (seen != expected) mismatches += "<[$start]> gave $seen, expected $expected"
            }
            assertTrue(
                mismatches.isEmpty(),
                "start date: ${mismatches.size} mismatch(es)\n" + mismatches.joinToString("\n"),
            )
        }
}
