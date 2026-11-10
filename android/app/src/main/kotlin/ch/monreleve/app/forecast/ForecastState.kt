package ch.monreleve.app.forecast

import ch.monreleve.app.calc.TeleworkResult
import java.time.DayOfWeek

// AN-FORECAST (R340, R281). The forecast's UI-facing state, produced by ForecastController from the engine
// (dossier.forecastResults) run on the imagined year. R340 - A PROJECTION IS NEVER A RECORD: every figure
// below is READ from the engine result, never computed in the screen (FW12's defect). A null [projection]
// is the invitation state: no rhythm set yet, or the engine cannot produce a result from the current
// settings - the Prevision screen then invites setting a rhythm rather than drawing an empty projection.
//
// THE SCREEN SPEAKS UI VOCABULARY ONLY. RhythmChoice (not data.local.RhythmKind) is what the Rythme screen
// toggles and what onSetDay carries - the same discipline AujourdhuiScreen keeps with RecordedKind, so the
// ui/ repository-only fence (no data.local) holds and the wire enum never reaches a composable. The
// controller maps RhythmChoice to RhythmKind. IOS-2d R813: both live in RhythmChoice.kt.

data class ForecastState(
    /** Monday..Friday, each SUISSE/DOMICILE or absent (not set). Empty the first time (nothing preselected). */
    val rhythmDays: Map<DayOfWeek, RhythmChoice> = emptyMap(),
    val projection: Projection? = null,
) {
    /** How many weekdays are set to Domicile - the rhythm's own count, for the helper line (not a projection). */
    val domicileCount: Int get() = rhythmDays.values.count { it == RhythmChoice.DOMICILE }
}

/**
 * Everything the Prevision screen draws - every number from the engine, through the shared aggregation
 * (R281). The screen maps these to a zone, a status and formatted strings (pure display mappings, as
 * AujourdhuiScreen does), but recomputes no rate and no headroom.
 */
data class Projection(
    /** declarableRate on the recorded days alone - "Aujourd'hui, votre releve". */
    val currentRate: Double,
    /** declarableRate on recorded + imagined - "Fin decembre, projection". */
    val projectedRate: Double,
    /** The engine result behind the projection: the rail's zone/status and the two remaining-day tiles. */
    val projected: TeleworkResult,
    val fiscalCeiling: Double,
    val socialCeiling: Double,
    /** All imagined working days to 31 December (HOME + CH weekdays) - the "N jours ouvres" of the hypotheses. */
    val imaginedWorkingDays: Int,
    /** The total work days the engine's denominator used (240 at a full simplified year) - the method line. */
    val totalWorkDays: Int,
    /** Monday=0 .. Friday=4, the weekdays set to Domicile - the "domicile le mardi et le jeudi" phrase. */
    val domicileDays: List<Int>,
    val denominatorKind: String,
    /** Past weekdays with no entry (section 2): stated in words, shown only when greater than zero. */
    val unrecordedPastDays: Int,
)
