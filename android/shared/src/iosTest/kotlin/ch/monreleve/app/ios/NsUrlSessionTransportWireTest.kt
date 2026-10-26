package ch.monreleve.app.ios

import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.remote.TransportException
import ch.monreleve.app.data.remote.wireJson
import ch.monreleve.app.data.sync.EntryWrite
import ch.monreleve.app.data.sync.encodeEntries
import kotlinx.cinterop.BetaInteropApi
import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import platform.Foundation.NSURLSession
import platform.Foundation.NSURLSessionConfiguration
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

// IOS-1a R564. THE TRANSPORT, BYTE FOR BYTE, AGAINST A LOCAL SERVER THAT RECORDS THE WIRE.
//
// .github/scripts/ios-wire-server.py (started by the workflow before Gradle) listens on 127.0.0.1:WIRE_PORT and
// answers every request with a JSON echo of what ARRIVED, and keeps the list at /__recorded. Each test sends a
// request through NsUrlSessionTransport - directly, or through the REAL AuthApi that the Android app also uses -
// and reads back the server's record of it. So what is compared is the bytes that left the phone's network
// stack, not what the code believes it handed over.
//
// THE GOLDENS: the request shapes are AuthWireGoldenTest's and EntriesWireGoldenTest's (KMP-1's goldens, which
// run in commonTest on both platforms against a fake transport). Here the same expectations are applied to the
// RECORDED request: the exact key set (the server's schemas are strict: one extra key is a 400), absent optionals
// ABSENT and never null, and the body bytes equal to what encodeEntries produced.
//
// IF THE SERVER IS NOT THERE these tests FAIL, loudly and by name: absence of a server must not read as a pass
// (R133). On a Mac without the workflow, start it by hand: python3 .github/scripts/ios-wire-server.py --port 18765
// --record /tmp/wire.jsonl

internal const val WIRE_PORT = 18765
internal const val WIRE_BASE = "http://127.0.0.1:$WIRE_PORT"

/** One request as the server received it. */
private class Recorded(
    val method: String,
    val target: String,
    val headers: Map<String, String>,
    val body: ByteArray,
)

@OptIn(ExperimentalEncodingApi::class)
private fun parseRecorded(entry: JsonObject): Recorded =
    Recorded(
        method = entry["method"]!!.jsonPrimitive.content,
        target = entry["target"]!!.jsonPrimitive.content,
        headers = entry["headers"]!!.jsonObject.mapValues { it.value.jsonPrimitive.content },
        body = Base64.decode(entry["bodyBase64"]!!.jsonPrimitive.content),
    )

private suspend fun recordedSoFar(transport: HttpTransport): List<Recorded> {
    val response = transport.execute(HttpRequest(HttpMethod.GET, "$WIRE_BASE/__recorded"))
    assertEquals(200, response.status, "the wire server did not answer /__recorded: is it running on $WIRE_PORT?")
    return wireJson.parseToJsonElement(response.body).jsonArray.map { parseRecorded(it.jsonObject) }
}

private fun keysOf(body: ByteArray): Set<String> = wireJson.parseToJsonElement(body.decodeToString()).jsonObject.keys

/** Runs [send], then returns the ONE request the server recorded for it (and asserts there was exactly one). */
private suspend fun recording(
    transport: HttpTransport,
    send: suspend () -> Unit,
): Recorded {
    val before = recordedSoFar(transport).size
    runCatching { send() } // the echo is not the product's answer; only what ARRIVED matters here
    val after = recordedSoFar(transport)
    assertEquals(before + 1, after.size, "expected exactly one recorded request")
    return after.last()
}

@OptIn(ExperimentalForeignApi::class, BetaInteropApi::class)
class NsUrlSessionTransportWireTest {
    private val transport = NsUrlSessionTransport()

    // ----- THE GOLDENS ON THE WIRE (AuthWireGoldenTest's request shapes) -----

    @Test
    fun magicLinkBodyCarriesExactlyEmail() =
        runBlocking {
            val seen = recording(transport) { AuthApi(transport, WIRE_BASE).requestMagicLink("a@b.ch") }
            assertEquals("POST", seen.method)
            assertEquals("/api/v1/auth/magic-link", seen.target)
            assertEquals(setOf("email"), keysOf(seen.body))
            assertEquals(
                "a@b.ch",
                wireJson.parseToJsonElement(seen.body.decodeToString()).jsonObject["email"]!!.jsonPrimitive.content,
            )
        }

