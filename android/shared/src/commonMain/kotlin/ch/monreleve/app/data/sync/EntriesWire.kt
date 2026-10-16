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
fun parseEntriesResponse(body: String): EntriesResponse? =
    runCatching { wireJson.decodeFromString<EntriesResponse>(body) }.getOrNull()
