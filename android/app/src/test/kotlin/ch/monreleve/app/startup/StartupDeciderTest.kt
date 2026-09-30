package ch.monreleve.app.startup

import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.SettingsStore
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.test.runTest

// R297. The start decision consults GET /api/v1/me before choosing onboarding vs the main shell, proven over
// fakes. The parser and the decision are the two things this must get right; the wire fetch is a seam.

private class FakeSettingsStore(private var settings: Settings? = null) : SettingsStore {
    override fun load(): Settings? = settings

    override fun save(settings: Settings) {
        this.settings = settings
    }

    override fun clear() {
        settings = null
    }
}

// A full GET /api/v1/me body - the ten fields SPEC 9.1 documents; the decision reads the six manual ones.
private const val ME_WITH_SETTINGS =
    """{"canton":"GE","employmentRate":80,"denominatorKind":"SIMPLIFIED240","exactTotalWorkDays":null,
        "granularity":"DAY","activityStartDate":null,"reminderTime":"17:30","reminderEnabled":false,
        "loggingMode":"MANUAL","detectionConsentAt":null}"""

// A fresh account: no canton chosen yet (the one field with no server default).
private const val ME_NO_SETTINGS =
    """{"canton":null,"employmentRate":100,"denominatorKind":"SIMPLIFIED240","exactTotalWorkDays":null,
        "granularity":"DAY","activityStartDate":null,"reminderTime":"17:30","reminderEnabled":false,
        "loggingMode":"MANUAL","detectionConsentAt":null}"""

class StartupDeciderTest : FunSpec({
    test("R297: settings on the server -> restore them and skip onboarding (MAIN)") {
        runTest {
            val store = FakeSettingsStore()
            val dest = decideStartAfterSignIn({ MeFetch.Ok(ME_WITH_SETTINGS) }, store)

            dest shouldBe StartDestination.MAIN
            // Restored, so Aujourd'hui computes offline and the person does not re-onboard.
            store.load() shouldBe Settings("GE", 80, "SIMPLIFIED240", null, "DAY", null)
        }
    }

    test("R297: no settings on the server -> onboarding, and nothing is written locally") {
        runTest {
            val store = FakeSettingsStore()
            val dest = decideStartAfterSignIn({ MeFetch.Ok(ME_NO_SETTINGS) }, store)

            dest shouldBe StartDestination.ONBOARDING
            store.load() shouldBe null
        }
    }

    test("R297: a gone session goes to sign-in, not onboarding (no PATCH-into-401 loop)") {
        runTest {
            val store = FakeSettingsStore()

            decideStartAfterSignIn({ MeFetch.SessionGone }, store) shouldBe StartDestination.SIGN_IN
            store.load() shouldBe null
        }
    }

    test("R297: an unreachable server falls through to onboarding (a save retries when online)") {
        runTest {
            val store = FakeSettingsStore()

            decideStartAfterSignIn({ MeFetch.Unreachable }, store) shouldBe StartDestination.ONBOARDING
        }
    }
})
