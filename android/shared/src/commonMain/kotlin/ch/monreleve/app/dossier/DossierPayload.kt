@file:Suppress("TooManyFunctions")
// A parser is naturally many small, single-responsibility parse functions (one per payload node); folding
// them together would trade readability for a lower count. Not a ui/ file, so the annotation's string is
// outside the no-literal fence's scope.

package ch.monreleve.app.dossier

import ch.monreleve.app.data.remote.wireJson
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// AN11 increment 1 / KMP-1 increment 6. The wire JSON of GET /api/v1/dossier -> DossierDocument, moved to :shared
// commonMain (R379). org.json -> kotlinx.serialization's JSON TREE API (not @Serializable): the warning list is a
// discriminated union on "code" (RULE_SET_FALLBACK carries appliedYear; others do not), which a tree read with a
// `when` expresses exactly as org.json did, where kotlinx polymorphism would impose a different wire shape. The
// helpers below map getXxx 1:1, so THE ACCEPT/REFUSE DECISION DOES NOT CHANGE: a required key that is missing or
// the wrong type throws (getValue / .jsonPrimitive.int etc.), which the caller (DossierApi) turns into Unreadable -
// never a plausible 0; a nullable key is null when absent OR an explicit JSON null (the old isNull check).
//
// IT READS, IT DOES NOT COMPUTE. Every figure is taken from the payload as the server serialised it
// (docs/api-v1.md section 8.1's frozen field list). A field the server sends is read; nothing is
// derived. This is the seam FW12 teaches: a second derivation of a figure the first already produced is
// invisible until the day the two disagree, and the surface it disagrees with is the one an auditor
// reads.

/** A required object child; a missing key throws (getValue), reproducing org.json getJSONObject on an absent key. */
private fun JsonObject.obj(key: String): JsonObject = getValue(key).jsonObject

private fun JsonObject.arr(key: String): JsonArray = getValue(key).jsonArray

/** A required int/double/boolean/string; absent or wrong-type throws, as org.json getInt/.../getString did. */
private fun JsonObject.int(key: String): Int = getValue(key).jsonPrimitive.int

private fun JsonObject.double(key: String): Double = getValue(key).jsonPrimitive.double

private fun JsonObject.bool(key: String): Boolean = getValue(key).jsonPrimitive.boolean

private fun JsonObject.str(key: String): String = getValue(key).jsonPrimitive.content

/**
 * A nullable string field: absent or JSON null both become Kotlin null (never the literal "null").
 *
 * A BLOCK BODY, not an expression one, and deliberately. ktlint pulls a body expression onto the
 * signature line whenever it fits ktlint's own limit, and the result here is 121 characters - one
 * over the 120 detekt enforces, which :app has always respected. The two tools deadlock on the
 * expression form; a block body is outside that rule and every line stays short.
 */
private fun JsonObject.stringOrNull(key: String): String? {
    val value = this[key] ?: return null

    return if (value is JsonNull) null else value.jsonPrimitive.content
}

/** Map each JSON object in an array. Keeps the three list parsers below to one short line each. */
private fun <T> JsonArray.mapObjects(f: (JsonObject) -> T): List<T> = map { f(it.jsonObject) }

private fun parsePeriod(json: JsonObject): DossierPeriod =
    DossierPeriod(fraction = json.double("fraction"), startDate = json.stringOrNull("startDate"))

private fun parseTiles(json: JsonObject): DossierTiles =
    DossierTiles(
        workedDays = json.double("workedDays"),
        swissDays = json.double("swissDays"),
        teleworkDays = json.double("teleworkDays"),
        missionDays = json.double("missionDays"),
    )

private fun parseWarning(json: JsonObject): DossierWarning =
    when (val code = json.str("code")) {
        "RULE_SET_FALLBACK" -> DossierWarning.RuleSetFallback(appliedYear = json.int("appliedYear"))
        "EXACT_METHOD_UNVERIFIED" -> DossierWarning.ExactMethodUnverified
        else -> DossierWarning.Other(code)
    }

private fun parseWarnings(array: JsonArray): List<DossierWarning> = array.mapObjects(::parseWarning)

private fun parseZone(json: JsonObject): DossierZone =
    DossierZone(
        declarableRate = json.double("declarableRate"),
        rawRate = json.double("rawRate"),
        ratesDiffer = json.bool("ratesDiffer"),
        fiscalCeilingDays = json.double("fiscalCeilingDays"),
        remainingToFiscal = json.double("remainingToFiscal"),
        remainingToSocial = json.double("remainingToSocial"),
        warnings = parseWarnings(json.arr("warnings")),
    )

private fun parseMonth(json: JsonObject): DossierMonth =
    DossierMonth(
        month = json.int("month"),
        swissDays = json.double("swissDays"),
        teleworkDays = json.double("teleworkDays"),
        missionDaysFrance = json.double("missionDaysFrance"),
        missionDaysThirdState = json.double("missionDaysThirdState"),
        absenceDays = json.double("absenceDays"),
        cumulativeDeclarableRate = json.double("cumulativeDeclarableRate"),
    )

private fun parseMonths(array: JsonArray): List<DossierMonth> = array.mapObjects(::parseMonth)

private fun parseAnnexRow(json: JsonObject): AnnexRow =
    AnnexRow(
        dayDate = json.str("dayDate"),
        recorded = json.bool("recorded"),
        portion = json.stringOrNull("portion"),
        kind = json.stringOrNull("kind"),
        absenceReason = json.stringOrNull("absenceReason"),
        note = json.stringOrNull("note"),
        provenance = json.stringOrNull("provenance"),
        detectedKind = json.stringOrNull("detectedKind"),
        firstRecordedAt = json.stringOrNull("firstRecordedAt"),
        lastModifiedAt = json.stringOrNull("lastModifiedAt"),
        clientClaimedAt = json.stringOrNull("clientClaimedAt"),
        late = json.bool("late"),
    )

private fun parseAnnex(array: JsonArray): List<AnnexRow> = array.mapObjects(::parseAnnexRow)

/**
 * Parse the wire body of GET /api/v1/dossier. Throws on a malformed or truncated payload (a parse error, a
 * missing required key, or a wrong-typed value), which the caller maps to a load failure - a half-parsed
 * document is never shown.
 */
fun parseDossier(body: String): DossierDocument {
    val json = wireJson.parseToJsonElement(body).jsonObject
    return DossierDocument(
        taxYear = json.int("taxYear"),
        period = parsePeriod(json.obj("period")),
        titulaire = json.str("titulaire"),
        generatedAt = json.str("generatedAt"),
        canton = json.str("canton"),
        employmentRate = json.int("employmentRate"),
        denominatorKind = json.str("denominatorKind"),
        tiles = parseTiles(json.obj("tiles")),
        zone = parseZone(json.obj("zone")),
        months = parseMonths(json.arr("months")),
        annex = parseAnnex(json.arr("annex")),
        absenceDays = json.double("absenceDays"),
        recordedEntries = json.int("recordedEntries"),
        // PARKAN-49, additive /v1 (docs section 8.1). Read from the wire like every other figure - a missing
        // key throws, never defaults to a plausible 0, the same contract as the rest of the parser.
        creditedMissionDays = json.double("creditedMissionDays"),
        rateWithoutMissions = json.double("rateWithoutMissions"),
    )
}
