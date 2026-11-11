package ch.monreleve.app.ui.screens.prevision

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.Glyph
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.ZONE_BAND_COLOUR
import ch.monreleve.app.design.Zone
import ch.monreleve.app.design.ZoneBadge
import ch.monreleve.app.design.ZoneThresholds
import ch.monreleve.app.design.glyphPainter
import ch.monreleve.app.design.statusFor
import ch.monreleve.app.design.tabularNums
import ch.monreleve.app.design.zoneFor
import ch.monreleve.app.forecast.ForecastState
import ch.monreleve.app.forecast.Projection
import ch.monreleve.app.fr.PrevisionCopy
import ch.monreleve.app.fr.text.SignedDays
import ch.monreleve.app.fr.text.formatDeclarableRate
import ch.monreleve.app.fr.text.formatPercent
import ch.monreleve.app.fr.text.formatSignedDays
import ch.monreleve.app.ui.screens.onboarding.BottomActions
import ch.monreleve.app.ui.screens.onboarding.PrimaryButton
import ch.monreleve.app.ui.screens.onboarding.TertiaryButton
import ch.monreleve.app.ui.screens.rythme.ForecastTopBar

// AN-FORECAST (R340, R281). The year-end forecast (design/decide/Prevision.dc.html). R340 - A PROJECTION IS
// NEVER A RECORD: the whole screen is labelled "Projection", the projected part of the rail is drawn lighter
// than the recorded part (not by colour alone - a solid/soft shape difference plus the legend and the label),
// the assumptions are stated in words, and the "Une projection ne figure jamais dans votre releve" line is
// always shown. Every figure comes from the engine (Projection), never computed here (FW12): zoneFor/statusFor
// are pure display mappings, formatPercent/formatSignedDays format, and the remaining-day tiles read the
// engine result. R85: the design's "Tester un changement" primary button opens the simulator - a LIVE target
// since AN-SIM, so it is shown (it was omitted while the simulator did not exist). Stateless (fence 5), tokens only.

private const val PERCENT = 100.0
private const val FISCAL_DECIMALS = 0
private const val SOCIAL_DECIMALS = 1
private const val FIGURE_WEIGHT = 1f
private const val TILE_WEIGHT = 1f

data class PrevisionActions(
    val onModifyRhythm: () -> Unit = {},
    // AN-SIM: open the simulator ("Tester un changement"), now live (R85).
    val onTestChange: () -> Unit = {},
    // AN-ALERT: opt into the threshold alert from the contextual offer (the permission prompt is the shell's).
    val onEnableAlert: () -> Unit = {},
    val onBack: () -> Unit = {},
)

@Composable
fun PrevisionScreen(
    state: ForecastState,
    actions: PrevisionActions,
    // AN-ALERT: whether the threshold alert is already on. The offer is shown ONCE, only while it is off and a
    // projection exists; enabling it (or the Parametres switch) hides the offer.
    alertEnabled: Boolean = false,
    modifier: Modifier = Modifier,
) {
    val projection = state.projection
    Column(modifier = modifier.fillMaxSize()) {
        ForecastTopBar(onBack = actions.onBack)
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.space24),
            verticalArrangement = Arrangement.spacedBy(Spacing.space16),
        ) {
            ProjectionChip()
            if (projection == null) {
                Text(text = PrevisionCopy.INVITE_BODY, style = FrontierType.body, color = LightColors.textSecondary)
            } else {
                Text(text = PrevisionCopy.TITLE, style = FrontierType.h1)
                ForecastCard(projection)
                // AN-ALERT: the contextual opt-in offer, below the forecast, only while the alert is off.
                if (!alertEnabled) AlertOfferRow(onEnable = actions.onEnableAlert)
            }
        }
        BottomActions {
            if (projection == null) {
                PrimaryButton(label = PrevisionCopy.INVITE_CTA, onClick = actions.onModifyRhythm)
            } else {
                // AN-SIM: "Tester un changement" (primary) opens the simulator - now a live target (R85);
                // "Modifier mon rythme" stays the secondary text link.
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.space12)) {
                    PrimaryButton(label = PrevisionCopy.TEST_CHANGE, onClick = actions.onTestChange)
                    TertiaryButton(label = PrevisionCopy.MODIFY_RHYTHM, onClick = actions.onModifyRhythm)
                }
            }
        }
    }
}

// AN-ALERT: the contextual opt-in offer for the threshold alert. A bordered, tappable row (the bell icon + the
// offer copy); tapping runs onEnable, which the shell routes through the notification-permission prompt. Shown
// only while the alert is off, so it is offered once and then disappears (R340: it posts nothing - it opts in).
@Composable
private fun AlertOfferRow(onEnable: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.md))
                .border(Size.rule, LightColors.borderDefault, RoundedCornerShape(Radius.md))
                .clickable(onClick = onEnable)
                .padding(Spacing.space16),
        horizontalArrangement = Arrangement.spacedBy(Spacing.space12),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            painter = glyphPainter(Glyph.BELL),
            contentDescription = null,
            tint = LightColors.brand,
            modifier = Modifier.size(Spacing.space20),
        )
        Text(text = PrevisionCopy.ALERT_OFFER, style = FrontierType.body, color = LightColors.textPrimary)
    }
}

