package ch.monreleve.app.parametres

import ch.monreleve.app.account.LocalStore
import ch.monreleve.app.auth.PostOutcome
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.repo.EntryRepository
import ch.monreleve.app.data.repo.RecordCommand
import ch.monreleve.app.data.repo.RecordResult
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.onboarding.SettingsSaver
import ch.monreleve.app.pilot.InMemorySettingsStore
import ch.monreleve.app.settings.Settings
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.json.JSONException
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

// IOS-2e R826. THE CONTROLLER'S FOUR org.json WIRE SITES, PINNED BYTE-EXACT BEFORE THEY BECOME A PARAMETER.
//
// ParametresController reached org.json at four places: the PATCH /api/v1/me body (MeWire.kt's Settings.mePatchBody),
// the detection-consent PATCH body (DetectionMode.kt's detectionConsentBody), the account-delete POST body and the
// parse of the delete receipt's "removed" map. This pin was written and run green against the controller AS IT STOOD
// (19ce23f), through its public API only - save(), setAutoDetection(), confirmDelete() and the state they leave - so
// it compiles, unedited, against the controller before and after the four sites became a parameter (:app's factory of
// the same name hands in the org.json implementations, which stay in :app - PARK-D3).
//
// WHICH org.json THIS RUNS AGAINST. android.jar's org.json is stubbed to throw under JVM tests (IOS-2b R778's
// finding); :app's test scope adds the real JVM library (app/build.gradle.kts, AN2's `testImplementation(libs.json
// .org)`). That library is NOT Android's implementation - its JSONObject keeps its keys in a HashMap, Android's in a
// LinkedHashMap, so the key ORDER below is the JVM library's. So this proves that routing the four sites through a
// parameter changed no body and no parse - the org.json code itself does not move - and NOT the bytes a phone sends.
//
// Every expected string below is a literal taken from the current code's own output (the oracle, R777's way) and
// checked by eye against MeWire.kt / DetectionMode.kt; the RED run on a verified plant is what makes it evidence.
// Each test collects every mismatch before failing, so one run names them all.

private const val TAX_YEAR = 2026
private val STORED = Settings("GE", 100, "SIMPLIFIED240", null, "DAY", null)

/** The PATCH /me body in the JVM org.json's key order, every value written as org.json writes it. */
private fun patchBody(s: Settings): String =
    "{\"activityStartDate\":${s.activityStartDate?.let { "\"$it\"" } ?: "null"}," +
        "\"denominatorKind\":\"${s.denominatorKind}\",\"exactTotalWorkDays\":${s.exactTotalWorkDays ?: "null"}," +
        "\"granularity\":\"${s.granularity}\",\"canton\":\"${s.canton}\",\"employmentRate\":${s.employmentRate}}"

private fun assertNone(
    what: String,
    mismatches: List<String>,
) = assertTrue(mismatches.isEmpty(), "$what: ${mismatches.size} mismatch(es)\n" + mismatches.joinToString("\n"))

@OptIn(ExperimentalCoroutinesApi::class)
class ParametresWirePinTest {
    private class RecordingSaver : SettingsSaver {
        val bodies = mutableListOf<String>()

        override suspend fun saveSettings(body: String): PostOutcome {
            bodies += body
            return PostOutcome.Ok(200, "{}")
        }
    }

    private class NoRows : EntryRepository {
        override suspend fun record(command: RecordCommand): RecordResult =
            throw UnsupportedOperationException("Parametres never records a day")

        override fun observePending(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())

        override fun observeAll(): Flow<List<EntryEntity>> = MutableStateFlow(emptyList())
    }

    private class SpyLocalStore : LocalStore {
        var deletions = 0

        override suspend fun clearForSignOut() = Unit

        override suspend fun clearForDeletion() {
            deletions++
        }
    }

    private class Posts(private val answer: PostOutcome) {
        val calls = mutableListOf<Pair<String, String>>()

        suspend fun post(
            path: String,
            body: String,
        ): PostOutcome {
            calls += path to body
            return answer
        }
    }

    private class Rig(
        val controller: ParametresController,
        val saver: RecordingSaver,
        val posts: Posts,
        val localStore: SpyLocalStore,
        val caught: MutableList<Throwable>,
        val scope: CoroutineScope,
    )

    private fun TestScope.rig(answer: PostOutcome = PostOutcome.Ok(200, "{}")): Rig {
        val caught = mutableListOf<Throwable>()
        val scope =
            CoroutineScope(
                StandardTestDispatcher(testScheduler) + SupervisorJob() +
                    CoroutineExceptionHandler { _, e -> caught += e },
            )
        val saver = RecordingSaver()
        val posts = Posts(answer)
        val localStore = SpyLocalStore()
        val controller =
            ParametresController(
                saver = saver,
                store = InMemorySettingsStore(STORED),
                repository = NoRows(),
                taxYear = TAX_YEAR,
                scope = scope,
                localStore = localStore,
                authenticatedPost = posts::post,
            )
        runCurrent()
        return Rig(controller, saver, posts, localStore, caught, scope)
    }

