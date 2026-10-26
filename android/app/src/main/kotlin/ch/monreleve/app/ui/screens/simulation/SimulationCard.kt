package ch.monreleve.app.ui.screens.simulation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import ch.monreleve.app.design.zoneFor
import ch.monreleve.app.forecast.SimulationView
import ch.monreleve.app.fr.PrevisionCopy
import ch.monreleve.app.fr.SimulationCopy
import ch.monreleve.app.fr.text.formatDeclarableRate
import ch.monreleve.app.fr.text.formatPercent
import ch.monreleve.app.fr.text.formatSignedDays
import ch.monreleve.app.ui.screens.prevision.Figure
import ch.monreleve.app.ui.screens.prevision.ProjectionRail
import ch.monreleve.app.ui.screens.prevision.RemainingTile

// AN-SIM (R340, R281). The simulator's result card (design/decide/Simulation.dc.html). Every figure comes from
// the engine (SimulationView), never computed here (FW12): zoneFor/statusFor are pure display mappings,
// formatPercent/formatSignedDays format, and the tiles read the engine result. R340 - the whole card is a
// projection: the screen is titled "Simulation", the left figure is labelled "Votre projection", and no figure
// here is a recorded one. The rail, the tiles and the zone badge are REUSED from the forecast screen (R206), so
// the two forecast surfaces draw a threshold identically; the tile labels have one home in PrevisionCopy.
//
// The rail's SOLID part is today's recorded rate (where you stand now) and its SOFT part the simulated rate (as
// the design draws it) - the reused ProjectionRail, passed the simulated zone. The status is the full engine-
// derived ZoneBadge, as the Prevision screen also chose over the design's compact chip (AN-FORECAST), so it is
// correct for every status, not only the one the mock-up draws.

private const val PERCENT = 100.0
private const val FISCAL_DECIMALS = 0
private const val SOCIAL_DECIMALS = 1
private const val FIGURE_WEIGHT = 1f
private const val TILE_WEIGHT = 1f

@Composable
internal fun SimulationCard(view: SimulationView) {
    val thresholds = ZoneThresholds(view.fiscalCeiling, view.socialCeiling)
    val simulatedZone = zoneFor(view.simulatedRate, thresholds)
    val fiscalPct = formatPercent(view.fiscalCeiling * PERCENT, FISCAL_DECIMALS)
    val socialPct = formatPercent(view.socialCeiling * PERCENT, SOCIAL_DECIMALS)

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
        FigureRow(view, simulatedZone)
        ProjectionRail(
            solidRate = view.recordedRate,
            softRate = view.simulatedRate,
            fiscalCeiling = view.fiscalCeiling,
            socialCeiling = view.socialCeiling,
            zone = simulatedZone,
        )
        ZoneBadge(statusFor(view.simulated))
        TileRow(view, fiscalPct, socialPct)
        ConsequenceBlock(fiscalPct)
    }
}

// The two figures: the current projection (neutral) beside the projection WITH the change (its zone colour) -
// the design's own pairing. Both come from the engine; the card only formats and colours.
@Composable
private fun FigureRow(
    view: SimulationView,
    simulatedZone: Zone,
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.space12)) {
        Figure(
            label = SimulationCopy.CURRENT_FIGURE,
            value = formatDeclarableRate(view.currentRate),
            colour = LightColors.textPrimary,
            modifier = Modifier.weight(FIGURE_WEIGHT),
        )
        Figure(
            label = SimulationCopy.CHANGE_FIGURE,
            value = formatDeclarableRate(view.simulatedRate),
            colour = ZONE_BAND_COLOUR.getValue(simulatedZone),
            modifier = Modifier.weight(FIGURE_WEIGHT),
        )
    }
}

@Composable
private fun TileRow(
    view: SimulationView,
    fiscalPct: String,
    socialPct: String,
) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        RemainingTile(
            days = formatSignedDays(view.simulated.remainingToFiscal),
            label = PrevisionCopy.daysMarginBeforeFiscal(fiscalPct),
            overLabel = PrevisionCopy.daysOver(fiscalPct),
            modifier = Modifier.weight(TILE_WEIGHT),
        )
        RemainingTile(
            days = formatSignedDays(view.simulated.remainingToSocial),
            label = PrevisionCopy.daysBeforeSocial(socialPct),
            overLabel = PrevisionCopy.daysOver(socialPct),
            modifier = Modifier.weight(TILE_WEIGHT),
        )
    }
}

// The consequence (R146): only the verified fiscal row is stated, with its source. The social threshold has no
// sentence-level consequence row in docs/regulatory-sources.md, so none is written (R160 - never more than the
// record supports). The app shows the consequence and never advises.
@Composable
private fun ConsequenceBlock(fiscalPct: String) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        Text(
            text = SimulationCopy.consequenceFiscal(fiscalPct),
            style = FrontierType.body,
            color = LightColors.textPrimary,
        )
        Text(text = SimulationCopy.CONSEQUENCE_SOURCE, style = FrontierType.caption, color = LightColors.textSecondary)
    }
}
