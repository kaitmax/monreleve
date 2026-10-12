package ch.monreleve.app.ui.screens.prevision

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import ch.monreleve.app.R
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.ZONE_BAND_COLOUR
import ch.monreleve.app.design.Zone
import ch.monreleve.app.design.ZoneBadge
import ch.monreleve.app.design.ZoneThresholds
import ch.monreleve.app.design.statusFor
import ch.monreleve.app.design.tabularNums
import ch.monreleve.app.design.zoneFor
import ch.monreleve.app.forecast.ForecastState
import ch.monreleve.app.forecast.Projection
import ch.monreleve.app.fr.PrevisionCopy
import ch.monreleve.app.fr.format.SignedDays
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.fr.format.formatSignedDays
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
// engine result. R85: the design's "Tester un changement" simulator link is a dead target until AN-SIM, so it
// is OMITTED here. Stateless (fence 5), tokens only.

private const val PERCENT = 100.0
private const val FISCAL_DECIMALS = 0
private const val SOCIAL_DECIMALS = 1
private const val RATE_DECIMALS = 2
private const val FIGURE_WEIGHT = 1f
private const val TILE_WEIGHT = 1f

data class PrevisionActions(
    val onModifyRhythm: () -> Unit = {},
    val onBack: () -> Unit = {},
)

@Composable
fun PrevisionScreen(
    state: ForecastState,
    actions: PrevisionActions,
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
            }
        }
        BottomActions {
            if (projection == null) {
                PrimaryButton(label = PrevisionCopy.INVITE_CTA, onClick = actions.onModifyRhythm)
            } else {
                TertiaryButton(label = PrevisionCopy.MODIFY_RHYTHM, onClick = actions.onModifyRhythm)
            }
        }
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
        ProjectionRail(projection, projectedZone)
        Legend(projectedZone)
        ZoneBadge(statusFor(projection.projected))
        TileRow(projection, fiscalPct, socialPct)
        IconLine(
            icon = R.drawable.ic_info,
            text =
                PrevisionCopy.assumptions(
                    rhythm = PrevisionCopy.domicilePhrase(projection.domicileDays),
                    workingDays = projection.imaginedWorkingDays,
                    method = PrevisionCopy.method(projection.denominatorKind, projection.totalWorkDays),
                ),
        )
        if (projection.unrecordedPastDays > 0) {
            IconLine(icon = R.drawable.ic_info, text = PrevisionCopy.unrecordedPast(projection.unrecordedPastDays))
        }
        IconLine(icon = R.drawable.ic_lock, text = PrevisionCopy.R340_NOTE)
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
            value = formatPercent(projection.currentRate, RATE_DECIMALS),
            colour = LightColors.textPrimary,
            modifier = Modifier.weight(FIGURE_WEIGHT),
        )
        Figure(
            label = PrevisionCopy.PROJECTION_LABEL,
            value = formatPercent(projection.projectedRate, RATE_DECIMALS),
            colour = ZONE_BAND_COLOUR.getValue(projectedZone),
            modifier = Modifier.weight(FIGURE_WEIGHT),
        )
    }
}

@Composable
private fun Figure(
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
@Composable
private fun RemainingTile(
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
    icon: Int,
    text: String,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space8), verticalAlignment = Alignment.Top) {
        Icon(
            painter = painterResource(icon),
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
