package ch.monreleve.app.data.sync

import ch.monreleve.app.auth.SessionManager
import ch.monreleve.app.auth.TokenPair
import ch.monreleve.app.auth.TokenStore
import ch.monreleve.app.data.local.EntryDao
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.EntryKind
import ch.monreleve.app.data.local.Portion
import ch.monreleve.app.data.local.Provenance
import ch.monreleve.app.data.local.SyncState
import ch.monreleve.app.data.remote.AuthApi
import ch.monreleve.app.data.remote.HttpMethod
import ch.monreleve.app.data.remote.HttpRequest
import ch.monreleve.app.data.remote.HttpResponse
import ch.monreleve.app.data.remote.HttpTransport
import ch.monreleve.app.data.remote.TransportException
import ch.monreleve.app.data.remote.wireJson
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.put

// AN-PULL (R482, R487). The rig the download's tests run on: the REAL SessionManager and AuthApi over an in-memory
// HttpTransport, and an in-memory EntryDao - so the 401-refresh path the download relies on is KMP-3's own, and the
// whole suite is commonTest, which iOS inherits the day it builds (R482).
//
// WHY A SECOND IN-MEMORY DAO EXISTS (PARK-Y1). :app's FakeEntryDao lives in :app's JVM test source set, which
// commonTest cannot see - PARK-M1 recorded exactly that and left "a second FakeEntryDao in commonTest" to "the task
// that first runs commonTest on iOS". R482 places this task's tests in commonTest, so this is that second fake. It
// copies FakeEntryDao's keying (the whole primary key, accountTag + dayDate + portion) and its scoped reads, and adds
// only what these tests turn on: a write counter, a log of whose rows were read, a planted write failure, and an
// all-or-nothing transaction over the rows.
//
// WHY A SECOND FAKE TRANSPORT EXISTS. KMP-1's FakeTransport (AuthWireGoldenTest) is private to a golden file this
// task must leave unedited, and it remembers only the LAST request. R486 asserts on EVERY request ("the fake
// transport received only GETs"), so this one records them all. It implements the same seam, HttpTransport.

const val ACCOUNT_A = "acct-a-tag"
const val ACCOUNT_B = "acct-b-tag"
const val BASE_URL = "http://127.0.0.1:3000"

/** A DAO read that names no account - every one of them reads every account's rows. */
const val UNSCOPED_READ = "<unscoped>"

class InMemoryEntryDao : EntryDao {
    val rows = linkedMapOf<Triple<String, String, Portion>, EntryEntity>()

    /** Completed writes. "Nothing changed, nothing written" (AN-CALENDAR) is asserted on this, not on the rows. */
    var upserts = 0
        private set

    /** Writes issued while no transaction was open - the download must issue none (R484). */
    var writesOutsideTransaction = 0
        private set

    /** How many transactions were opened. */
    var transactions = 0
        private set

    /** The account tag of every read, or UNSCOPED_READ. R303: another account's rows are never READ. */
    val readTags = mutableListOf<String>()

    /** The planted mid-year failure (R484): the write with this 1-based number throws instead of landing. */
    var failOnWrite: Int? = null

    private var open = false

    private fun keyOf(entry: EntryEntity) = Triple(entry.accountTag, entry.dayDate, entry.portion)

    fun seed(vararg entries: EntryEntity) {
        entries.forEach { rows[keyOf(it)] = it }
    }

    /**
     * All-or-nothing, the way a Room transaction is over the table: the rows as they were are restored when the
     * block does not complete. No catch - a finally that restores, so the failure itself propagates unchanged.
     */
    suspend fun transaction(block: suspend () -> Unit) {
        transactions++
        val before = LinkedHashMap(rows)
        open = true
        var completed = false
        try {
            block()
            completed = true
        } finally {
            open = false
            if (!completed) {
                rows.clear()
                rows.putAll(before)
            }
        }
    }

