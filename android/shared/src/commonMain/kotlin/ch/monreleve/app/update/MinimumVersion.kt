package ch.monreleve.app.update

import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.remote.TransportException
import ch.monreleve.app.data.remote.wireJson
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

// AN-FORCE-UPDATE (R1111). MAY THIS APP STILL RUN: the client of GET /api/v1/android/minimum-version
// (docs/api-v1.md 15), the pure decision, and the gate that holds it. In :shared commonMain so the iOS app, when it
// has a host, asks the same way (R1114); the screen and the store link are each platform's.
//
// THE EXPENSIVE ERROR IS A FALSE "REQUIRED". The update screen replaces the whole app and its one button leads to a
// store listing that may hold nothing newer. So the parse is strict about what a minimum is - a JSON integer from 1
// to Play's ceiling, from a server that names this product (R169) - and every other answer is UNUSABLE, which FAILS
// OPEN: the app carries on exactly as it does today. The route's own readings of its setting are joined to this
// parser by fixtures/android-minimum-version-cases.json (R204).
//
// IT NEVER BLOCKS. Nothing here is awaited before the first screen: the gate starts OPEN and closes only when a
// usable answer says so (MainActivity asks on every start of the activity, beside the first paint).

/** The route (docs/api-v1.md 15). Unauthenticated: no token is ever sent to it. */
const val MINIMUM_VERSION_PATH = "/api/v1/android/minimum-version"

/**
 * The product's name as the server states it (web/lib/content/identity.ts SERVICE_NAME, the /api/health `service`).
 * A second spelling of one name, held to the first by the fixture both sides read: MinimumVersionFixtureTest fails if
 * the route's `service` and this ever differ.
 */
const val SERVICE_NAME = "monreleve"

/** The largest versionCode Google Play accepts (android/app/build.gradle.kts, AN14a increment 5). */
const val PLAY_VERSION_CODE_CEILING = 2_100_000_000L

private const val HTTP_OK = 200
private val DECIMAL_VERSION_CODE = Regex("^[1-9][0-9]*$")

/** What the route said, read strictly. Only [Minimum] can ever require an update. */
sealed interface MinimumVersionAnswer {
    /** This product says the lowest supported versionCode is [versionCode]. */
    data class Minimum(val versionCode: Int) : MinimumVersionAnswer

    /** This product says, explicitly (`null`), that there is no minimum. */
    data object NoMinimum : MinimumVersionAnswer

    /** Nothing can be believed: the app carries on as it is (fail open). */
    data class Unusable(val reason: UnusableReason) : MinimumVersionAnswer

    /** Why an answer could not be used. Named, so a log or a test says which. */
    enum class UnusableReason { UNREACHABLE, STATUS, NOT_JSON, FOREIGN, MALFORMED }
}

/** Reads one response of the route. Strict about a minimum; everything else is [MinimumVersionAnswer.Unusable]. */
fun parseMinimumVersion(
    status: Int,
    body: String,
): MinimumVersionAnswer {
    val tree = if (status == HTTP_OK) jsonOrNull(body) else null
    val obj = tree as? JsonObject
    val service = (obj?.get("service") as? JsonPrimitive)?.takeIf { it.isString }?.content
    return when {
        status != HTTP_OK -> unusable(MinimumVersionAnswer.UnusableReason.STATUS)
        tree == null -> unusable(MinimumVersionAnswer.UnusableReason.NOT_JSON)
        obj == null -> unusable(MinimumVersionAnswer.UnusableReason.MALFORMED)
        service != SERVICE_NAME -> unusable(MinimumVersionAnswer.UnusableReason.FOREIGN)
        else -> readMinimum(obj)
    }
}

/**
 * The body as JSON, or null when it is not JSON. SwallowedException is suppressed deliberately, as openLegalLink's is:
 * the exception IS the answer ("not JSON"), it carries nothing worth keeping, and only kotlinx's own parse failure is
 * caught - a bug anywhere else still propagates.
 */
