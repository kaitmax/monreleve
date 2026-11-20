package ch.monreleve.app.reminder

import ch.monreleve.app.detection.DetectionOutcome
import ch.monreleve.app.detection.EveningConditions
import ch.monreleve.app.detection.EveningNotice
import ch.monreleve.app.detection.eveningDecision
import ch.monreleve.app.push.pushReminderDecision
import ch.monreleve.app.push.reminderDayOf
import ch.monreleve.app.push.showOncePerDay
import ch.monreleve.app.settings.InMemoryEveningNotificationStore
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.ZoneId

// AN-MANUAL-REMINDER (R1140, R1141). THE 19:00 FALLBACK (P4), PROVEN RULE BY RULE AND PAIR BY PAIR.
//
// Every path that can post the evening notification goes through showOncePerDay against ONE store. P4 is driven here
// exactly as its glue drives it (reminder/FallbackReminderRuntime.kt maybeRemindAtFallback: fallbackReminderDecision
// inside showOncePerDay), beside P1 (the push, as push/PushRuntime.kt maybeRemindFromPush drives it) and P2
// (SamplingWorker's evening notice, as detection/EveningNotifier.kt maybeNotifyEvening drives it). A pair that shows
// twice fails here, whichever order it arrives in. Every refusal sits beside the positive it differs from by ONE fact.

private const val TODAY = "2026-11-20" // a Friday
private const val YESTERDAY = "2026-11-19"
private val PARIS: ZoneId = ZoneId.of("Europe/Paris")
private val LONDON: ZoneId = ZoneId.of("Europe/London")

private fun conditions(
    autoMode: Boolean = false,
    hasEntryToday: Boolean = false,
    optedIn: Boolean = true,
    workingDay: Boolean = true,
) = EveningConditions(
    optedIn = optedIn,
    autoMode = autoMode,
    workingDay = workingDay,
    hasEntryToday = hasEntryToday,
    // Never what P4 reads: its own time gate answers R339's "day concluded" (the decision must substitute it).
    dayConcluded = false,
    alreadyNotified = false,
)

private fun at(iso: String): Instant = Instant.parse(iso)

/** The next 19:00 after [now], in [zone] (Paris unless named). */
private fun next(
    now: String,
    zone: ZoneId = PARIS,
): Instant = nextFallbackAt(at(now), zone)

private fun reached(now: String): Boolean = reachedFallbackTime(at(now), PARIS)

private val REMINDER = mapOf("kind" to "daily_reminder", "day" to TODAY, "mode" to "MANUAL")

class FallbackReminderTest {
    private val store = InMemoryEveningNotificationStore(enabled = true)
    private val shown = mutableListOf<String>()

    /** P4, as maybeRemindAtFallback drives it. */
    @Suppress("LongParameterList")
    private fun fallback(
        signedIn: Boolean = true,
        pushAvailable: Boolean = false,
        permitted: Boolean = true,
        reached: Boolean = true,
        state: EveningConditions = conditions(),
    ): EveningNotice? =
        runBlocking {
            showOncePerDay(
                TODAY,
                store,
                decide = { already ->
                    fallbackReminderDecision(
                        signedIn,
                        pushAvailable,
                        permitted,
                        reached,
                        state.copy(alreadyNotified = already),
                    )
                },
                post = { shown += "fallback" },
            )
        }

    /** P1, the push, as maybeRemindFromPush drives it. */
    private fun push(state: EveningConditions = conditions()): EveningNotice? =
        runBlocking {
            showOncePerDay(
                TODAY,
                store,
                decide = { already ->
                    pushReminderDecision(
                        reminderDayOf(REMINDER),
                        true,
                        TODAY,
                        state.copy(alreadyNotified = already),
                        DetectionOutcome.NotSure,
                    )
                },
                post = { shown += "push" },
            )
        }

    /** P2, SamplingWorker's evening notice (auto mode, the day concluded), as maybeNotifyEvening drives it. */
    private fun sampling(): EveningNotice? =
        runBlocking {
            showOncePerDay(
                TODAY,
                store,
                decide = { already ->
                    val state = conditions(autoMode = true).copy(dayConcluded = true, alreadyNotified = already)
                    eveningDecision(state, DetectionOutcome.NotSure)
                },
                post = { shown += "sampling" },
            )
        }

    // ---- THE RULES (R1141): the positive, then each refusal beside it ----

    @Test
    fun manualModeWithoutPushAt19ShowsTheManualQuestionAndTakesTheDay() {
        assertEquals(EveningNotice.Manual, fallback())
        assertEquals(TODAY, store.lastNotifiedDay())
        assertEquals(listOf("fallback"), shown)
    }