    @Test
    fun theMePatchBodyIsByteExactForEveryCantonMethodGranularityAndStart() =
        runTest {
            val mismatches = mutableListOf<String>()
            for (canton in Canton.entries) {
                for (denominator in DenominatorChoice.entries) {
                    for (granularity in GranularityChoice.entries) {
                        for (start in listOf("", "2026-03-01")) {
                            val r = rig()
                            r.controller.onCantonChange(canton)
                            r.controller.onDenominatorChange(denominator)
                            if (denominator == DenominatorChoice.EXACT) r.controller.onExactTotalChange("220")
                            r.controller.onGranularityChange(granularity)
                            r.controller.onActivityStartDateChange(start)
                            r.controller.save()
                            runCurrent()
                            val expected =
                                patchBody(
                                    Settings(
                                        canton.name,
                                        100,
                                        denominator.name,
                                        if (denominator == DenominatorChoice.EXACT) 220 else null,
                                        granularity.name,
                                        start.ifEmpty { null },
                                    ),
                                )
                            val tag = "<$canton, $denominator, $granularity, '$start'>"
                            if (r.saver.bodies != listOf(expected)) {
                                mismatches += "$tag sent ${r.saver.bodies}, not [$expected]"
                            }
                            r.scope.cancel()
                        }
                    }
                }
            }
            // The number form: one-, two- and three-digit rates and totals, written as JSON integers (never "55.0").
            for ((rate, total) in listOf(1 to 1, 55 to 99, 100 to 365)) {
                val r = rig()
                r.controller.onEmploymentRateChange(" $rate ")
                r.controller.onDenominatorChange(DenominatorChoice.EXACT)
                r.controller.onExactTotalChange("$total")
                r.controller.save()
                runCurrent()
                val expected = patchBody(Settings("GE", rate, "EXACT", total, "DAY", null))
                if (r.saver.bodies != listOf(expected)) {
                    mismatches += "<rate $rate, total $total> sent ${r.saver.bodies}"
                }
                r.scope.cancel()
            }
            assertNone("mePatchBody", mismatches)
        }

    @Test
    fun theDetectionConsentBodiesAreByteExactBothWays() =
        runTest {
            val r = rig()
            r.controller.setAutoDetection(true)
            runCurrent()
            r.controller.setAutoDetection(false)
            runCurrent()
            assertEquals(
                listOf(
                    "{\"detectionConsent\":true,\"loggingMode\":\"AUTO_DETECT\"}",
                    "{\"detectionConsent\":false}",
                ),
                r.saver.bodies,
                "detectionConsentBody: the two PATCH bodies, in order",
            )
            r.scope.cancel()
        }

    @Test
    fun theDeleteBodyIsByteExactOnItsPath() =
        runTest {
            val r = rig()
            r.controller.requestDelete()
            r.controller.confirmDelete()
            runCurrent()
            assertEquals(
                listOf("/api/v1/account/delete" to "{\"confirm\":\"SUPPRIMER\"}"),
                r.posts.calls,
                "deleteBody: one POST, its path and body",
            )
            r.scope.cancel()
        }

    @Test
    fun theDeleteReceiptIsParsedTheSameWayForEveryShape() =
        runTest {
            // (body, the outcome the person is shown, whether the device was erased)
            val vectors =
                listOf(
                    Triple(
                        "{\"status\":\"ok\",\"removed\":{\"User\":1,\"Entry\":2,\"EntryEvent\":2}," +
                            "\"alertSubscriptionRemains\":true}",
                        DeleteOutcome.Done(removedEntries = 2, alertSubscriptionRemains = true),
                        1,
                    ),
                    Triple(
                        "{\"status\":\"ok\",\"alertSubscriptionRemains\":false}",
                        DeleteOutcome.Done(removedEntries = 0, alertSubscriptionRemains = false),
                        1,
                    ),
                    Triple("{\"removed\":{\"User\":1}}", DeleteOutcome.Done(0, false), 1),
                    Triple("{\"removed\":3,\"alertSubscriptionRemains\":true}", DeleteOutcome.Done(0, true), 1),
                    Triple("{\"removed\":[1,2],\"alertSubscriptionRemains\":true}", DeleteOutcome.Done(0, true), 1),
                    Triple("{\"removed\":\"Entry\"}", DeleteOutcome.Done(0, false), 1),
                    Triple("{\"removed\":null,\"alertSubscriptionRemains\":null}", DeleteOutcome.Done(0, false), 1),
                    Triple(
                        "{\"removed\":{\"Entry\":\"7\"},\"alertSubscriptionRemains\":\"true\"}",
                        DeleteOutcome.Done(7, true),
                        1,
                    ),
                    Triple(
                        "{\"removed\":{\"Entry\":\"x\"},\"alertSubscriptionRemains\":\"yes\"}",
                        DeleteOutcome.Done(0, false),
                        1,
                    ),
                    Triple("{}", DeleteOutcome.Done(0, false), 1),
                )
            val mismatches = mutableListOf<String>()
            for ((body, outcome, erased) in vectors) {
                val r = rig(PostOutcome.Ok(200, body))
                r.controller.confirmDelete()
                runCurrent()
                val seen = Triple(r.controller.state.value.deleteOutcome, r.localStore.deletions, r.caught.size)
                if (seen != Triple(outcome, erased, 0)) mismatches += "<$body> gave $seen, not ($outcome, $erased, 0)"
                r.scope.cancel()
            }
            // A MALFORMED body throws out of the parse (JSONObject(body)) before the device is erased: no outcome is
            // shown, nothing is cleared, and the failure reaches the scope's handler. Pinned as found, not changed.
            for (body in listOf("not json", "", "[1,2]", "{\"removed\":")) {
                val r = rig(PostOutcome.Ok(200, body))
                r.controller.confirmDelete()
                runCurrent()
                val thrown = r.caught.map { it::class }
                val seen = Triple(r.controller.state.value.deleteOutcome, r.localStore.deletions, thrown)
                if (seen != Triple(null, 0, listOf(JSONException::class))) {
                    mismatches += "<malformed [$body]> gave $seen"
                }
                r.scope.cancel()
            }
            assertNone("parseReceipt", mismatches)
        }
}
