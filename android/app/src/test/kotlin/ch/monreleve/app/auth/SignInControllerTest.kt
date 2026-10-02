package ch.monreleve.app.auth

import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import java.io.IOException

// AN4 increment 3. The request-screen state transitions, driven through the real
// AuthApi against a scripted transport. The one that matters is 202 -> LINK_SENT:
// the same phase whatever the address, so the client cannot enumerate. RED first:
// SignInController did not exist.

private class ScriptedTransport(
    private val response: HttpResponse = HttpResponse(202, ""),
    private val throwable: Throwable? = null,
) : HttpTransport {
    override suspend fun execute(request: HttpRequest): HttpResponse {
        throwable?.let { throw it }
        return response
    }
}

private class FakePendingStore : PendingSignInStore {
    var remembered: String? = null

    override fun remember(email: String) {
        remembered = email
    }

    override fun pending(): String? = remembered

    override fun clear() {
        remembered = null
    }
}

private fun controllerWith(
    scope: kotlinx.coroutines.CoroutineScope,
    response: HttpResponse = HttpResponse(202, ""),
    throwable: Throwable? = null,
    pending: PendingSignInStore = FakePendingStore(),
    restored: SignInSnapshot? = null,
): SignInController {
    return SignInController(
        AuthApi(ScriptedTransport(response, throwable), "http://10.0.2.2:3000"),
        pending,
        scope,
        restored,
    )
}

@OptIn(ExperimentalCoroutinesApi::class)
class SignInControllerTest : FunSpec({
    test("a blank email never submits - stays EDITING") {
        runTest {
            val controller = controllerWith(this)
            controller.submit()
            controller.state.value.phase shouldBe SignInPhase.EDITING
        }
    }

    test("a 202 moves to LINK_SENT - one phase whatever the address (no enumeration)") {
        runTest {
            val controller = controllerWith(this, HttpResponse(202, ""))
            controller.onEmailChange("a@b.ch")
            controller.submit()
            advanceUntilIdle()
            controller.state.value.phase shouldBe SignInPhase.LINK_SENT
        }
    }

    test("submit remembers the email so the callback can bind to it (login-CSRF)") {
        runTest {
            val pending = FakePendingStore()
            val controller = controllerWith(this, pending = pending)
            controller.onEmailChange("a@b.ch")
            controller.submit()
            advanceUntilIdle()
            pending.remembered shouldBe "a@b.ch"
        }
    }

    test("a 429 moves to RATE_LIMITED") {
        runTest {
            val controller = controllerWith(this, HttpResponse(429, ""))
            controller.onEmailChange("a@b.ch")
            controller.submit()
            advanceUntilIdle()
            controller.state.value.phase shouldBe SignInPhase.RATE_LIMITED
        }
    }

    test("a network failure moves to NETWORK_ERROR, distinct from a server refusal") {
        runTest {
            val controller = controllerWith(this, throwable = IOException("no route"))
            controller.onEmailChange("a@b.ch")
            controller.submit()
            advanceUntilIdle()
            controller.state.value.phase shouldBe SignInPhase.NETWORK_ERROR
        }
    }

    test("retry returns to EDITING with the typed email preserved") {
        runTest {
            val controller = controllerWith(this, HttpResponse(500, ""))
            controller.onEmailChange("a@b.ch")
            controller.submit()
            advanceUntilIdle()
            controller.state.value.phase shouldBe SignInPhase.GENERIC_ERROR
            controller.retry()
            controller.state.value.phase shouldBe SignInPhase.EDITING
            controller.state.value.email shouldBe "a@b.ch"
        }
    }

    // AN-STATE S4 (R310): the restore seed is proven on the JVM.
    test("a restored snapshot reopens the typed email and a stable phase (R310)") {
        runTest {
            val controller =
                controllerWith(this, restored = SignInSnapshot(email = "a@b.ch", phase = SignInPhase.LINK_SENT))
            controller.state.value.email shouldBe "a@b.ch"
            controller.state.value.phase shouldBe SignInPhase.LINK_SENT
        }
    }

    test("a restored in-flight SUBMITTING becomes EDITING - no spinner attached to no request (R310)") {
        runTest {
            val controller =
                controllerWith(this, restored = SignInSnapshot(email = "a@b.ch", phase = SignInPhase.SUBMITTING))
            controller.state.value.email shouldBe "a@b.ch"
            controller.state.value.phase shouldBe SignInPhase.EDITING
        }
    }
})
