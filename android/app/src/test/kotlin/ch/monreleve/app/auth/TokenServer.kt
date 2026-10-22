package ch.monreleve.app.auth

import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import kotlinx.coroutines.delay
import org.json.JSONArray
import org.json.JSONObject

// AN-TOKEN-RACE (R506). THE SERVER'S TOKEN RULES, PLAYED BY A FAKE THAT KEEPS STATE THE WAY tokens.ts DOES - so a
// client race meets the answer the real server gives it, not an answer a test author found convenient.
//
// WHAT IT MODELS, rule for rule with web/lib/auth/tokens.ts and the routes over it:
//   - a refresh token rotates ONCE. Its first presentation consumes it and mints a new pair, and the ACCESS token
//     issued beside it dies with it (tokens.ts "the access token issued alongside it dies with it" - which is why a
//     second client still holding the old access token meets `rotated_token`, and goes to refresh);
//   - a CONSUMED refresh token presented again is a replay: the WHOLE session is revoked, reason TOKEN_REPLAYED
//     (tokens.ts rotateRefreshToken, "THE REPLAY"), and the route answers the one 401 it gives every refusal,
//     `invalid_refresh_token` (refresh/route.ts) - so the client cannot tell a replay from an expiry;
//   - an access token is checked in inspectAccessToken's order: unknown, then a revoked session, then rotated
//     (consumed), then expired - with the codes bearer.ts emits for each.
//
// THE DECISION IS TAKEN WHEN THE REQUEST ARRIVES, AND THE ANSWER LEAVES [latencyMs] LATER. The server consumes a
// refresh token in ONE statement (updateMany with consumedAt null in its WHERE); this fake decides inside execute()
// before its first suspension, which is the same atomicity. The latency is what lets two clients each send ONE
// refresh token before either has received its successor - the race, exactly, and nothing a test has to stage.
//
// IT ALSO SERVES THE FEW ROUTES THE FORCED SIGN-OUT FLOW CROSSES (R509): the code exchange (a new session, as
// issueTokenPair opens one), GET /api/v1/me, the entries POST (each row written under the session's account and
// echoed back as the server's row, R217) and the year GET (6.2). Bodies are org.json, the JSON :app's tests have.

internal const val TOKEN_SERVER_BASE = "http://127.0.0.1:3000"

private const val HTTP_OK = 200
private const val HTTP_UNAUTHORIZED = 401
private const val HTTP_NOT_FOUND = 404
private const val DEFAULT_LATENCY_MS = 50L
private const val ACCESS_EXPIRES = "2026-10-22T10:15:00.000Z"
private const val REFRESH_EXPIRES = "2027-01-20T10:00:00.000Z"
private const val RECORDED_AT = "2026-10-22T10:00:00.000Z"

/** One pair, or none, exactly as TokenStore specifies - ONE store, because the Keystore prefs file is one file. */
internal class OneTokenStore(
    private var pair: TokenPair?,
) : TokenStore {
    override fun save(pair: TokenPair) {
        this.pair = pair
    }

    override fun load(): TokenPair? = pair

    override fun clear() {
        pair = null
    }
}