    @Test
    fun codeBodyCarriesExactlyEmailAndCode() =
        runBlocking {
            val seen = recording(transport) { AuthApi(transport, WIRE_BASE).exchangeCode("a@b.ch", "481234") }
            assertEquals("/api/v1/auth/code", seen.target)
            assertEquals(setOf("email", "code"), keysOf(seen.body))
        }

    @Test
    fun refreshBodyCarriesExactlyRefreshToken() =
        runBlocking {
            val seen = recording(transport) { AuthApi(transport, WIRE_BASE).refresh("the-refresh-token") }
            assertEquals("/api/v1/auth/refresh", seen.target)
            assertEquals(setOf("refreshToken"), keysOf(seen.body))
        }

    @Test
    fun callbackIsAGetWithTokenAndEmailUrlEncodedByteForByte() =
        runBlocking {
            val seen = recording(transport) { AuthApi(transport, WIRE_BASE).exchangeCallback("t o k", "a@b.ch") }
            assertEquals("GET", seen.method)
            assertTrue(seen.target.startsWith("/api/v1/auth/callback?"), seen.target)
            assertTrue(seen.target.contains("token=t+o+k"), seen.target)
            assertTrue(seen.target.contains("email=a%40b.ch"), seen.target)
            assertEquals(0, seen.body.size)
        }

    @Test
    fun authenticatedPostSendsBearerAndContentTypeAndTheBodyVerbatim() =
        runBlocking {
            val body = """{"entries":[]}"""
            val seen =
                recording(transport) { AuthApi(transport, WIRE_BASE).authenticatedPost("/api/v1/entries", body, "acc") }
            assertEquals("POST", seen.method)
            assertEquals("Bearer acc", seen.headers["authorization"])
            assertEquals("application/json", seen.headers["content-type"])
            assertEquals(body, seen.body.decodeToString())
        }

    @Test
    fun authenticatedPatchIsAPatchWithTheBodyVerbatim() =
        runBlocking {
            val seen =
                recording(
                    transport,
                ) { AuthApi(transport, WIRE_BASE).authenticatedPatch("/api/v1/me", """{"name":"X"}""", "acc") }
            assertEquals("PATCH", seen.method)
            assertEquals("Bearer acc", seen.headers["authorization"])
            assertEquals("""{"name":"X"}""", seen.body.decodeToString())
        }

    @Test
    fun authenticatedGetSendsBearerOnlyAndNoBody() =
        runBlocking {
            val seen = recording(transport) { AuthApi(transport, WIRE_BASE).authenticatedGet("/api/v1/me", "acc") }
            assertEquals("GET", seen.method)
            assertEquals("Bearer acc", seen.headers["authorization"])
            assertFalse(seen.headers.containsKey("content-type"), "a GET carries no Content-Type")
            assertEquals(0, seen.body.size)
        }

    // ----- THE ENTRIES WIRE (EntriesWireGoldenTest): exact keys, optionals ABSENT never null, bytes equal -----

    private fun row() =
        EntryWrite(
            clientMutationId = "mut-1",
            dayDate = "2027-06-18",
            portion = "FULL",
            kind = "HOME",
            provenance = "MANUAL",
            clientClaimedAt = "2027-06-18T12:00:00.000+02:00",
        )

    private suspend fun postEntries(body: String): Recorded =
        recording(transport) { AuthApi(transport, WIRE_BASE).authenticatedPost("/api/v1/entries", body, "acc") }

    private fun itemKeys(seen: Recorded): Set<String> =
        wireJson.parseToJsonElement(seen.body.decodeToString()).jsonObject["entries"]!!.jsonArray[0].jsonObject.keys

    @Test
    fun entriesEnvelopeCarriesExactlyEntriesAndTheBytesArriveUnchanged() =
        runBlocking {
            val sent = encodeEntries(listOf(row()))
            val seen = postEntries(sent)
            assertEquals(setOf("entries"), keysOf(seen.body))
            assertContentEquals(sent.encodeToByteArray(), seen.body)
        }

    @Test
    fun entriesRowKeySetsAndAbsentOptionals() =
        runBlocking {
            val one = postEntries(encodeEntries(listOf(row())))
            assertEquals(
                setOf("clientMutationId", "dayDate", "portion", "kind", "provenance", "clientClaimedAt"),
                itemKeys(one),
            )
            val minimal = postEntries(encodeEntries(listOf(row().copy(clientClaimedAt = null))))
            assertEquals(setOf("clientMutationId", "dayDate", "portion", "kind", "provenance"), itemKeys(minimal))
            assertFalse(minimal.body.decodeToString().contains("null"), "an absent optional must be ABSENT, never null")
        }

