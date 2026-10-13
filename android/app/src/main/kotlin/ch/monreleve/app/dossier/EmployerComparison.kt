package ch.monreleve.app.dossier

import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToLong

// AN-RECON (the comparison - "Votre employeur a-t-il le meme chiffre ?"). The PURE brain: the ONE gap function
// (never UI arithmetic, R340/FW12), the attestation-rate parser, the causes read from the person's OWN record,
// and the view the screen renders. Pure Kotlin - no android, no store, no engine, no clock. It takes the server's
// dossier (R287: the releve's declarableRate is THE figure, never a phone-side calculation) and the figure the
// person typed, and returns values; a test (EmployerComparisonTest) pins each, and ComparisonR340Test proves
// computing one writes nothing.

/** The gap between the employer's attestation rate and the releve's declarable rate. */
data class ComparisonGap(
    /** |employerRate - releveRate|, two decimals. Percentage POINTS, not a percentage. */
    val points: Double,
    /**
     * The gap expressed as "about N days" on the year's basis, rounded DOWN to the half-day so the "environ"
     * never overstates the gap: environDays = floor(points / 100 * basisDays * 2) / 2.
     */
    val environDays: Double,
)

/**
 * THE ONE GAP FUNCTION (never UI arithmetic, R340). points = |employerRate - releveRate| to two decimals;
 * environDays = floor(points / 100 * basisDays * 2) / 2 (down to the half-day). Both rates are two-decimal
 * percentages; basisDays is the SERVER's prorated basis for the year (dossier.tiles.workedDays, SPEC 7.4).
 */
fun employerGap(
    employerRate: Double,
    releveRate: Double,
    basisDays: Double,
): ComparisonGap {
    val points = round2(abs(employerRate - releveRate))
    val environDays = floor(points / 100.0 * basisDays * 2.0) / 2.0
    return ComparisonGap(points = points, environDays = environDays)
}

private fun round2(value: Double): Double = (value * 100.0).roundToLong() / 100.0

/**
 * Parse an attestation rate in French format - "41,25 %", "41,25", "41.25", with optional percent sign and
 * (non-breaking) spaces - to a percentage in 0..100, or null if it is blank, non-numeric or out of range.
 */
fun parseEmployerRate(text: String): Double? {
    val cleaned = text.replace("%", "").replace(',', '.').filterNot { it.isWhitespace() }
    val value = cleaned.toDoubleOrNull() ?: return null
    return if (value in 0.0..100.0) value else null
}

/**
 * One row of "D'ou peut venir l'ecart ?" - each a FACT the app can check in the person's OWN record, never a
 * guess about the employer. The data travels here; the surface renders it from fr/ (ComparisonCopy, R181).
 */
sealed interface ComparisonCause {
    /** Missions logged, and how many were COUNTED against the annual cap (creditedDays <= missionDays). */
    data class Missions(
        val missionDays: Double,
        val creditedDays: Double,
        val cap: Int,
    ) : ComparisonCause

    /** The calculation method the record uses (the simplified forfait, or the employer's communicated days). */
    data class Method(
        val denominatorKind: String,
        val simplifiedBasisDays: Int,
    ) : ComparisonCause

    /** Working days left unrecorded that year (annex gap rows - the server's universe is the weekdays). */
    data class UnrecordedDays(val count: Int) : ComparisonCause

    /** From the verified AFC Geneve row: with several employers, each declares the rate for its own days. */
    data object SeveralEmployers : ComparisonCause
}

/**
 * The causes, in the design's order: missions (only when days are logged), the method (always), the unrecorded
 * days (only when there are any), then the several-employers note (always, general context). The cap and the
 * simplified basis are the year's RuleSet values, passed in as primitives so this module stays free of releve/.
 */
fun comparisonCauses(
    document: DossierDocument,
    missionCap: Int,
    simplifiedBasisDays: Int,
): List<ComparisonCause> {
    val causes = mutableListOf<ComparisonCause>()
    if (document.tiles.missionDays > 0.0) {
        causes +=
            ComparisonCause.Missions(
                missionDays = document.tiles.missionDays,
                creditedDays = document.creditedMissionDays,
                cap = missionCap,
            )
    }
    causes += ComparisonCause.Method(document.denominatorKind, simplifiedBasisDays)
    val unrecorded = document.annex.count { !it.recorded }
    if (unrecorded > 0) {
        causes += ComparisonCause.UnrecordedDays(unrecorded)
    }
    causes += ComparisonCause.SeveralEmployers
    return causes
}

/** Everything the comparison screen renders for a given year, assembled from the server's dossier. */
data class ComparisonView(
    val year: Int,
    val isCurrentYear: Boolean,
    /** R287: the server's figure for the year - the releve's declarable rate, never a phone-side calculation. */
    val releveRate: Double,
    /** The year's prorated basis (dossier.tiles.workedDays), the denominator the "environ N days" rests on. */
    val basisDays: Double,
    /** Days recorded on this device but not yet synced - the releve's figure does not include them (R287). */
    val daysUnsynced: Int,
    /** The gap, when a figure has been entered AND the year is completed; null otherwise. */
    val gap: ComparisonGap?,
    val causes: List<ComparisonCause>,
)

/**
 * Assemble the view. The gap is computed only for a COMPLETED year with a parsed figure - the current year has
 * no attestation yet (the screen refuses it with an explanation), so its gap is always null.
 *
 * LongParameterList suppressed: this is the assembly seam the screen calls, each argument a plain value from the
 * dossier or the display context (the year's state, the pending count, the two RuleSet figures, the typed rate) -
 * no logic to split out, and bundling them into a holder would only move the list.
 */
@Suppress("LongParameterList")
fun buildComparison(
    document: DossierDocument,
    isCurrentYear: Boolean,
    daysUnsynced: Int,
    missionCap: Int,
    simplifiedBasisDays: Int,
    employerRate: Double?,
): ComparisonView {
    val releveRate = document.zone.declarableRate
    val basisDays = document.tiles.workedDays
    val gap =
        if (!isCurrentYear && employerRate != null) {
            employerGap(employerRate, releveRate, basisDays)
        } else {
            null
        }
    return ComparisonView(
        year = document.taxYear,
        isCurrentYear = isCurrentYear,
        releveRate = releveRate,
        basisDays = basisDays,
        daysUnsynced = daysUnsynced,
        gap = gap,
        causes = comparisonCauses(document, missionCap, simplifiedBasisDays),
    )
}