    @Test
    fun pushAvailableShowsNothingAndLeavesTheDayToThePush() {
        assertNull("the server reminds this phone (Android Ruling 7)", fallback(pushAvailable = true))
        assertNull(store.lastNotifiedDay())
    }

    @Test
    fun autoModeShowsNothingTheEveningNoticeIsSamplingWorkers() {
        assertNull(fallback(state = conditions(autoMode = true)))
        assertNull(store.lastNotifiedDay())
    }

    @Test
    fun signedOutShowsNothing() {
        assertNull("Android Ruling 8: the SIGNED-OUT row", fallback(signedIn = false))
        assertNull(store.lastNotifiedDay())
    }

    @Test
    fun todayConfirmedShowsNothing() {
        assertNull(fallback(state = conditions(hasEntryToday = true)))
        assertNull(store.lastNotifiedDay())
    }

    @Test
    fun beforeTheReminderTimeShowsNothing() {
        assertNull(fallback(reached = false))
        assertNull(store.lastNotifiedDay())
    }

    @Test
    fun theOptInThePermissionAndTheWorkingDayStillApply() {
        assertNull("opted out on this phone (R1142)", fallback(state = conditions(optedIn = false)))
        assertNull("POST_NOTIFICATIONS refused (R1142)", fallback(permitted = false))
        assertNull("a weekend", fallback(state = conditions(workingDay = false)))
        assertNull("nothing shown takes no day", store.lastNotifiedDay())
        // ...and the same phone with every fact restored shows it: the refusals were the facts, not the store.
        assertEquals(EveningNotice.Manual, fallback())
    }

    // ---- EXACTLY ONE A DAY (Android Ruling 7): every pair with P4, both orders ----

    @Test
    fun pairFallbackThenFallbackShowsOne() {
        fallback()
        assertNull("a second wake the same evening", fallback())
        assertEquals(listOf("fallback"), shown)
    }

    @Test
    fun pairPushThenFallbackShowsOne() {
        push()
        assertNull("the fallback finds the day taken by the push", fallback())
        assertEquals(listOf("push"), shown)
    }

    @Test
    fun pairFallbackThenPushShowsOne() {
        fallback()
        assertNull("a push delivered after the fallback finds the day taken", push())
        assertEquals(listOf("fallback"), shown)
    }

    @Test
    fun pairSamplingThenFallbackShowsOne() {
        sampling()
        // The person switched to manual after the auto-mode notice: the day is still taken.
        assertNull(fallback())
        assertEquals(listOf("sampling"), shown)
    }

    @Test
    fun pairFallbackThenSamplingShowsOne() {
        fallback()
        assertNull("the person switched to auto after the fallback: the day is taken", sampling())
        assertEquals(listOf("fallback"), shown)
    }

    @Test
    fun aFallbackThatShowedNothingDoesNotTakeTheDay() {
        fallback(pushAvailable = true)
        assertEquals("a later path decides on its own facts", EveningNotice.Manual, push())
    }

    @Test
    fun yesterdaysReminderDoesNotTakeToday() {
        store.markNotified(YESTERDAY)
        assertEquals(EveningNotice.Manual, fallback())
    }

    // ---- THE TIME (R1140): device-local 19:00, a target, re-planned from the zone in force ----

    @Test
    fun theNextReminderIsTodaysWhileItIsAheadAndTomorrowsOnceItHasPassed() {
        // 17:00 in Paris (16:00Z) -> today 19:00 Paris = 18:00Z.
        assertEquals(at("2026-11-20T18:00:00Z"), next("2026-11-20T16:00:00Z"))
        // Exactly 19:00 has passed -> strictly after: tomorrow's.
        assertEquals(at("2026-11-21T18:00:00Z"), next("2026-11-20T18:00:00Z"))
        assertEquals(at("2026-11-21T18:00:00Z"), next("2026-11-20T21:30:00Z"))
    }

    @Test
    fun theSameInstantInAnotherZonePlansThatZonesNineteenHundred() {
        // A time-zone change re-plans: the same moment reads 19:00 London = 19:00Z, an hour after Paris's.
        assertEquals(at("2026-11-20T19:00:00Z"), next("2026-11-20T16:00:00Z", LONDON))
    }