    @Test
    fun entriesAllOptionalsArePresentWithTheirValuesIncludingNonAscii() =
        runBlocking {
            val full =
                row().copy(
                    kind = "ABSENT",
                    absenceReason = "MALADIE",
                    note = "grippe été – \"cité\"",
                    provenance = "DETECTED_CORRECTED",
                    detectedKind = "CH",
                    detectedAt = "2027-06-18T08:00:00.000+02:00",
                )
            val sent = encodeEntries(listOf(full))
            val seen = postEntries(sent)
            assertEquals(
                setOf(
                    "clientMutationId", "dayDate", "portion", "kind", "provenance",
                    "absenceReason", "note", "detectedKind", "detectedAt", "clientClaimedAt",
                ),
                itemKeys(seen),
            )
            assertContentEquals(sent.encodeToByteArray(), seen.body, "UTF-8 bytes must arrive exactly as sent")
        }

    // ----- THE TRANSPORT'S OWN CONTRACT -----

    @Test
    fun aNonSuccessStatusIsAResponseNotAnException() =
        runBlocking {
            for (status in listOf(202, 401, 422, 500)) {
                val response = transport.execute(HttpRequest(HttpMethod.GET, "$WIRE_BASE/__status/$status"))
                assertEquals(status, response.status)
            }
        }

    @Test
    fun bytesComeBackUnalteredWithTheirHeaders() =
        runBlocking {
            val response = transport.executeForBytes(HttpRequest(HttpMethod.GET, "$WIRE_BASE/__bytes"))
            assertEquals(200, response.status)
            assertContentEquals(ByteArray(256) { it.toByte() }, response.bytes)
            val disposition =
                response.headers.entries.first {
                    it.key.equals(
                        "Content-Disposition",
                        ignoreCase = true,
                    )
                }.value
            assertEquals("attachment; filename=\"releve-2026.pdf\"", disposition)
        }

    @Test
    fun aRefusedConnectionIsATransportExceptionKeepingTheNsErrorAsItsCause() =
        runBlocking {
            val failure =
                assertFailsWith<TransportException> {
                    transport.execute(HttpRequest(HttpMethod.GET, "http://127.0.0.1:1/never-listening"))
                }
            val cause = assertIs<NsErrorException>(failure.cause, "R386: the platform error must be kept as the cause")
            assertEquals("NSURLErrorDomain", cause.domain)
            assertEquals(-1004L, cause.code, "NSURLErrorCannotConnectToHost")
        }

    @Test
    fun aTimeoutIsATransportExceptionWithNsurlerrorTimedOut() =
        runBlocking {
            val configuration = NSURLSessionConfiguration.ephemeralSessionConfiguration()
            configuration.timeoutIntervalForRequest = 1.0
            val impatient = NsUrlSessionTransport(NSURLSession.sessionWithConfiguration(configuration))
            val failure =
                assertFailsWith<TransportException> {
                    impatient.execute(
                        HttpRequest(HttpMethod.GET, "$WIRE_BASE/__hang?id=timeout"),
                    )
                }
            assertEquals(-1001L, assertIs<NsErrorException>(failure.cause).code, "NSURLErrorTimedOut")
        }

    @Test
    fun aStringThatIsNotAUrlIsATransportException() =
        runBlocking {
            assertFailsWith<TransportException> { transport.execute(HttpRequest(HttpMethod.GET, "not a url")) }
            Unit
        }

    @Test
    fun cancellingTheCoroutineClosesTheConnectionOnTheWire() =
        runBlocking {
            val id = uniqueName("cancel")

            suspend fun events(): String = transport.execute(HttpRequest(HttpMethod.GET, "$WIRE_BASE/__events")).body

            assertFalse(events().contains("closed:/__hang?id=$id"), "control: nothing has been cancelled yet")
            val job =
                launch(
                    start = CoroutineStart.UNDISPATCHED,
                ) { transport.execute(HttpRequest(HttpMethod.GET, "$WIRE_BASE/__hang?id=$id")) }
            assertTrue(eventually { events().contains("open:/__hang?id=$id") }, "the server never saw the request open")
            assertFalse(events().contains("closed:/__hang?id=$id"), "control: the request is still in flight")
            job.cancelAndJoin()
            assertTrue(
                eventually { events().contains("closed:/__hang?id=$id") },
                "cancelling the coroutine must cancel the task",
            )
        }
}
