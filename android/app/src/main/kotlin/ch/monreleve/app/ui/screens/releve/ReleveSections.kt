package ch.monreleve.app.ui.screens.releve

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.ZONE_BAND_COLOUR
import ch.monreleve.app.design.ZoneThresholds
import ch.monreleve.app.design.rail.RailVariant
import ch.monreleve.app.design.rail.ThresholdRail
import ch.monreleve.app.design.tabularNums
import ch.monreleve.app.design.zoneFor
import ch.monreleve.app.dossier.AnnexRow
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.dossier.DossierMonth
import ch.monreleve.app.dossier.DossierWarning
import ch.monreleve.app.dossier.DossierZone
import ch.monreleve.app.fr.AujourdhuiCopy
import ch.monreleve.app.fr.RatesCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.fr.format.formatDate
import ch.monreleve.app.fr.format.formatDays
import ch.monreleve.app.fr.format.formatDossierStamp
import ch.monreleve.app.fr.format.formatMonthName
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.fr.format.formatSignedDays
import ch.monreleve.app.releve.ReleveRules
import ch.monreleve.app.releve.mergedMissionDays

// AN11 (SPEC 12). The zone panel, monthly table and evidence annex of the Releve screen. Split from
// ReleveScreen.kt to keep each file within detekt's per-file function budget (the calendar's split idiom).
// Every figure is read from the DossierDocument the server sent; nothing is recomputed (FW12), save the one
// named device-side arithmetic - the merged missions column (mergedMissionDays).

private const val PERCENT = 100.0
private const val FISCAL_DECIMALS = 0
private const val SOCIAL_DECIMALS = 1
private const val DECLARABLE_DECIMALS = 2
private const val RAW_DECIMALS = 1

private const val MONTH_WEIGHT = 1.6f
private const val NUM_WEIGHT = 1.0f
private const val CUMUL_WEIGHT = 1.4f

@Composable
internal fun ZonePanel(
    zone: DossierZone,
    rules: ReleveRules,
) {
    val thresholds = ZoneThresholds(rules.fiscalCeiling, rules.socialCeiling)
    val band = zoneFor(zone.declarableRate, thresholds)
    val bandColour = ZONE_BAND_COLOUR.getValue(band)
    val fiscalPct = formatPercent(rules.fiscalCeiling * PERCENT, FISCAL_DECIMALS)
    val socialPct = formatPercent(rules.socialCeiling * PERCENT, SOCIAL_DECIMALS)
    // The badge WORD, derived exactly as the PDF derives it (web/app/releve/print/page.tsx): fiscal first,
    // so the app and the PDF cannot disagree (SPEC 12). Coloured by the rail's own band, never by Status.
    val badge =
        when {
            zone.remainingToFiscal < 0 -> ReleveCopy.BADGE_OVER_FISCAL
            zone.remainingToSocial < 0 -> ReleveCopy.BADGE_OVER_SOCIAL
            else -> ReleveCopy.BADGE_UNDER
        }
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.xxl))
                .background(LightColors.surface)
                .padding(Spacing.space24),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = badge, style = FrontierType.bodyM, color = bandColour)
        Column {
            Text(
                text = formatPercent(zone.declarableRate, DECLARABLE_DECIMALS),
                style = FrontierType.display.tabularNums(),
                color = bandColour,
            )
            Text(text = RatesCopy.DECLARABLE_CAPTION, style = FrontierType.caption, color = LightColors.textSecondary)
        }
        ThresholdRail(
            percentage = zone.declarableRate,
            zone = band,
            variant = RailVariant.INLINE,
            thresholds = thresholds,
            modifier = Modifier.fillMaxWidth(),
        )
        if (zone.ratesDiffer) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
                Text(text = formatPercent(zone.rawRate, RAW_DECIMALS), style = FrontierType.h3.tabularNums())
                Text(text = RatesCopy.RAW_CAPTION, style = FrontierType.caption, color = LightColors.textSecondary)
                Text(text = ReleveCopy.RATES_DIFFER_NOTE, style = FrontierType.body, color = LightColors.textSecondary)
            }
        }
        Text(text = ReleveCopy.thresholds(fiscalPct, socialPct), style = FrontierType.body)
        MetricRow(ReleveCopy.REMAINING_FISCAL_LABEL, ReleveCopy.OVER_FISCAL_LABEL, zone.remainingToFiscal)
        MetricRow(ReleveCopy.REMAINING_SOCIAL_LABEL, ReleveCopy.OVER_SOCIAL_LABEL, zone.remainingToSocial)
        if (zone.remainingToFiscal < 0) {
            Text(text = ReleveCopy.OVER_FISCAL_NOTE, style = FrontierType.caption, color = LightColors.textSecondary)
        }
        WarningLines(zone.warnings)
    }
}

