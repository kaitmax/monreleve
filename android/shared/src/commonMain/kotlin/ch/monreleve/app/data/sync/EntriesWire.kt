package ch.monreleve.app.data.sync

import ch.monreleve.app.data.remote.wireJson
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString

// AN5 increment 3 / KMP-1 increment 5. The WIRE HALF of POST /api/v1/entries, moved to :shared commonMain
// (R379): the DTOs, their encode/decode, and the server's named limits. The EntryEntity <-> DTO mapping STAYS
// in :app (EntriesMapping.kt) - it touches Room's EntryEntity and the local enums, which are the on-device
// store, not the wire.
//
// org.json -> kotlinx.serialization (wireJson, the one config). THE BYTES DO NOT CHANGE: the request body is an
// @Serializable EntryWrite encoded by wireJson, so explicitNulls=false omits a null optional (never "k":null,
// which the server's .strict() .optional() schema would 400), and the required fields carry no default so
// encodeDefaults=false can never drop one - exactly the keys org.json's put() set. Proven by the commonTest
// goldens (R381).
//
// THE BATCH LIMIT IS THE SERVER'S NAMED CONSTANT, not a guess (R0.2). BatchLimitParityTest (in :app) asserts it
// equals web/lib/entries/schema.ts's MAX_BATCH_ITEMS (R181), so a change on the server goes red there.

const val MAX_BATCH_ITEMS = 200

const val MAX_NOTE_LENGTH = 500

const val ENTRIES_PATH = "/api/v1/entries"

/**
 * One entry as the server accepts it. All String - the :app mapping passes enum.name. The optionals are nullable
 * with a null default, so wireJson OMITS a null one (explicitNulls=false); the required five carry NO default, so
 * they are always written. The server assigns id/firstRecordedAt/lastModifiedAt and rejects them as unknown keys,
 * so they are not on this DTO at all.
 */
@Serializable
data class EntryWrite(
    val clientMutationId: String,
    val dayDate: String,
    val portion: String,
    val kind: String,
    val provenance: String,
    val absenceReason: String? = null,
    val note: String? = null,
    val detectedKind: String? = null,
    val detectedAt: String? = null,
    val clientClaimedAt: String? = null,
)

@Serializable
private data class EntriesRequest(val entries: List<EntryWrite>)

/** Encode the request body {entries:[...]} the server accepts (wireJson; null optionals omitted). */
fun encodeEntries(items: List<EntryWrite>): String = wireJson.encodeToString(EntriesRequest(items))

/** One row exactly as the server returns it (R217): every field, including the server-assigned ones. */
@Serializable
data class ServerEntry(
    val id: String,
    val clientMutationId: String,
    val dayDate: String,
    val portion: String,
    val kind: String,
    val absenceReason: String? = null,
    val note: String? = null,
    val provenance: String,
    val detectedKind: String? = null,
    val detectedAt: String? = null,
    val clientClaimedAt: String? = null,
    val firstRecordedAt: String,
    val lastModifiedAt: String? = null,
)

/**
 * The 200 body. @Serializable so wireJson decodes it directly; ignoreUnknownKeys=true drops the "status":"ok"
 * envelope key the server also sends, reproducing org.json reading only the keys it named.
 */
@Serializable
data class EntriesResponse(
    val written: Int,
    val duplicates: Int,
    val entries: List<ServerEntry>,
)

/**
 * The 200 body, or null if it is not the shape the contract promises (treated as a transient fault). A missing
 * mandatory field throws MissingFieldException (coerceInputValues=false), which runCatching turns into null -
 * reproducing org.json's getInt/getString throwing on an absent key, caught to null.
 */
private fun decodeEntriesResponse(body: String) = wireJson.decodeFromString<EntriesResponse>(body)

fun parseEntriesResponse(body: String): EntriesResponse? = runCatching { decodeEntriesResponse(body) }.getOrNull()

// ---------------------------------------------------------------------------------------------------------------
// AN-PULL (R481). THE READ PATH'S WIRE HALF - GET /api/v1/entries?year=YYYY (docs/api-v1.md 6.2).
//
// ONE PARSER FOR ONE OBJECT (R206). Each row of the year is decoded into the SAME [ServerEntry] the POST answer
// carries, because 6.1 says the POST's `entries` is "exactly the shape and order 6.2 specifies - the same object,
// from the same code, so a client needs one parser rather than two". So the download maps a row exactly the way
// the drain's reconcile does (EntriesMapping.toSyncedEntity), and nothing about a row is parsed twice.
//
// THE ENVELOPE IS CHECKED, NOT ASSUMED. This was written when SessionManager.authenticatedGet handed its caller the
// BODY and not the HTTP status; AN-SIGNIN-RESOLVE (R1161) made AuthedOutcome.Ok carry the status, and
// AN-STATUS-HONESTY (R1191) made EntriesDownload refuse a non-2xx BEFORE this parser sees the body. The envelope check
// stays behind that: the route sends "status":"ok" with a 200 and nothing else; every refusal - read_failed,
// invalid_year, unknown_parameter - is {"status":"error","code":...}. So a 2xx body is the year only if it says "ok"
// AND names the year that was asked for; anything else is not a year, whatever it parses as.
// ---------------------------------------------------------------------------------------------------------------

/** The only success marker the entries routes send (6.2). */
private const val STATUS_OK = "ok"

/** The read path for one tax year: GET /api/v1/entries?year=YYYY, exactly `year`, once (6.2's strict query). */
fun entriesYearPath(year: Int): String = "$ENTRIES_PATH?year=$year"

/**
 * The 200 body of GET /api/v1/entries?year=YYYY (6.2): the year it answers and EVERY row of it. "The year is the
 * page": the server never truncates, and a year it cannot serve whole is read_failed, never a short array.
 */
@Serializable
data class EntriesYearResponse(
    val status: String,
    val year: Int,
    val entries: List<ServerEntry>,
)

/**
 * The year's 200 body, or null when the body is not a whole year: a refusal envelope (read_failed and the rest
 * carry "status":"error" and no `entries`), a body missing a mandatory field (coerceInputValues=false throws, and
 * runCatching turns it into null - the same rule as [parseEntriesResponse]), or a status other than "ok".
 */
fun parseEntriesYearResponse(body: String): EntriesYearResponse? =
    runCatching { wireJson.decodeFromString<EntriesYearResponse>(body) }
        .getOrNull()
        ?.takeIf { it.status == STATUS_OK }
