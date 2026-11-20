package ch.monreleve.app.push

import ch.monreleve.app.detection.DetectionOutcome
import ch.monreleve.app.detection.EveningConditions
import ch.monreleve.app.detection.EveningNotice
import ch.monreleve.app.detection.eveningDecision
import ch.monreleve.app.settings.InMemoryEveningNotificationStore
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// AN-FCM-CLIENT (R1152, Android Rulings 7 and 8). THE PATH TABLE, PROVEN PAIR BY PAIR.
//
// Every path that can post the evening notification goes through showOncePerDay against ONE store. The two paths
// built today are driven here exactly as their glue drives them - the push with pushReminderDecision
// (push/PushRuntime.kt maybeRemindFromPush), SamplingWorker's evening notice with eveningDecision
// (detection/EveningNotifier.kt maybeNotifyEvening) - so a pair that shows twice fails here, whichever order it
// arrives in. A7's 19:00 fallback joins through the same function (REPORT-AN-FCM-CLIENT.txt THE PATH TABLE).

private const val TODAY = "2026-11-20" // a Friday
private const val YESTERDAY = "2026-11-19"

private fun conditions(
    autoMode: Boolean = false,
    hasEntryToday: Boolean = false,
    dayConcluded: Boolean = false,
    optedIn: Boolean = true,
    workingDay: Boolean = true,
) = EveningConditions(
    optedIn = optedIn,
    autoMode = autoMode,
    workingDay = workingDay,
    hasEntryToday = hasEntryToday,
    dayConcluded = dayConcluded,
    alreadyNotified = false,
)

private val REMINDER = mapOf("kind" to "daily_reminder", "day" to TODAY, "mode" to "MANUAL")

class PushReceiptTest {
    private val store = InMemoryEveningNotificationStore(enabled = true)
    private val shown = mutableListOf<Pair<String, EveningNotice>>()

    /** The push path, as maybeRemindFromPush drives it. */
    private fun push(
        data: Map<String, String> = REMINDER,
        signedIn: Boolean = true,
        state: EveningConditions = conditions(),
        outcome: DetectionOutcome = DetectionOutcome.NotSure,
    ): EveningNotice? =
        runBlocking {
            showOncePerDay(
                TODAY,
                store,
                decide = { already ->
                    pushReminderDecision(
                        reminderDayOf(data),
                        signedIn,
                        TODAY,
                        state.copy(alreadyNotified = already),
                        outcome,
                    )
                },
                post = { shown += "push" to it },
            )
        }

    /** SamplingWorker's evening notice, as maybeNotifyEvening drives it (auto mode, the day concluded). */
    private fun sampling(state: EveningConditions = conditions(autoMode = true, dayConcluded = true)): EveningNotice? =
        runBlocking {
            showOncePerDay(
                TODAY,
                store,
                decide = { already ->
                    eveningDecision(state.copy(alreadyNotified = already), DetectionOutcome.NotSure)
                },
                post = { shown += "sampling" to it },
            )
        }

    @Test
    fun thePayloadIsReadOnlyWhenItIsADailyReminderForAnIsoDay() {
        assertEquals(TODAY, reminderDayOf(REMINDER))
        assertNull(reminderDayOf(REMINDER + ("kind" to "something_newer")))
        assertNull(reminderDayOf(REMINDER - "kind"))
        assertNull(reminderDayOf(REMINDER + ("day" to "20.11.2026")))
        assertNull(reminderDayOf(REMINDER - "day"))
        assertNull(reminderDayOf(emptyMap()))
    }

    @Test
    fun aPushedReminderShowsTheManualQuestionAtTheReminderTime() {
        // R339's dayConcluded is the push itself: 17:30 precedes the day's last check window.
        assertEquals(EveningNotice.Manual, push(state = conditions(dayConcluded = false)))
        assertEquals(TODAY, store.lastNotifiedDay())
        assertEquals(listOf("push"), shown.map { it.first })
    }

    @Test
    fun inAutoModeThePhoneChoosesTheWordsNotThePayload() {
        // The payload says MANUAL; the phone is in auto mode with nothing to propose: the not-sure invitation.
        assertEquals(EveningNotice.NotSure, push(state = conditions(autoMode = true)))
    }

    @Test
    fun signedOutShowsNothing() {
        assertNull("Android Ruling 8: the SIGNED-OUT row", push(signedIn = false))
        assertNull(store.lastNotifiedDay())
    }

    @Test
    fun aLateReminderForAnotherDayShowsNothing() {
        assertNull(push(data = REMINDER + ("day" to YESTERDAY)))
        assertNull(store.lastNotifiedDay())
    }

    @Test
    fun todayConfirmedOnThePhoneShowsNothing() {
        assertNull(push(state = conditions(hasEntryToday = true)))
    }

    @Test
    fun theOptInAndTheWorkingDayStillApply() {
        assertNull("opted out on this phone", push(state = conditions(optedIn = false)))
        assertNull("the server has no weekday filter; the phone does", push(state = conditions(workingDay = false)))
    }

    @Test
    fun pairPushThenPushShowsOne() {
        push()
        assertNull("a duplicate delivery the same day", push())
        assertEquals(1, shown.size)
    }

    @Test
    fun pairPushThenSamplingShowsOne() {
        push()
        assertNull("SamplingWorker finds the day taken", sampling())
        assertEquals(listOf("push"), shown.map { it.first })
    }

    @Test
    fun pairSamplingThenPushShowsOne() {
        sampling()
        assertNull("the push finds the day taken", push(state = conditions(autoMode = true)))
        assertEquals(listOf("sampling"), shown.map { it.first })
    }

    @Test
    fun aPushThatShowedNothingDoesNotTakeTheDay() {
        push(state = conditions(hasEntryToday = true))
        assertNull(store.lastNotifiedDay())
        // ...so a later path is decided on its own facts, not silenced by a push that said nothing.
        assertEquals(EveningNotice.NotSure, sampling())
    }

    @Test
    fun yesterdaysReminderDoesNotTakeToday() {
        store.markNotified(YESTERDAY)
        assertEquals(EveningNotice.Manual, push())
    }
}