@Composable
private fun MetricRow(
    label: String,
    overLabel: String,
    days: Double,
) {
    val signed = formatSignedDays(days)
    Column {
        Text(
            text = if (signed.negative) overLabel else label,
            style = FrontierType.caption,
            color = LightColors.textSecondary,
        )
        Text(
            text = signed.text,
            style = FrontierType.h3.tabularNums(),
            color = if (signed.negative) LightColors.error else LightColors.textPrimary,
        )
    }
}

@Composable
private fun WarningLines(warnings: List<DossierWarning>) {
    // docs section 8.2: a client surfaces the warnings, not only the figures. Only the two that add
    // information the figures do not carry are rendered - the fallback bareme (which year applied) and the
    // unverified exact basis. The ceiling and mission breaches are already carried by the badge and the
    // over-notes above; Other codes are kept in the model but not drawn (see DossierWarning's KDoc).
    for (warning in warnings) {
        when (warning) {
            is DossierWarning.RuleSetFallback ->
                Text(
                    text = AujourdhuiCopy.fallbackNote(warning.appliedYear),
                    style = FrontierType.caption,
                    color = LightColors.textSecondary,
                )
            DossierWarning.ExactMethodUnverified ->
                Text(
                    text = ReleveCopy.WARNING_EXACT_UNVERIFIED,
                    style = FrontierType.caption,
                    color = LightColors.textSecondary,
                )
            is DossierWarning.Other -> Unit
        }
    }
}

@Composable
internal fun MonthlyTable(months: List<DossierMonth>) {
    SectionCard {
        Text(text = ReleveCopy.MONTHS_CAPTION, style = FrontierType.h3)
        MonthHeaderRow()
        for (month in months) MonthDataRow(month)
        Text(
            text = ReleveCopy.MONTHS_MISSIONS_NOTE,
            style = FrontierType.caption,
            color = LightColors.textTertiary,
            modifier = Modifier.padding(top = Spacing.space8),
        )
        Text(
            text = ReleveCopy.MONTHS_CUMULATIVE_NOTE,
            style = FrontierType.caption,
            color = LightColors.textTertiary,
            modifier = Modifier.padding(top = Spacing.space4),
        )
    }
}

@Composable
private fun MonthHeaderRow() {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.space8),
        horizontalArrangement = Arrangement.spacedBy(Spacing.space4),
    ) {
        HeaderCell(ReleveCopy.MONTH_COL, TextAlign.Start, MONTH_WEIGHT)
        HeaderCell(ReleveCopy.KIND_SWISS, TextAlign.End, NUM_WEIGHT)
        HeaderCell(ReleveCopy.MONTH_HOME_SHORT, TextAlign.End, NUM_WEIGHT)
        HeaderCell(ReleveCopy.MONTH_MISSION_SHORT, TextAlign.End, NUM_WEIGHT)
        HeaderCell(ReleveCopy.MONTH_CUMULATIVE, TextAlign.End, CUMUL_WEIGHT)
    }
}

@Composable
private fun MonthDataRow(month: DossierMonth) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.space8),
        horizontalArrangement = Arrangement.spacedBy(Spacing.space4),
    ) {
        DataCell(formatMonthName(month.month), TextAlign.Start, MONTH_WEIGHT)
        DataCell(formatDays(month.swissDays), TextAlign.End, NUM_WEIGHT)
        DataCell(formatDays(month.teleworkDays), TextAlign.End, NUM_WEIGHT)
        DataCell(formatDays(mergedMissionDays(month)), TextAlign.End, NUM_WEIGHT)
        DataCell(formatPercent(month.cumulativeDeclarableRate, DECLARABLE_DECIMALS), TextAlign.End, CUMUL_WEIGHT)
    }
}

