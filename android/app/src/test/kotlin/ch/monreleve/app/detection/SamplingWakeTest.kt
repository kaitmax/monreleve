package ch.monreleve.app.detection

import ch.monreleve.app.data.local.TallyDao
import ch.monreleve.app.data.local.TallyEntity
import ch.monreleve.app.settings.LoggingMode
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.runTest
import java.time.Clock
import java.time.Instant
import java.time.ZoneId

// AN-SESSION-END (R1180, R1182). THE WORKER GUARD: A WAKE FOR NOBODY TAKES NO FIX.
//
// A3's N3 (REPORT-AN-API36-PASS.txt): after a sign-out the sampler stayed scheduled, and the wake checked only the
// window and today's tally - so at its next window it would have asked the OS for a location fix for nobody. The
// guard carries the load whatever ended the session or the mode: before anything else a wake asks whether a session
// exists AND the phone's mode is automatic; if either is missing it requests NO fix and cancels its own schedule.
//
// The location layer is reached through ONE door, requestFix, and the fake behind it COUNTS requests - so "no fix"
// is asserted as zero requests, not inferred from an empty tally (R154: proven to deliver, both sides - R1182). Each
// missing condition is tested ALONE (no session with the mode still automatic; a session in manual mode), because
// both sign-out scopes clear the mode too, and a guard that read only the mode would pass a test that removed both.

/** Inside window 1 (09:00-10:00 Paris): 09:45 Paris on a November day is 08:45 UTC. */
private val IN_WINDOW: Clock = Clock.fixed(Instant.parse("2026-11-19T08:45:00Z"), ZoneId.of("UTC"))

/** Between windows 1 and 2: 10:15 Paris. */
private val BETWEEN_WINDOWS: Clock = Clock.fixed(Instant.parse("2026-11-19T09:15:00Z"), ZoneId.of("UTC"))

private const val TODAY = "2026-11-19"

/** The location layer as the wake sees it: every request counted, each answered with one classified fix. */
private class CountingFixSource {
    var requests = 0
        private set

    suspend fun request(): ProviderFix? {
        requests += 1
        return ProviderFix(Classification.INSIDE, FixProvider.GPS)
    }
}

private class MemoryTallyDao : TallyDao {
    val rows = mutableMapOf<String, TallyEntity>()

    override suspend fun upsert(tally: TallyEntity) {
        rows[tally.dayDate] = tally
    }

    override suspend fun byDay(dayDate: String): TallyEntity? = rows[dayDate]

    override suspend fun all(): List<TallyEntity> = rows.values.sortedBy { it.dayDate }

    override fun observeAll(): Flow<List<TallyEntity>> = flowOf(rows.values.sortedBy { it.dayDate })
}

/** One wake's world: the session and the mode as the worker reads them, at use, and what the wake did to it. */
private class WakeRig(
    var signedIn: Boolean,
    var mode: LoggingMode,
) {
    val fixes = CountingFixSource()
    val dao = MemoryTallyDao()
    var cancels = 0
    var notificationsOffered = 0

    suspend fun wake(clock: Clock = IN_WINDOW): WakeOutcome =
        samplingWake(
            clock,
            signedIn = { signedIn },
            loggingMode = { mode },
            cancelOwnSchedule = { cancels += 1 },
            offerNotifications = { notificationsOffered += 1 },
            tallies = { dao },
            requestFix = fixes::request,
        )
}

class SamplingWakeTest : FunSpec({
    test("R1182 POSITIVE: signed in, automatic, inside an empty window -> ONE fix, written, the schedule kept") {
        runTest {
            val rig = WakeRig(signedIn = true, mode = LoggingMode.AUTO_DETECT)

            rig.wake() shouldBe WakeOutcome.SAMPLED

            rig.fixes.requests shouldBe 1
            rig.dao.byDay(TODAY)?.check1 shouldBe Classification.INSIDE.name
            rig.cancels shouldBe 0
            rig.notificationsOffered shouldBe 1
        }
    }

    test("R1180: NO SESSION, the mode still automatic -> NO fix is requested, and the sampler cancels itself") {
        runTest {
            val rig = WakeRig(signedIn = false, mode = LoggingMode.AUTO_DETECT)

            val outcome = rig.wake()

            rig.fixes.requests shouldBe 0
            outcome shouldBe WakeOutcome.ENDED_NO_SESSION
            rig.dao.rows shouldBe emptyMap()
            rig.cancels shouldBe 1
            // The worker exists for a signed-in person in automatic mode; for nobody it offers nothing either.
            rig.notificationsOffered shouldBe 0
        }
    }

    test("R1180: SIGNED IN BUT MANUAL -> NO fix is requested, and the sampler cancels itself") {
        runTest {
            val rig = WakeRig(signedIn = true, mode = LoggingMode.MANUAL)

            val outcome = rig.wake()

            rig.fixes.requests shouldBe 0
            outcome shouldBe WakeOutcome.ENDED_NOT_AUTOMATIC
            rig.dao.rows shouldBe emptyMap()
            rig.cancels shouldBe 1
            rig.notificationsOffered shouldBe 0
        }
    }

    test("R1180: no session AND manual (what a sign-out leaves) -> no fix, cancelled") {
        runTest {
            val rig = WakeRig(signedIn = false, mode = LoggingMode.MANUAL)

            val outcome = rig.wake()

            rig.fixes.requests shouldBe 0
            outcome shouldBe WakeOutcome.ENDED_NO_SESSION
            rig.cancels shouldBe 1
        }
    }

    test("R1180/R1182: read AT EACH WAKE - a sign-out between two wakes stops the second") {
        runTest {
            val rig = WakeRig(signedIn = true, mode = LoggingMode.AUTO_DETECT)
            rig.wake(BETWEEN_WINDOWS) shouldBe WakeOutcome.NO_WINDOW
            rig.cancels shouldBe 0 // between windows, for a signed-in automatic person: the schedule is theirs, kept

            rig.signedIn = false
            val outcome = rig.wake()

            rig.fixes.requests shouldBe 0
            outcome shouldBe WakeOutcome.ENDED_NO_SESSION
            rig.cancels shouldBe 1
        }
    }

    test("R1182 POSITIVE: a window already sampled today asks for no second fix, and keeps the schedule") {
        runTest {
            val rig = WakeRig(signedIn = true, mode = LoggingMode.AUTO_DETECT)
            rig.wake() shouldBe WakeOutcome.SAMPLED
            rig.wake() shouldBe WakeOutcome.WINDOW_DONE

            rig.fixes.requests shouldBe 1
            rig.cancels shouldBe 0
        }
    }
})