    @Test
    fun aDaylightSavingChangeKeepsNineteenHundredLocal() {
        // Europe/Paris leaves summer time on 2026-10-25: 19:00 is 17:00Z the day before, 18:00Z that day.
        assertEquals(at("2026-10-24T17:00:00Z"), next("2026-10-24T10:00:00Z"))
        assertEquals(at("2026-10-25T18:00:00Z"), next("2026-10-24T20:00:00Z"))
        // ...and enters it on 2026-03-29: 18:00Z the day before, 17:00Z that day.
        assertEquals(at("2026-03-29T17:00:00Z"), next("2026-03-28T19:00:00Z"))
    }

    @Test
    fun theTimeGateIsAtOrAfterNineteenHundredOnTheLocalDay() {
        assertFalse(reached("2026-11-20T17:59:59Z")) // 18:59:59 Paris
        assertTrue(reached("2026-11-20T18:00:00Z")) // 19:00 Paris
        assertTrue("a late wake still counts", reached("2026-11-20T21:45:00Z"))
        assertFalse("past local midnight the day is over", reached("2026-11-20T23:30:00Z"))
    }

    @Test
    fun aRebootReplansFromTheZoneInForceAndCatchesUpAMissedEvening() {
        // Booted at 17:00 Paris: today's 19:00 Paris, from the zone the phone has NOW (not the one it had before).
        assertEquals(at("2026-11-20T18:00:00Z"), bootFallbackAt(at("2026-11-20T16:00:00Z"), PARIS))
        assertEquals(at("2026-11-20T19:00:00Z"), bootFallbackAt(at("2026-11-20T16:00:00Z"), LONDON))
        // Off at 19:00, booted at 21:30 Paris: the evening is decided now, not skipped to tomorrow.
        assertEquals(at("2026-11-20T20:30:00Z"), bootFallbackAt(at("2026-11-20T20:30:00Z"), PARIS))
        // Booted after local midnight: that day's evening is still ahead.
        assertEquals(at("2026-11-21T18:00:00Z"), bootFallbackAt(at("2026-11-20T23:30:00Z"), PARIS))
    }

    // ---- ONE WAKE (R1141): signed out cancels and plans nothing; signed in reminds and plans the next ----

    @Test
    fun aSignedOutWakeCancelsItsScheduleAndPlansNothing() {
        val calls = mutableListOf<String>()
        val wake =
            runBlocking {
                fallbackWake(
                    signedIn = { false },
                    cancelOwnSchedule = { calls += "cancel" },
                    remind = {
                        calls += "remind"
                        EveningNotice.Manual
                    },
                    planNext = { calls += "plan" },
                )
            }
        assertEquals(FallbackWake.SIGNED_OUT_CANCELLED, wake)
        assertEquals(listOf("cancel"), calls)
    }

    @Test
    fun aSignedInWakeRemindsThenPlansTheNextWhateverItShowed() {
        val calls = mutableListOf<String>()
        val shownWake =
            runBlocking {
                fallbackWake({ true }, { calls += "cancel" }, { EveningNotice.Manual.also { calls += "remind" } }) {
                    calls += "plan"
                }
            }
        val quietWake =
            runBlocking {
                fallbackWake({ true }, { calls += "cancel" }, { null.also { calls += "remind" } }) { calls += "plan" }
            }
        assertEquals(FallbackWake.SHOWN to FallbackWake.NOTHING_SHOWN, shownWake to quietWake)
        assertEquals(listOf("remind", "plan", "remind", "plan"), calls)
    }

    @Test
    fun aWakeWhoseReminderThrowsStillPlansTheNextAndReturnsNormally() {
        // The wake must RETURN, not rethrow: a worker that throws is FAILED, and WorkManager fails the link the wake
        // has just APPENDed with it - one bad evening would end the schedule until the next shell launch.
        val calls = mutableListOf<String>()
        val wake =
            runBlocking {
                fallbackWake({ true }, { calls += "cancel" }, { error("the database could not be opened") }) {
                    calls += "plan"
                }
            }
        assertEquals(FallbackWake.REMIND_FAILED, wake)
        assertEquals("one failed evening must not end the schedule", listOf("plan"), calls)
    }

    // ---- R1147: the opt-in restored at RESOLVING ----

    @Test
    fun theRestoredOptInIsOnOnlyWhenTheServerHoldsItAndThePhoneMayNotify() {
        assertTrue(restoredEveningOptIn(serverOn = true, notificationsPermitted = true))
        assertFalse("no permission: never a switch that cannot deliver", restoredEveningOptIn(true, false))
        assertFalse(restoredEveningOptIn(false, true))
        assertFalse(restoredEveningOptIn(false, false))
    }
}