    override suspend fun upsert(entry: EntryEntity) {
        val number = upserts + 1
        check(failOnWrite != number) { "planted: write $number fails part-way through the year" }
        if (!open) writesOutsideTransaction++
        upserts = number
        rows[keyOf(entry)] = entry
    }

    override suspend fun byDayPortion(
        dayDate: String,
        portion: Portion,
    ): EntryEntity? {
        readTags += UNSCOPED_READ
        return rows.values.firstOrNull { it.dayDate == dayDate && it.portion == portion }
    }

    override suspend fun byAccountDayPortion(
        accountTag: String,
        dayDate: String,
        portion: Portion,
    ): EntryEntity? {
        readTags += accountTag
        return rows[Triple(accountTag, dayDate, portion)]
    }

    override suspend fun pendingForAccount(accountTag: String): List<EntryEntity> {
        readTags += accountTag
        return rows.values.filter { it.accountTag == accountTag && it.syncState == SyncState.PENDING }
    }

    override fun observeAllForAccount(accountTag: String): Flow<List<EntryEntity>> {
        readTags += accountTag
        return flowOf(rows.values.filter { it.accountTag == accountTag })
    }

    override suspend fun all(): List<EntryEntity> {
        readTags += UNSCOPED_READ
        return rows.values.toList()
    }

    override suspend fun pending(): List<EntryEntity> {
        readTags += UNSCOPED_READ
        return rows.values.filter { it.syncState == SyncState.PENDING }
    }

    override fun observePending(): Flow<List<EntryEntity>> {
        readTags += UNSCOPED_READ
        return flowOf(rows.values.filter { it.syncState == SyncState.PENDING })
    }

    override fun observeAll(): Flow<List<EntryEntity>> {
        readTags += UNSCOPED_READ
        return flowOf(rows.values.toList())
    }
}

/** An HttpTransport that answers from a script and keeps EVERY request it was handed. */
class RecordingTransport(
    private val respond: (HttpRequest) -> HttpResponse,
) : HttpTransport {
    val requests = mutableListOf<HttpRequest>()

    override suspend fun execute(request: HttpRequest): HttpResponse {
        requests += request
        return respond(request)
    }
}

class InMemoryTokenStore(
    private var pair: TokenPair? =
        TokenPair("access-1", "refresh-1", "2026-10-22T10:00:00.000Z", "2027-01-20T10:00:00.000Z"),
) : TokenStore {
    override fun save(pair: TokenPair) {
        this.pair = pair
    }

    override fun load(): TokenPair? = pair

    override fun clear() {
        pair = null
    }
}

/** One server row exactly as 6.2 serves it: every key present, an empty value an explicit null. */
@Suppress("LongParameterList")
fun serverRow(
    id: String,
    mutation: String,
    day: String,
    portion: String = "FULL",
    kind: String = "CH",
    absenceReason: String? = null,
    note: String? = null,
    provenance: String = "MANUAL",
    detectedKind: String? = null,
    detectedAt: String? = null,
    clientClaimedAt: String? = null,
    firstRecordedAt: String = "${day}T18:44:09.311Z",
    lastModifiedAt: String? = null,
): JsonObject =
    buildJsonObject {
        put("id", id)
        put("clientMutationId", mutation)
        put("dayDate", day)
        put("portion", portion)
        put("kind", kind)
        put("absenceReason", absenceReason?.let(::JsonPrimitive) ?: JsonNull)
        put("note", note?.let(::JsonPrimitive) ?: JsonNull)
        put("provenance", provenance)
        put("detectedKind", detectedKind?.let(::JsonPrimitive) ?: JsonNull)
        put("detectedAt", detectedAt?.let(::JsonPrimitive) ?: JsonNull)
        put("clientClaimedAt", clientClaimedAt?.let(::JsonPrimitive) ?: JsonNull)
        put("firstRecordedAt", firstRecordedAt)
        put("lastModifiedAt", lastModifiedAt?.let(::JsonPrimitive) ?: JsonNull)
    }

