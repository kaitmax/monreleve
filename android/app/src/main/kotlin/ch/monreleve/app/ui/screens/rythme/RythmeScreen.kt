package ch.monreleve.app.ui.screens.rythme

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import ch.monreleve.app.R
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.forecast.ForecastState
import ch.monreleve.app.forecast.RhythmChoice
import ch.monreleve.app.fr.LicencesCopy
import ch.monreleve.app.fr.PrevisionCopy
import ch.monreleve.app.fr.RythmeCopy
import ch.monreleve.app.ui.screens.onboarding.BackButton
import ch.monreleve.app.ui.screens.onboarding.BottomActions
import ch.monreleve.app.ui.screens.onboarding.PrimaryButton
import java.time.DayOfWeek

// AN-FORECAST (R341). The weekly-rhythm screen (design/decide/Rythme.dc.html): Monday to Friday, each
// Suisse or Domicile, nothing preselected the first time. Stateless (fence 5): it reads a ForecastState and
// calls back. The rhythm is a local planning preference (R341), never a record (R340) - setting a day writes
// it to Room through the controller, which is NOT an entry. The screen speaks RhythmChoice, never the wire
// RhythmKind (the repository-only fence). Tokens only; a value with no token snaps to the nearest (the day
// legend uses a weight rather than the design's 92 px, which is off the spacing scale).

private val WEEKDAYS =
    listOf(DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY)

private const val LABEL_WEIGHT = 1f
private const val TOGGLES_WEIGHT = 3f
private const val TOGGLE_WEIGHT = 1f

data class RythmeActions(
    val onSetDay: (DayOfWeek, RhythmChoice) -> Unit,
    val onViewForecast: () -> Unit = {},
    val onBack: () -> Unit = {},
)

@Composable
fun RythmeScreen(
    state: ForecastState,
    actions: RythmeActions,
    modifier: Modifier = Modifier,
) {
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
            Text(text = RythmeCopy.TITLE, style = FrontierType.h1)
            Text(text = RythmeCopy.SUBTITLE, style = FrontierType.body, color = LightColors.textSecondary)
            RhythmCard(state, actions.onSetDay)
            InfoLine(RythmeCopy.weeklyDomicile(state.domicileCount))
        }
        BottomActions {
            PrimaryButton(label = RythmeCopy.VIEW_FORECAST, onClick = actions.onViewForecast)
        }
    }
}

// Shared with the Prevision screen: the back arrow and the section name. The title is "Prevision" on both
// (the design's own header), so the copy has one home (PrevisionCopy.NAV_TITLE).
@Composable
internal fun ForecastTopBar(onBack: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = Spacing.space64).padding(horizontal = Spacing.space8),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.space4),
    ) {
        BackButton(contentDescription = LicencesCopy.BACK, onBack = onBack)
        Text(text = PrevisionCopy.NAV_TITLE, style = FrontierType.h3)
    }
}

@Composable
private fun RhythmCard(
    state: ForecastState,
    onSetDay: (DayOfWeek, RhythmChoice) -> Unit,
) {
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
        for (day in WEEKDAYS) {
            DayRow(
                label = RythmeCopy.DAYS[day.ordinal],
                choice = state.rhythmDays[day],
                onChoose = { kind -> onSetDay(day, kind) },
            )
        }
    }
}

@Composable
private fun DayRow(
    label: String,
    choice: RhythmChoice?,
    onChoose: (RhythmChoice) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.space12),
    ) {
        Text(text = label, style = FrontierType.bodyM, modifier = Modifier.weight(LABEL_WEIGHT))
        Row(
            modifier = Modifier.weight(TOGGLES_WEIGHT),
            horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
        ) {
            DayToggle(
                label = RythmeCopy.SUISSE,
                selected = choice == RhythmChoice.SUISSE,
                modifier = Modifier.weight(TOGGLE_WEIGHT),
            ) { onChoose(RhythmChoice.SUISSE) }
            DayToggle(
                label = RythmeCopy.DOMICILE,
                selected = choice == RhythmChoice.DOMICILE,
                modifier = Modifier.weight(TOGGLE_WEIGHT),
            ) { onChoose(RhythmChoice.DOMICILE) }
        }
    }
}

// Selected renders filled (brand), unselected outlined - the choice is visible without colour alone (R340),
// the same idiom as AujourdhuiScreen's RecordButton. `selected` is announced for TalkBack.
@Composable
private fun DayToggle(
    label: String,
    selected: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radius.pill)
    val sizing = modifier.heightIn(min = Spacing.space48).semantics { this.selected = selected }
    // Tighter than the Material default so "Domicile" fits on one line in the narrow toggle (the design's pill).
    val padding = PaddingValues(horizontal = Spacing.space8)
    if (selected) {
        Button(onClick = onClick, shape = shape, contentPadding = padding, modifier = sizing) {
            Text(text = label, style = FrontierType.bodyM)
        }
    } else {
        OutlinedButton(onClick = onClick, shape = shape, contentPadding = padding, modifier = sizing) {
            Text(text = label, style = FrontierType.bodyM)
        }
    }
}

@Composable
private fun InfoLine(text: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.space8), verticalAlignment = Alignment.Top) {
        Icon(
            painter = painterResource(R.drawable.ic_info),
            contentDescription = null,
            tint = LightColors.textSecondary,
            modifier = Modifier.size(Spacing.space20),
        )
        Text(text = text, style = FrontierType.caption, color = LightColors.textSecondary)
    }
}