// R340: the projection label, visibly set apart (a brand-tinted chip), carried on the screen whose figures are
// all a projection - so no figure here can be read as a recorded one.
@Composable
private fun ProjectionChip() {
    Text(
        text = PrevisionCopy.PROJECTION_BADGE,
        style = FrontierType.caption,
        color = LightColors.brand,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radius.pill))
                .background(LightColors.brandSoft)
                .padding(horizontal = Spacing.space12, vertical = Spacing.space4),
    )
}

@Composable
private fun ForecastCard(projection: Projection) {
    val thresholds = ZoneThresholds(projection.fiscalCeiling, projection.socialCeiling)
    val projectedZone = zoneFor(projection.projectedRate, thresholds)
    val fiscalPct = formatPercent(projection.fiscalCeiling * PERCENT, FISCAL_DECIMALS)
    val socialPct = formatPercent(projection.socialCeiling * PERCENT, SOCIAL_DECIMALS)

    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.lg))
                .background(LightColors.surface)
                .border(Size.rule, LightColors.borderDefault, RoundedCornerShape(Radius.lg))
                .padding(Spacing.space16),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        FigureRow(projection, projectedZone)
        ProjectionRail(
            solidRate = projection.currentRate,
            softRate = projection.projectedRate,
            fiscalCeiling = projection.fiscalCeiling,
            socialCeiling = projection.socialCeiling,
            zone = projectedZone,
        )
        Legend(projectedZone)
        ZoneBadge(statusFor(projection.projected))
        TileRow(projection, fiscalPct, socialPct)
        IconLine(
            icon = Glyph.INFO,
            text =
                PrevisionCopy.assumptions(
                    rhythm = PrevisionCopy.domicilePhrase(projection.domicileDays),
                    workingDays = projection.imaginedWorkingDays,
                    method = PrevisionCopy.method(projection.denominatorKind, projection.totalWorkDays),
                ),
        )
        if (projection.unrecordedPastDays > 0) {
            IconLine(icon = Glyph.INFO, text = PrevisionCopy.unrecordedPast(projection.unrecordedPastDays))
        }
        IconLine(icon = Glyph.LOCK, text = PrevisionCopy.R340_NOTE)
    }
}

// The two figures: today's recorded rate (neutral) beside the December projection (its zone colour) - the
// design's own pairing. Both come from the engine; the screen only formats and colours.
@Composable
private fun FigureRow(
    projection: Projection,
    projectedZone: Zone,
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.space12)) {
        Figure(
            label = PrevisionCopy.TODAY_LABEL,
            value = formatDeclarableRate(projection.currentRate),
            colour = LightColors.textPrimary,
            modifier = Modifier.weight(FIGURE_WEIGHT),
        )
        Figure(
            label = PrevisionCopy.PROJECTION_LABEL,
            value = formatDeclarableRate(projection.projectedRate),
            colour = ZONE_BAND_COLOUR.getValue(projectedZone),
            modifier = Modifier.weight(FIGURE_WEIGHT),
        )
    }
}

// AN-SIM: internal (not private) so the simulator reuses it (R206) - the same two-figure comparison, with its
// own labels and colours.
@Composable
internal fun Figure(
    label: String,
    value: String,
    colour: Color,
    modifier: Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        Text(text = label, style = FrontierType.caption, color = LightColors.textSecondary)
        Text(text = value, style = FrontierType.h2.tabularNums(), color = colour)
    }
}

@Composable
private fun TileRow(
    projection: Projection,
    fiscalPct: String,
    socialPct: String,
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        RemainingTile(
            days = formatSignedDays(projection.projected.remainingToFiscal),
            label = PrevisionCopy.daysMarginBeforeFiscal(fiscalPct),
            overLabel = PrevisionCopy.daysOver(fiscalPct),
            modifier = Modifier.weight(TILE_WEIGHT),
        )
        RemainingTile(
            days = formatSignedDays(projection.projected.remainingToSocial),
            label = PrevisionCopy.daysBeforeSocial(socialPct),
            overLabel = PrevisionCopy.daysOver(socialPct),
            modifier = Modifier.weight(TILE_WEIGHT),
        )
    }
}

// Figure-first tile in a soft box (design): the headroom figure, then its label. A negative headroom (SPEC 7.2
// step 6) swaps to the over-label and turns red - the figure's sign is a word, never a minus glyph.
// AN-SIM: internal (not private) so the simulator reuses it (R206) - the same remaining/over-threshold tile.
@Composable
internal fun RemainingTile(
    days: SignedDays,
    label: String,
    overLabel: String,
    modifier: Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radius.md))
                .background(LightColors.canvas)
                .padding(Spacing.space12),
        verticalArrangement = Arrangement.spacedBy(Spacing.space4),
    ) {
        Text(
            text = days.text,
            style = FrontierType.h2.tabularNums(),
            color = if (days.negative) LightColors.error else LightColors.textPrimary,
        )
        Text(
            text = if (days.negative) overLabel else label,
            style = FrontierType.caption,
            color = LightColors.textSecondary,
        )
    }
}

@Composable
private fun IconLine(
    icon: Glyph,
    text: String,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space8), verticalAlignment = Alignment.Top) {
        Icon(
            painter = glyphPainter(icon),
            contentDescription = null,
            tint = LightColors.textSecondary,
            modifier = Modifier.size(Spacing.space20),
        )
        Text(
            text = text,
            style = FrontierType.caption,
            color = LightColors.textSecondary,
            textAlign = TextAlign.Start,
        )
    }
}
