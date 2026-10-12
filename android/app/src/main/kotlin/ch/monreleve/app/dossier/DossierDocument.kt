package ch.monreleve.app.dossier

// AN11 increment 1 (SPEC 11.4, SPEC 12, docs/api-v1.md section 8). The server's Releve annuel de
// teletravail, AS DATA - one faithful representation of GET /api/v1/dossier, nothing more.
//
// THE DEVICE NEVER RECOMPUTES A FIGURE THE SERVER PROVIDES (FW12's defect). web/lib/dossier computes
// and GET /api/v1/dossier serialises a frozen field list; this carries those figures and the Releve
// screen renders them verbatim. SPEC 12 makes the Android Releve screen and the PDF "the same document
// at two widths", which holds only while one computation stands behind both - so nothing here divides,
// rounds, or compares against a threshold. The ONE device-side arithmetic is the mobile table's merged
// missions column, and it is named where it is done (mergedMissionDays), not hidden.
//
// PURE KOTLIN - no android, no clock, no network. The parser (DossierPayload.parseDossier) turns the
// wire JSON into this; DossierApi wraps the session around it.

/** The whole document. Field names and shape follow docs/api-v1.md section 8.1 exactly. */
data class DossierDocument(
    val taxYear: Int,
    val period: DossierPeriod,
    val titulaire: String,
    val generatedAt: String,
    val canton: String,
    val employmentRate: Int,
    /** "SIMPLIFIED240" or "EXACT" - the reader's method, named in words by ReleveCopy. */
    val denominatorKind: String,
    val tiles: DossierTiles,
    val zone: DossierZone,
    val months: List<DossierMonth>,
    val annex: List<AnnexRow>,
    /** D28: counted once here, in no other figure. */
    val absenceDays: Double,
    /** How many annex rows carry an entry (not a gap). Distinguishes a compliant year from an empty one. */
    val recordedEntries: Int,
    /**
     * PARKAN-49 (docs section 8.1, additive /v1). How many mission days were COUNTED against the annual cap -
     * France and third state together, the same total the `missionDays` tile sums. The SERVER's engine figure,
     * read through (FW12): when the regime is lost this is 0 though the tile shows twelve, which is the fact
     * the "missions" cause reads from the record. Never recomputed on the device.
     */
    val creditedMissionDays: Double,
    /**
     * PARKAN-49 (docs section 8.1, additive /v1). The declarable rate WITHOUT the missions - telework alone,
     * from the engine (R281 on the server), so it never exceeds the fiscal ceiling while telework is under it.
     * `rateWithoutMissions <= declarableRate` always; equal when no mission day is credited.
     */
    val rateWithoutMissions: Double,
)

/**
 * SPEC 12 item 1. `fraction` is the property; `startDate` is only today's cause (docs section 8.2) - a
 * renderer keys on the fraction, never on the start date, which is how the web document once printed
 * "Annee entiere" over prorated figures.
 */
data class DossierPeriod(val fraction: Double, val startDate: String?)

/** SPEC 12 item 2. The four metric tiles. `workedDays` is the prorated denominator, NOT a row count. */
data class DossierTiles(
    val workedDays: Double,
    val swissDays: Double,
    val teleworkDays: Double,
    val missionDays: Double,
)

/**
 * SPEC 12 item 3. The zone panel's figures. R224: both rates travel; `declarableRate` is THE figure and
 * positions the rail, `rawRate` is explanatory and shown beside it only when `ratesDiffer`. A breach is
 * a negative `remainingTo*`, reported as a distance above, never clamped (SPEC 7.2 step 6).
 */
data class DossierZone(
    val declarableRate: Double,
    val rawRate: Double,
    val ratesDiffer: Boolean,
    val fiscalCeilingDays: Double,
    val remainingToFiscal: Double,
    val remainingToSocial: Double,
    /** docs section 8.2: a client must surface these, never only the figures. */
    val warnings: List<DossierWarning>,
)

/**
 * SPEC 12 item 4. One month's counts and its cumulative declarable rate (January through this month,
 * from the engine - not a running sum).
 */
data class DossierMonth(
    val month: Int,
    val swissDays: Double,
    val teleworkDays: Double,
    val missionDaysFrance: Double,
    val missionDaysThirdState: Double,
    val absenceDays: Double,
    val cumulativeDeclarableRate: Double,
)

/**
 * SPEC 12 item 5. One row of the evidence annex: an entry, or a working day that has none (`recorded`
 * false, only `dayDate` set). Codes ("CH", "MANUAL", "FULL", "CONGE") are the wire's; ReleveCopy maps
 * them to words at the surface (R202: the UI never speaks the wire's vocabulary, it reads fr/).
 */
data class AnnexRow(
    val dayDate: String,
    val recorded: Boolean,
    val portion: String?,
    val kind: String?,
    val absenceReason: String?,
    val note: String?,
    val provenance: String?,
    val detectedKind: String?,
    val firstRecordedAt: String?,
    val lastModifiedAt: String?,
    val clientClaimedAt: String?,
    /** SPEC 11.3: recorded more than the threshold after the day. The server's own observation (R216). */
    val late: Boolean,
)

/**
 * docs section 8.2's `zone.warnings`, as the client sees them. Only the two that add information the
 * figures do not carry are modelled distinctly: RULE_SET_FALLBACK (which year's bareme applied) and
 * EXACT_METHOD_UNVERIFIED (the reader supplied the denominator). Every other engine warning - the
 * ceiling and mission breaches - is already surfaced by the zone panel's badge and its over-notes, so
 * it is kept as [Other] for completeness and not rendered (the print page renders no warning line
 * either). An unknown future code lands in [Other] rather than being dropped silently.
 */
sealed interface DossierWarning {
    /** R11: the requested year had no RuleSet and the latest known bareme was applied. */
    data class RuleSetFallback(val appliedYear: Int) : DossierWarning

    /** The reader supplied the exact-days denominator, which the product has not verified. */
    data object ExactMethodUnverified : DossierWarning

    /** Any other engine warning code. Kept, not rendered (see the type KDoc). */
    data class Other(val code: String) : DossierWarning
}
