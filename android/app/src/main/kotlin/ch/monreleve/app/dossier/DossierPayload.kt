@file:Suppress("TooManyFunctions")
// A parser is naturally many small, single-responsibility parse functions (one per payload node); folding
// them together would trade readability for a lower count. Not a ui/ file, so the annotation's string is
// outside the no-literal fence's scope.

package ch.monreleve.app.dossier

import org.json.JSONArray
import org.json.JSONObject

// AN11 increment 1. The wire JSON of GET /api/v1/dossier -> DossierDocument. Pure (org.json only, no
// android), so a JVM test parses a fixture payload directly.
//
// IT READS, IT DOES NOT COMPUTE. Every figure is taken from the payload as the server serialised it
// (docs/api-v1.md section 8.1's frozen field list). A field the server sends is read; nothing is
// derived. This is the seam FW12 teaches: a second derivation of a figure the first already produced is
// invisible until the day the two disagree, and the surface it disagrees with is the one an auditor
// reads.

/** A JSON value that must be present; a malformed payload throws rather than defaulting to a plausible 0. */
private fun JSONObject.obj(key: String): JSONObject = getJSONObject(key)

private fun JSONObject.arr(key: String): JSONArray = getJSONArray(key)

/** A nullable string field: absent or JSON null both become Kotlin null (never the literal "null"). */
private fun JSONObject.stringOrNull(key: String): String? = if (isNull(key)) null else getString(key)

/** Map each JSON object in an array. Keeps the three list parsers below to one short line each. */
private fun <T> JSONArray.mapObjects(f: (JSONObject) -> T): List<T> = (0 until length()).map { f(getJSONObject(it)) }

private fun parsePeriod(json: JSONObject): DossierPeriod =
    DossierPeriod(fraction = json.getDouble("fraction"), startDate = json.stringOrNull("startDate"))

private fun parseTiles(json: JSONObject): DossierTiles =
    DossierTiles(
        workedDays = json.getDouble("workedDays"),
        swissDays = json.getDouble("swissDays"),
        teleworkDays = json.getDouble("teleworkDays"),
        missionDays = json.getDouble("missionDays"),
    )

private fun parseWarning(json: JSONObject): DossierWarning =
    when (val code = json.getString("code")) {
        "RULE_SET_FALLBACK" -> DossierWarning.RuleSetFallback(appliedYear = json.getInt("appliedYear"))
        "EXACT_METHOD_UNVERIFIED" -> DossierWarning.ExactMethodUnverified
        else -> DossierWarning.Other(code)
    }

private fun parseWarnings(array: JSONArray): List<DossierWarning> = array.mapObjects(::parseWarning)

private fun parseZone(json: JSONObject): DossierZone =
    DossierZone(
        declarableRate = json.getDouble("declarableRate"),
        rawRate = json.getDouble("rawRate"),
        ratesDiffer = json.getBoolean("ratesDiffer"),
        fiscalCeilingDays = json.getDouble("fiscalCeilingDays"),
        remainingToFiscal = json.getDouble("remainingToFiscal"),
        remainingToSocial = json.getDouble("remainingToSocial"),
        warnings = parseWarnings(json.arr("warnings")),
    )

private fun parseMonth(json: JSONObject): DossierMonth =
    DossierMonth(
        month = json.getInt("month"),
        swissDays = json.getDouble("swissDays"),
        teleworkDays = json.getDouble("teleworkDays"),
        missionDaysFrance = json.getDouble("missionDaysFrance"),
        missionDaysThirdState = json.getDouble("missionDaysThirdState"),
        absenceDays = json.getDouble("absenceDays"),
        cumulativeDeclarableRate = json.getDouble("cumulativeDeclarableRate"),
    )

private fun parseMonths(array: JSONArray): List<DossierMonth> = array.mapObjects(::parseMonth)

private fun parseAnnexRow(json: JSONObject): AnnexRow =
    AnnexRow(
        dayDate = json.getString("dayDate"),
        recorded = json.getBoolean("recorded"),
        portion = json.stringOrNull("portion"),
        kind = json.stringOrNull("kind"),
        absenceReason = json.stringOrNull("absenceReason"),
        note = json.stringOrNull("note"),
        provenance = json.stringOrNull("provenance"),
        detectedKind = json.stringOrNull("detectedKind"),
        firstRecordedAt = json.stringOrNull("firstRecordedAt"),
        lastModifiedAt = json.stringOrNull("lastModifiedAt"),
        clientClaimedAt = json.stringOrNull("clientClaimedAt"),
        late = json.getBoolean("late"),
    )

private fun parseAnnex(array: JSONArray): List<AnnexRow> = array.mapObjects(::parseAnnexRow)

/**
 * Parse the wire body of GET /api/v1/dossier. Throws on a malformed or truncated payload (org.json's
 * own JSONException), which the caller maps to a load failure - a half-parsed document is never shown.
 */
fun parseDossier(body: String): DossierDocument {
    val json = JSONObject(body)
    return DossierDocument(
        taxYear = json.getInt("taxYear"),
        period = parsePeriod(json.obj("period")),
        titulaire = json.getString("titulaire"),
        generatedAt = json.getString("generatedAt"),
        canton = json.getString("canton"),
        employmentRate = json.getInt("employmentRate"),
        denominatorKind = json.getString("denominatorKind"),
        tiles = parseTiles(json.obj("tiles")),
        zone = parseZone(json.obj("zone")),
        months = parseMonths(json.arr("months")),
        annex = parseAnnex(json.arr("annex")),
        absenceDays = json.getDouble("absenceDays"),
        recordedEntries = json.getInt("recordedEntries"),
        // PARKAN-49, additive /v1 (docs section 8.1). Read from the wire like every other figure - a missing
        // key throws (org.json), never defaults to a plausible 0, the same contract as the rest of the parser.
        creditedMissionDays = json.getDouble("creditedMissionDays"),
        rateWithoutMissions = json.getDouble("rateWithoutMissions"),
    )
}
