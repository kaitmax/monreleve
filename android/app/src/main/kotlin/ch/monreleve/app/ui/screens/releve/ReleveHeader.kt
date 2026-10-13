package ch.monreleve.app.ui.screens.releve

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.design.tabularNums
import ch.monreleve.app.dossier.DossierDocument
import ch.monreleve.app.dossier.DossierTiles
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.fr.format.formatDate
import ch.monreleve.app.fr.format.formatDays
import ch.monreleve.app.fr.format.formatDossierStamp
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.releve.ReleveRules

// AN11 (SPEC 12 items 1-2, FD7). The head of the Releve document: the provisional banner, the identification
// card and the four metric tiles. Split from ReleveScreen.kt for detekt's per-file function budget. Every
// value is read from the DossierDocument; nothing is recomputed (FW12). The two ceilings and the simplified
// basis arrive via ReleveRules (the controller read them from the year's RuleSet, R181).

private const val EMPLOYMENT_DECIMALS = 0
private const val RATE_WITHOUT_MISSIONS_DECIMALS = 2

/**
 * PARKAN-49 (items 3 and 5 of the accountant's list): the rate WITHOUT the missions and the count of mission
 * days COUNTED against the cap, rendered beside the declarable rate as the PDF renders them (SPEC 12, the same
 * document at two widths). Both are the SERVER's engine figures carried on the DossierDocument; nothing here
 * recomputes them (FW12). Lives here rather than in ReleveSections for detekt's per-file budget (the split idiom).
 */
@Composable
internal fun MissionFigures(
    rateWithoutMissions: Double,
    creditedMissionDays: Double,
) {
    FigureRow(
        value = formatPercent(rateWithoutMissions, RATE_WITHOUT_MISSIONS_DECIMALS),
        caption = ReleveCopy.RATE_WITHOUT_MISSIONS,
        note = ReleveCopy.RATE_WITHOUT_MISSIONS_NOTE,
    )
    FigureRow(
        value = formatDays(creditedMissionDays),
        caption = ReleveCopy.CREDITED_MISSIONS,
        note = ReleveCopy.CREDITED_MISSIONS_NOTE,
    )
}

// One secondary figure: the big value, its caption, and the note that explains it - the rawRate block's shape.
@Composable
private fun FigureRow(
    value: String,
    caption: String,
    note: String,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        Text(text = value, style = FrontierType.h3.tabularNums())
        Text(text = caption, style = FrontierType.caption, color = LightColors.textSecondary)
        Text(text = note, style = FrontierType.body, color = LightColors.textSecondary)
    }
}

@Composable
internal fun OfflineBanner(generatedAt: String) {
    // R288: an offline releve is a DATED copy, never presented as current. The date is the cached payload's
    // own generatedAt (server-assigned, R181), read in UTC exactly as the annex stamps are.
    val generatedDay = formatDossierStamp(generatedAt).substringBefore(' ')
    SectionCard {
        Text(text = ReleveCopy.OFFLINE_TITLE, style = FrontierType.bodyM, color = LightColors.warning)
        Text(
            text = ReleveCopy.offlineCaveat(generatedDay),
            style = FrontierType.caption,
            color = LightColors.textSecondary,
        )
    }
}

@Composable
internal fun ProvisionalBanner(
    generatedAt: String,
    taxYear: Int,
) {
    // SPEC 11.4: the releve is provisional until the year closes, and it says so. Only the current tax year
    // is shown (PARKAN-26), so this is always in-progress; the banner names the generation date and the year.
    val generatedDay = formatDossierStamp(generatedAt).substringBefore(' ')
    SectionCard {
        Text(text = ReleveCopy.BANNER_PROVISIONAL_TITLE, style = FrontierType.bodyM)
        Text(
            text = ReleveCopy.bannerProvisionalBody(generatedDay, taxYear),
            style = FrontierType.caption,
            color = LightColors.textSecondary,
        )
    }
}

@Composable
internal fun ClosedYearBanner(year: Int) {
    // PARKAN-26: a COMPLETED past year, drawn with a distinct caption - "année close", not the provisional
    // "année en cours" (R156 open-question 2). SectionCard is ReleveScreen's one home for the white card.
    SectionCard {
        Text(text = ReleveCopy.BANNER_CLOSED_TITLE, style = FrontierType.bodyM)
        Text(
            text = ReleveCopy.bannerClosedBody(year),
            style = FrontierType.caption,
            color = LightColors.textSecondary,
        )
    }
}

@Composable
internal fun IdentificationCard(
    document: DossierDocument,
    rules: ReleveRules,
) {
    val method = ReleveCopy.methodLabel(document.denominatorKind, rules.simplifiedBasisDays)
    val period =
        when {
            document.period.fraction >= 1.0 -> ReleveCopy.periodFullYear(document.taxYear)
            document.period.startDate == null -> ReleveCopy.periodPartial(document.taxYear)
            else -> ReleveCopy.periodFromDate(formatDate(document.period.startDate), document.taxYear)
        }
    SectionCard {
        IdRow(ReleveCopy.HEADER_NAME, document.titulaire)
        IdRow(ReleveCopy.HEADER_CANTON, document.canton)
        IdRow(
            ReleveCopy.HEADER_EMPLOYMENT_RATE,
            formatPercent(document.employmentRate.toDouble(), EMPLOYMENT_DECIMALS),
        )
        IdRow(ReleveCopy.HEADER_METHOD, method)
        IdRow(ReleveCopy.HEADER_PERIOD, period)
        IdRow(ReleveCopy.HEADER_ABSENCES_DECLARED, formatDays(document.absenceDays))
        IdRow(ReleveCopy.HEADER_GENERATED_AT, formatDossierStamp(document.generatedAt))
    }
}

@Composable
private fun IdRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.space8),
        horizontalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(
            text = label,
            style = FrontierType.caption,
            color = LightColors.textSecondary,
            modifier = Modifier.weight(1f),
        )
        Text(text = value, style = FrontierType.body, textAlign = TextAlign.End)
    }
}

@Composable
internal fun TilesGrid(tiles: DossierTiles) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space12)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space12)) {
            Tile(ReleveCopy.TILE_WORKED_DAYS, formatDays(tiles.workedDays), null, Modifier.weight(1f))
            Tile(
                ReleveCopy.TILE_SWISS_DAYS,
                formatDays(tiles.swissDays),
                LightColors.switzerlandMain,
                Modifier.weight(1f),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space12)) {
            Tile(
                ReleveCopy.TILE_TELEWORK_DAYS,
                formatDays(tiles.teleworkDays),
                LightColors.franceMain,
                Modifier.weight(1f),
            )
            Tile(ReleveCopy.TILE_MISSION_DAYS, formatDays(tiles.missionDays), null, Modifier.weight(1f))
        }
    }
}

@Composable
private fun Tile(
    label: String,
    value: String,
    dotColour: Color?,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radius.md))
                .background(LightColors.surface)
                .padding(Spacing.space16),
        verticalArrangement = Arrangement.spacedBy(Spacing.space8),
    ) {
        Text(text = label, style = FrontierType.caption, color = LightColors.textSecondary)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
        ) {
            if (dotColour != null) CountryDot(dotColour)
            Text(text = value, style = FrontierType.h2.tabularNums())
        }
    }
}

// FD7's 8 px country dot before the Suisse and Teletravail figures. The diameter is a scale value, not a
// new token (Spacing.space8 = 8 dp).
@Composable
private fun CountryDot(colour: Color) {
    Box(modifier = Modifier.size(Spacing.space8).clip(CircleShape).background(colour))
}