internal class TokenServer(
    private val latencyMs: Long = DEFAULT_LATENCY_MS,
) : HttpTransport {
    private enum class Kind { ACCESS, REFRESH }

    private class Row(
        val session: Int,
        val kind: Kind,
    ) {
        var consumed = false
        var expired = false
    }

    private class Session(
        val account: String,
    ) {
        var revokedReason: String? = null
    }

    private val tokens = mutableMapOf<String, Row>()
    private val sessions = mutableMapOf<Int, Session>()
    private val rowsByAccount = mutableMapOf<String, MutableList<JSONObject>>()
    private var minted = 0

    /** Every request, as "METHOD /path", in the order it ARRIVED. */
    val requests = mutableListOf<String>()

    /** How many refresh requests reached the server - a second one for one token is the replay. */
    var refreshRequests = 0
        private set

    /** Open a session for [account] and issue its first pair - issueTokenPair, and what the code exchange does. */
    fun openSession(account: String): TokenPair {
        val id = sessions.size + 1
        sessions[id] = Session(account)
        return mint(id)
    }

    /** The access token of [pair] has outlived its fifteen minutes. */
    fun expireAccess(pair: TokenPair) {
        tokens.getValue(pair.accessToken).expired = true
    }

    /** Why the session [pair] belongs to was ended, or null while it is alive. */
    fun revocationOf(pair: TokenPair): String? =
        sessions.getValue(tokens.getValue(pair.refreshToken).session).revokedReason

    /** The refresh token the server would honour now for [pair]'s session, or null when there is none. */
    fun liveRefreshOf(pair: TokenPair): String? {
        val session = tokens.getValue(pair.refreshToken).session
        if (sessions.getValue(session).revokedReason != null) return null
        return tokens.entries
            .firstOrNull { (_, row) -> row.session == session && row.kind == Kind.REFRESH && !row.consumed }
            ?.key
    }

    /** The clientMutationIds the server holds for [account], in the order they were written. */
    fun mutationsOf(account: String): List<String> =
        rowsByAccount[account].orEmpty().map { it.getString("clientMutationId") }

    override suspend fun execute(request: HttpRequest): HttpResponse {
        val path = request.url.removePrefix(TOKEN_SERVER_BASE)
        requests += "${request.method} ${path.substringBefore('?')}"
        // Decided NOW, answered after the latency (see the header).
        val response = decide(request, path)
        delay(latencyMs)
        return response
    }

    private fun decide(
        request: HttpRequest,
        path: String,
    ): HttpResponse =
        when (path) {
            "/api/v1/auth/refresh" -> refresh(bodyOf(request).optString("refreshToken"))
            "/api/v1/auth/code" -> pairBody(openSession(bodyOf(request).getString("email")))
            else -> authenticated(request, path)
        }

    private fun bodyOf(request: HttpRequest): JSONObject = JSONObject(request.body ?: "{}")

    private fun refresh(token: String): HttpResponse {
        refreshRequests++
        val row = tokens[token]
        val session = row?.let { sessions.getValue(it.session) }
        return when {
            row == null || session == null || row.kind != Kind.REFRESH -> refused()
            session.revokedReason != null -> refused()
            row.consumed -> {
                // THE REPLAY. Everything in this session stops working (tokens.ts).
                session.revokedReason = TOKEN_REPLAYED
                refused()
            }
            else -> {
                row.consumed = true
                tokens.values
                    .filter { it.session == row.session && it.kind == Kind.ACCESS }
                    .forEach { it.consumed = true }
                pairBody(mint(row.session))
            }
        }
    }

    private fun authenticated(
        request: HttpRequest,
        path: String,
    ): HttpResponse {
        val bearer = request.headers["Authorization"]?.removePrefix("Bearer ")
        val row = bearer?.let { tokens[it] }
        val session = row?.let { sessions.getValue(it.session) }
        return when {
            row == null || session == null || row.kind != Kind.ACCESS -> unauthorised("unknown_token")
            session.revokedReason != null -> unauthorised("revoked_session")
            row.consumed -> unauthorised("rotated_token")
            row.expired -> unauthorised("expired_token")
            else -> route(request, path, session)
        }
    }

    private fun route(
        request: HttpRequest,
        path: String,
        session: Session,
    ): HttpResponse =
        when {
            request.method == HttpMethod.POST && path == "/api/v1/auth/sign-out" -> {
                if (session.revokedReason == null) session.revokedReason = SIGNED_OUT
                HttpResponse(HTTP_OK, """{"status":"ok"}""")
            }
            request.method == HttpMethod.POST && path == "/api/v1/entries" -> write(session.account, request.body)
            request.method == HttpMethod.GET && path.startsWith("/api/v1/entries?year=") ->
                year(session.account, path.substringAfter("?year=").toInt())
            request.method == HttpMethod.GET && path == "/api/v1/me" -> HttpResponse(HTTP_OK, """{"status":"ok"}""")
            else -> HttpResponse(HTTP_NOT_FOUND, """{"status":"error","code":"not_scripted"}""")
        }

    /** R217: each row written under the SESSION's account and echoed back as the server's row. */
    private fun write(
        account: String,
        body: String?,
    ): HttpResponse {
        val sent = JSONObject(body ?: "{}").optJSONArray("entries") ?: JSONArray()
        val held = rowsByAccount.getOrPut(account) { mutableListOf() }
        val written = JSONArray()
        for (index in 0 until sent.length()) {
            val entry = sent.getJSONObject(index)
            held.removeAll { it.sameDayPortion(entry) }
            val row = serverRow(entry, "srv-${held.size + 1}-${entry.getString("dayDate")}")
            held += row
            written.put(row)
        }
        val response =
            JSONObject()
                .put("status", "ok")
                .put("written", written.length())
                .put("duplicates", 0)
                .put("entries", written)
        return HttpResponse(HTTP_OK, response.toString())
    }

    private fun JSONObject.sameDayPortion(other: JSONObject): Boolean =
        getString("dayDate") == other.getString("dayDate") && getString("portion") == other.getString("portion")

    /** 6.2: the account's rows in [year], every key present. */
    private fun year(
        account: String,
        year: Int,
    ): HttpResponse {
        val rows = JSONArray()
        rowsByAccount[account].orEmpty().filter { it.getString("dayDate").startsWith("$year-") }.forEach(rows::put)
        val body = JSONObject().put("status", "ok").put("year", year).put("entries", rows)
        return HttpResponse(HTTP_OK, body.toString())
    }

    private fun serverRow(
        entry: JSONObject,
        id: String,
    ): JSONObject =
        JSONObject()
            .put("id", id)
            .put("clientMutationId", entry.getString("clientMutationId"))
            .put("dayDate", entry.getString("dayDate"))
            .put("portion", entry.getString("portion"))
            .put("kind", entry.getString("kind"))
            .put("absenceReason", entry.opt("absenceReason") ?: JSONObject.NULL)
            .put("note", entry.opt("note") ?: JSONObject.NULL)
            .put("provenance", entry.getString("provenance"))
            .put("detectedKind", entry.opt("detectedKind") ?: JSONObject.NULL)
            .put("detectedAt", entry.opt("detectedAt") ?: JSONObject.NULL)
            .put("clientClaimedAt", entry.opt("clientClaimedAt") ?: JSONObject.NULL)
            .put("firstRecordedAt", RECORDED_AT)
            .put("lastModifiedAt", JSONObject.NULL)

    private fun mint(session: Int): TokenPair {
        minted++
        val pair = TokenPair("access-$minted", "refresh-$minted", ACCESS_EXPIRES, REFRESH_EXPIRES)
        tokens[pair.accessToken] = Row(session, Kind.ACCESS)
        tokens[pair.refreshToken] = Row(session, Kind.REFRESH)
        return pair
    }

    private fun pairBody(pair: TokenPair): HttpResponse =
        HttpResponse(
            HTTP_OK,
            JSONObject()
                .put("status", "ok")
                .put("accessToken", pair.accessToken)
                .put("refreshToken", pair.refreshToken)
                .put("accessExpiresAt", pair.accessExpiresAt)
                .put("refreshExpiresAt", pair.refreshExpiresAt)
                .toString(),
        )

    /** refresh/route.ts: ONE answer for unknown, expired, rotated, revoked - and the replay that just revoked. */
    private fun refused(): HttpResponse =
        HttpResponse(HTTP_UNAUTHORIZED, """{"status":"error","code":"invalid_refresh_token"}""")

    private fun unauthorised(code: String): HttpResponse =
        HttpResponse(HTTP_UNAUTHORIZED, """{"status":"error","code":"$code"}""")

    companion object {
        /** prisma SessionRevocation, as tokens.ts writes it. */
        const val TOKEN_REPLAYED = "TOKEN_REPLAYED"
        const val SIGNED_OUT = "SIGNED_OUT"
    }
}