@Composable
private fun RowScope.HeaderCell(
    text: String,
    align: TextAlign,
    weight: Float,
) {
    Text(
        text = text,
        style = FrontierType.caption,
        textAlign = align,
        color = LightColors.textSecondary,
        modifier = Modifier.weight(weight),
    )
}

@Composable
private fun RowScope.DataCell(
    text: String,
    align: TextAlign,
    weight: Float,
) {
    Text(
        text = text,
        style = FrontierType.body.tabularNums(),
        textAlign = align,
        color = LightColors.textPrimary,
        modifier = Modifier.weight(weight),
    )
}

@Composable
internal fun AnnexSection(document: DossierDocument) {
    var expanded by remember { mutableStateOf(false) }
    SectionCard {
        Row(
            modifier = Modifier.fillMaxWidth().clickable { expanded = !expanded }.padding(vertical = Spacing.space8),
            horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = ReleveCopy.ANNEX_HEADING, style = FrontierType.h3)
                Text(
                    text = ReleveCopy.ANNEX_SUBHEADING,
                    style = FrontierType.caption,
                    color = LightColors.textSecondary,
                )
            }
            Text(
                text = ReleveCopy.annexCount(document.recordedEntries),
                style = FrontierType.caption,
                color = LightColors.textSecondary,
            )
        }
        Text(
            text = if (expanded) ReleveCopy.ANNEX_TOGGLE_HIDE else ReleveCopy.ANNEX_TOGGLE_SHOW,
            style = FrontierType.caption,
            color = LightColors.franceMain,
            modifier = Modifier.clickable { expanded = !expanded }.padding(vertical = Spacing.space4),
        )
        if (expanded) {
            for (row in document.annex) AnnexRowView(row)
            Text(
                text = ReleveCopy.ANNEX_LATE_NOTE,
                style = FrontierType.caption,
                color = LightColors.textTertiary,
                modifier = Modifier.padding(top = Spacing.space8),
            )
            Text(
                text = ReleveCopy.ANNEX_OFFLINE_NOTE,
                style = FrontierType.caption,
                color = LightColors.textTertiary,
                modifier = Modifier.padding(top = Spacing.space4),
            )
        }
    }
}

@Composable
private fun AnnexRowView(row: AnnexRow) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.space8),
        verticalArrangement = Arrangement.spacedBy(Spacing.space4),
    ) {
        if (row.recorded) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(text = formatDate(row.dayDate), style = FrontierType.bodyM.tabularNums())
                Text(
                    text = ReleveCopy.annexKind(row.kind, row.absenceReason),
                    style = FrontierType.body,
                    modifier = Modifier.weight(1f),
                )
                if (row.late) {
                    Text(text = ReleveCopy.ANNEX_LATE, style = FrontierType.caption, color = LightColors.warning)
                }
            }
            Text(
                text =
                    ReleveCopy.annexEntryMeta(
                        portion = row.portion,
                        provenance = row.provenance,
                        firstRecorded = row.firstRecordedAt?.let { formatDossierStamp(it) },
                        modified = row.lastModifiedAt?.let { formatDossierStamp(it) },
                        clientClaimed = row.clientClaimedAt?.let { formatDossierStamp(it) },
                    ),
                style = FrontierType.caption,
                color = LightColors.textSecondary,
            )
            row.note?.let { Text(text = it, style = FrontierType.caption, color = LightColors.textTertiary) }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space8)) {
                Text(
                    text = formatDate(row.dayDate),
                    style = FrontierType.bodyM.tabularNums(),
                    color = LightColors.textTertiary,
                )
                Text(text = ReleveCopy.NON_RECORDED, style = FrontierType.body, color = LightColors.textTertiary)
            }
        }
    }
}
