package ch.monreleve.app.onboarding

import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import kotlin.test.Test
import kotlin.test.assertEquals

// AN-MANUAL-REMINDER (R1145, Android Ruling 12 / A12 Q3). THE EVENING OPT-IN IS WRITTEN ONLY AFTER A 2xx.
//
// Onboarding's « Oui, me le rappeler » used to turn the phone's evening reminder on BEFORE the save, so a save the
// server refused left the reminder on for settings that were never taken. Now the opt-in TRAVELS in the save
// (reminderEnabled in the same PATCH, so the server - which R1147 reads back at the next sign-in - holds what the
// person chose) and reaches the phone through onReminderSaved only once that PATCH is ACCEPTED. Every refusal sits
// beside its 2xx positive (R196); the order of the writes is asserted (mode, opt-in, then the settings that send the
// next launch past RESOLVING). A partial onboarding, which never asks the question, neither sends nor hands on an
// opt-in - it must not overwrite the server's. commonTest, so the iOS simulator runs it too.

private const val TAX_YEAR = 2026

private class OptInSaver(private val answer: PostOutcome) : SettingsSaver {
    val bodies = mutableListOf<String>()

    override suspend fun saveSettings(body: String): PostOutcome {
        bodies += body
        return answer
    }
}

private class OptInStore(private val writes: MutableList<String>) : SettingsStore {
    var saved: Settings? = null

    override fun load(): Settings? = saved

    override fun save(settings: Settings) {
        writes += "settings"
        saved = settings
    }

    override fun clear() {
        saved = null
    }
}

/** One onboarding, recording the body's opt-in argument and every hand-off, in order. */
private class OptInRig(
    scope: CoroutineScope,
    answer: PostOutcome,
    restored: OnboardingSnapshot? = null,
) {
    val writes = mutableListOf<String>()
    val sentOptIns = mutableListOf<Boolean?>()
    val saver = OptInSaver(answer)
    val store = OptInStore(writes)
    val controller =
        OnboardingController(
            saver,
            store,
            TAX_YEAR,
            scope,
            restored,
            patchBody = { settings, reminderEnabled ->
                sentOptIns += reminderEnabled
                "patch:$settings"
            },
            onModeSaved = { writes += "mode" },
            onReminderSaved = { writes += "reminder:$it" },
        )

    /** The eight steps answered validly (manual), [reminder] at RAPPEL; the last next() is the save. */
    fun answerEverything(reminder: Boolean) {
        with(controller) {
            onNameChange("Camille Martin")
            next()
            onCantonChange(Canton.GE)
            next()
            onRateChoiceChange(RateChoice.R80)
            next()
            onDenominatorChange(DenominatorChoice.SIMPLIFIED240)
            next()
            onGranularityChange(GranularityChoice.DAY)
            next()
            onAllYearChange(true)
            next()
            onModeChange(ModeChoice.MANUAL)
            next()
            onReminderChange(reminder)
            next()
        }
    }
}

@OptIn(ExperimentalCoroutinesApi::class)
class OnboardingReminderOptInTest {
    @Test
    fun aTakenSaveCarriesTheOptInAndHandsItOnBeforeTheSettings() =
        runTest {
            for (choice in listOf(true, false)) {
                val rig = OptInRig(this, PostOutcome.Ok(200, "{}"))
                rig.answerEverything(reminder = choice)
                advanceUntilIdle()

                assertEquals(OnboardingPhase.READY, rig.controller.state.value.phase, "reminder=$choice")
                assertEquals(listOf<Boolean?>(choice), rig.sentOptIns, "reminder=$choice: the PATCH carries it")
                assertEquals(listOf("reminder:$choice", "settings"), rig.writes, "reminder=$choice")
            }
        }

    @Test
    fun aRefusedOrFailedSaveSentTheOptInButHandsNothingOn() =
        runTest {
            val notTaken =
                listOf(
                    PostOutcome.Ok(422, """{"status":"error","code":"x"}"""),
                    PostOutcome.Ok(500, "{}"),
                    PostOutcome.NetworkError,
                    PostOutcome.SessionExpired,
                    PostOutcome.SessionEnded,
                )
            for (answer in notTaken) {
                val rig = OptInRig(this, answer)
                rig.answerEverything(reminder = true)
                advanceUntilIdle()

                // Positive control: the save WAS attempted with the opt-in - the absence below is not an unsent save.
                assertEquals(listOf<Boolean?>(true), rig.sentOptIns, "$answer")
                assertEquals(emptyList(), rig.writes, "$answer: the phone's opt-in is left as it was")
            }
        }

    @Test
    fun theRetryAfterARefusalHandsTheOptInOnOnce() =
        runTest {
            val rig = OptInRig(this, PostOutcome.Ok(200, "{}"))
            val refused = OptInRig(this, PostOutcome.Ok(422, "{}"))
            refused.answerEverything(reminder = true)
            advanceUntilIdle()
            assertEquals(emptyList(), refused.writes)
            // The taken side of the same step, for the same answer: exactly one hand-off.
            rig.answerEverything(reminder = true)
            advanceUntilIdle()
            assertEquals(listOf("reminder:true", "settings"), rig.writes)
        }

    @Test
    fun aPartialOnboardingNeverAsksSoItNeitherSendsNorHandsOnAnOptIn() =
        runTest {
            val partial =
                OnboardingSnapshot(
                    step = OnboardingStep.NOM,
                    name = "",
                    canton = Canton.GE,
                    rateChoice = RateChoice.R80,
                    customRate = "",
                    denominator = DenominatorChoice.SIMPLIFIED240,
                    exactTotalWorkDays = "",
                    allYear = true,
                    activityStartDate = "",
                    mode = ModeChoice.MANUAL,
                    reminder = false,
                    granularity = GranularityChoice.DAY,
                    steps = listOf(OnboardingStep.NOM),
                )
            val rig = OptInRig(this, PostOutcome.Ok(200, "{}"), restored = partial)
            rig.controller.onNameChange("Camille Martin")
            rig.controller.next()
            advanceUntilIdle()

            assertEquals(OnboardingPhase.READY, rig.controller.state.value.phase)
            assertEquals(listOf<Boolean?>(null), rig.sentOptIns, "omitted: the server's value stands")
            assertEquals(listOf("settings"), rig.writes)
        }
}