@Suppress("SwallowedException")
private fun jsonOrNull(body: String): JsonElement? =
    try {
        wireJson.parseToJsonElement(body)
    } catch (e: SerializationException) {
        null
    }

private fun unusable(reason: MinimumVersionAnswer.UnusableReason) = MinimumVersionAnswer.Unusable(reason)

/** The `minimumVersionCode` field: present, and either `null` or a decimal JSON integer in 1..ceiling. */
private fun readMinimum(obj: JsonObject): MinimumVersionAnswer {
    val field = obj["minimumVersionCode"]
    // A quoted "5" is a string, and 5.0 / 1e3 / -1 / 0 fail the digits rule: none of them is a versionCode.
    val digits = (field as? JsonPrimitive)?.takeIf { !it.isString && field !is JsonNull }?.content
    val code = digits?.takeIf { DECIMAL_VERSION_CODE.matches(it) }?.toLongOrNull()
    return when {
        // Absent is NOT null: the route always states null explicitly, so a missing field is a different answer.
        field == null -> unusable(MinimumVersionAnswer.UnusableReason.MALFORMED)
        field is JsonNull -> MinimumVersionAnswer.NoMinimum
        code == null || code > PLAY_VERSION_CODE_CEILING -> unusable(MinimumVersionAnswer.UnusableReason.MALFORMED)
        else -> MinimumVersionAnswer.Minimum(code.toInt())
    }
}

/**
 * THE DECISION (R1111): is the update screen shown after [answer], given whether it is [showingNow]?
 *
 * Required ONLY when this product said, with a valid integer, that [appVersionCode] is strictly below its minimum.
 * An explicit "no minimum", or a minimum the app meets, releases the screen. An [MinimumVersionAnswer.Unusable]
 * answer changes nothing: from the app's normal state it FAILS OPEN (no screen), and once a usable answer has put the
 * screen up, an answer that says nothing does not take it down (a flapping network must not flicker the app in and
 * out; recorded as a question for the orchestrator).
 */
fun updateRequired(
    appVersionCode: Int,
    answer: MinimumVersionAnswer,
    showingNow: Boolean,
): Boolean =
    when (answer) {
        is MinimumVersionAnswer.Minimum -> appVersionCode < answer.versionCode
        MinimumVersionAnswer.NoMinimum -> false
        is MinimumVersionAnswer.Unusable -> showingNow
    }

/**
 * Asks the route over [transport]: a plain GET, no credentials, never through the session - so a 401 from anything
 * on that port is just a status. SwallowedException is suppressed for the same reason as [jsonOrNull]: a
 * TransportException IS the answer "unreachable" (the only failure caught; a bug still propagates, R387).
 */
@Suppress("SwallowedException")
class MinimumVersionClient(
    private val transport: HttpTransport,
    private val baseUrl: String,
) {
    suspend fun fetch(): MinimumVersionAnswer {
        val response =
            try {
                transport.execute(HttpRequest(method = HttpMethod.GET, url = baseUrl + MINIMUM_VERSION_PATH))
            } catch (e: TransportException) {
                return MinimumVersionAnswer.Unusable(MinimumVersionAnswer.UnusableReason.UNREACHABLE)
            }
        return parseMinimumVersion(response.status, response.body)
    }
}

/**
 * The gate a platform holds for its process: [required] starts FALSE - the app shows itself at once, never waiting on
 * the network - and each [check] applies one answer through [updateRequired].
 */
class UpdateGate(
    private val appVersionCode: Int,
    private val fetch: suspend () -> MinimumVersionAnswer,
) {
    private val state = MutableStateFlow(false)

    val required: StateFlow<Boolean> = state.asStateFlow()

    suspend fun check() {
        val answer = fetch()
        state.value = updateRequired(appVersionCode, answer, showingNow = state.value)
    }
}