/** The 200 body of GET /api/v1/entries?year=[year]. */
fun yearBody(
    year: Int,
    rows: List<JsonObject>,
): String =
    buildJsonObject {
        put("status", "ok")
        put("year", year)
        put("entries", JsonArray(rows))
    }.toString()

const val READ_FAILED_BODY = """{"status":"error","code":"read_failed","message":"Lecture impossible."}"""

const val EXPIRED_BODY = """{"status":"error","code":"expired_token","message":"Session expiree."}"""

const val PAIR_BODY =
    """{"status":"ok","accessToken":"access-2","refreshToken":"refresh-2",""" +
        """"accessExpiresAt":"2026-10-22T11:00:00.000Z","refreshExpiresAt":"2027-01-20T11:00:00.000Z"}"""

/**
 * The whole stack under test, built the way :app builds it: the transport under AuthApi under SessionManager, whose
 * authenticatedGet is the download's GET - the same seam DossierApi takes.
 */
class DownloadRig(
    val dao: InMemoryEntryDao = InMemoryEntryDao(),
    var account: String? = ACCOUNT_A,
    val tokens: InMemoryTokenStore = InMemoryTokenStore(),
    respond: (HttpRequest) -> HttpResponse,
) {
    val transport = RecordingTransport(respond)
    private val session = SessionManager(AuthApi(transport, BASE_URL), tokens)
    val download = EntriesDownload(dao, session::authenticatedGet, { account }, dao::transaction)

    /** Every request the transport saw, as "METHOD path" with the base url stripped. */
    fun requestLines(): List<String> = transport.requests.map { "${it.method} ${it.url.removePrefix(BASE_URL)}" }

    companion object {
        /** A server that answers each year's GET from [years] (a year it does not hold is an empty year, 6.2). */
        fun serving(years: Map<Int, List<JsonObject>>): (HttpRequest) -> HttpResponse =
            { request ->
                val year = request.url.substringAfter("?year=", "").toIntOrNull()
                if (request.method == HttpMethod.GET && year != null) {
                    HttpResponse(200, yearBody(year, years[year].orEmpty()))
                } else {
                    HttpResponse(404, """{"status":"error","code":"not_scripted"}""")
                }
            }

        /** A transport that cannot reach the server - what UrlConnectionTransport throws for a dead network. */
        val unreachable: (HttpRequest) -> HttpResponse = { throw TransportException("network unreachable (scripted)") }
    }
}

/** A local row exactly as the record path or a past sync would have left it. */
@Suppress("LongParameterList")
fun localRow(
    day: String,
    portion: Portion = Portion.FULL,
    kind: EntryKind = EntryKind.CH,
    state: SyncState,
    account: String = ACCOUNT_A,
    mutation: String = "local-$day-$portion",
    serverId: String? = if (state == SyncState.SYNCED) "srv-$day-$portion" else null,
    firstRecordedAt: String? = if (state == SyncState.SYNCED) "${day}T18:44:09.311Z" else null,
): EntryEntity =
    EntryEntity(
        clientMutationId = mutation,
        dayDate = day,
        portion = portion,
        kind = kind,
        absenceReason = null,
        note = null,
        provenance = Provenance.MANUAL,
        detectedKind = null,
        detectedAt = null,
        clientClaimedAt = "${day}T19:00:00.000+02:00",
        serverId = serverId,
        firstRecordedAt = firstRecordedAt,
        lastModifiedAt = null,
        syncState = state,
        accountTag = account,
    )

/** The SYNCED local row a past download or drain left for [row]: the server's row through the ONE mapping (R482). */
fun syncedFrom(
    row: JsonObject,
    account: String = ACCOUNT_A,
): EntryEntity = wireJson.decodeFromJsonElement<ServerEntry>(row).toSyncedEntity(account)
