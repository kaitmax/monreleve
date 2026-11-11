package ch.monreleve.app.forecast

import ch.monreleve.app.calc.ruleSetFor
import ch.monreleve.app.data.local.EntryEntity
import ch.monreleve.app.data.local.toAggregatable
import ch.monreleve.app.data.repo.WeeklyRhythm
import ch.monreleve.app.dossier.forecastResults
import ch.monreleve.app.settings.Settings
import ch.monreleve.app.settings.ThresholdCrossing
import ch.monreleve.app.settings.toAggregatableUser
import kotlinx.datetime.LocalDate

// AN-ALERT (R340, R281, R28). The forecast's threshold CROSSING, computed in memory from the EXISTING engine -
// never UI arithmetic (FW12). projectedThresholdCrossing runs the SAME shared aggregation + engine path the
// Prevision screen's forecast uses (dossier.forecastResults, R281) on the imagined year, and reads its
// declarable rate against the year's RuleSet ceilings (R181 - the thresholds come from the RuleSet, never
// typed). It opens no store and writes nothing (R340): it takes the recorded days, the rhythm and today, and
// returns a value.

private const val PERCENT = 100.0

/**
 * Which thresholds a projected declarable rate would cross. Boundaries are inclusive on the compliant side
 * (R32, exactly as zoneFor): a rate has to EXCEED a ceiling to cross it, so both comparisons are strict. The
 * ceilings are fractions (0.40, 0.499) and the rate is a percentage (0-100), so the ceilings are scaled here
 * once - the same unit contract zoneFor documents.
 */
fun crossingOf(
    projectedRate: Double,
    fiscalCeiling: Double,
    socialCeiling: Double,
): ThresholdCrossing =
    ThresholdCrossing(
        fiscal = projectedRate > fiscalCeiling * PERCENT,
        social = projectedRate > socialCeiling * PERCENT,
    )

/**
 * The crossing the year-end forecast would reach for [settings], the recorded [entries], the weekly [rhythm]
 * and [today], or null when there is no rhythm (nothing to project) or the engine rejects the settings. Pure:
 * [today] is the only clock (R28). Runs the engine through the shared aggregation (R281) - no arithmetic here.
 */
@Suppress("ReturnCount")
fun projectedThresholdCrossing(
    settings: Settings,
    entries: List<EntryEntity>,
    rhythm: WeeklyRhythm,
    today: LocalDate,
    taxYear: Int,
): ThresholdCrossing? {
    if (rhythm.isEmpty) return null
    val recorded =
        entries
            .filter { it.dayDate.startsWith("$taxYear-") }
            .map { it.toAggregatable() }
    val results =
        forecastResults(
            settings.toAggregatableUser(),
            recorded,
            rhythm.toEntryKindMap(),
            today,
            taxYear,
        ) ?: return null
    val rules = ruleSetFor(taxYear)
    return crossingOf(results.projected.declarableRate, rules.fiscalCeiling, rules.socialCeiling)
}
