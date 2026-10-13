package ch.monreleve.app.ui.screens.comparison

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import ch.monreleve.app.R
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.dossier.ComparisonCause
import ch.monreleve.app.dossier.ComparisonGap
import ch.monreleve.app.dossier.ComparisonView
import ch.monreleve.app.fr.ComparisonCopy
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.ui.screens.onboarding.BottomActions
import ch.monreleve.app.ui.screens.onboarding.InfoNote
import ch.monreleve.app.ui.screens.rythme.ForecastTopBar

// AN-RECON (design/decide/Employeur.dc.html). « Votre employeur a-t-il le même chiffre ? » Stateless: it reads a
// ComparisonView (assembled by the pure buildComparison, every figure from the server's dossier, R287/R340) and
// the raw attestation text, and calls back through ComparisonActions. No arithmetic here (FW12): the gap is the
// engine's, the rates are formatPercent'd, the causes are facts from the record. The vocabulary ban holds.
@Composable
fun ComparisonScreen(
    view: ComparisonView,
    employerInput: String,
    employerRate: Double?,
    actions: ComparisonActions,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxSize()) {
        ForecastTopBar(onBack = actions.onBack, title = ComparisonCopy.NAV_TITLE)
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.space24),
            verticalArrangement = Arrangement.spacedBy(Spacing.space16),
        ) {
            Text(text = ComparisonCopy.TITLE, style = FrontierType.h1)
            if (view.isCurrentYear) {
                Text(
                    text = ComparisonCopy.currentYearRefusal(view.year),
                    style = FrontierType.body,
                    color = LightColors.textSecondary,
                )
            } else {
                CompletedYearBody(view, employerInput, employerRate, actions.onInputChange, actions.onViewDays)
            }
        }
        BottomActions {
            // The filled brand CTA, as the design draws it. NOT the shared PrimaryButton: that fixes the height
            // at 56 dp, which clips this long label when it wraps to two lines at 200 % text (R310). heightIn lets
            // the pill grow for the second line instead, so the whole label stays readable.
            Button(
                onClick = actions.onViewDays,
                shape = RoundedCornerShape(Radius.pill),
                colors =
                    ButtonDefaults.buttonColors(
                        containerColor = LightColors.brand,
                        contentColor = LightColors.surface,
                    ),
                modifier = Modifier.fillMaxWidth().heightIn(min = Size.buttonLarge),
            ) {
                Text(text = ComparisonCopy.VIEW_DAYS, style = FrontierType.bodyM, textAlign = TextAlign.Center)
            }
        }
    }
}

@Composable
private fun CompletedYearBody(
    view: ComparisonView,
    employerInput: String,
    employerRate: Double?,
    onInputChange: (String) -> Unit,
    onViewDays: () -> Unit,
) {
    Text(text = ComparisonCopy.LEAD, style = FrontierType.body, color = LightColors.textSecondary)
    OutlinedTextField(
        value = employerInput,
        onValueChange = onInputChange,
        label = { Text(text = ComparisonCopy.employerRateLabel(view.year)) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        modifier = Modifier.fillMaxWidth(),
    )
    // R287: the server's figure does not include days still pending on this device, and the screen says so.
    if (view.daysUnsynced > 0) {
        Text(
            text = ReleveCopy.pendingNotSynced(view.daysUnsynced),
            style = FrontierType.caption,
            color = LightColors.textSecondary,
        )
    }
    val gap = view.gap
    if (gap != null && employerRate != null) {
        ComparisonCard(releveRate = view.releveRate, employerRate = employerRate, gap = gap)
    }
    Text(text = ComparisonCopy.CAUSES_HEADING, style = FrontierType.bodyM)
    for (cause in view.causes) {
        CauseRow(cause, onViewDays)
    }
    InfoNote(text = ComparisonCopy.INFO_NOT_WHO_IS_RIGHT)
}

// The pairing card: the relevé figure beside the employer's, then the gap in points and about-days. A bordered
// white card, as the design draws it (the rhythm card's border idiom).
@Composable
private fun ComparisonCard(
    releveRate: Double,
    employerRate: Double,
    gap: ComparisonGap,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.lg))
                .background(LightColors.surface)
                .border(Size.rule, LightColors.borderDefault, RoundedCornerShape(Radius.lg))
                .padding(Spacing.space16),
        verticalArrangement = Arrangement.spacedBy(Spacing.space8),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.space12),
        ) {
            RatePair(ComparisonCopy.RELEVE_LABEL, formatPercent(releveRate, 2), Modifier.weight(1f))
            RatePair(ComparisonCopy.EMPLOYER_LABEL, formatPercent(employerRate, 2), Modifier.weight(1f))
        }
        val gapText =
            buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) {
                    append(ComparisonCopy.gapHeadline(gap.points))
                }
                append(ComparisonCopy.gapTail(gap.environDays))
            }
        Text(text = gapText, style = FrontierType.body, color = LightColors.textPrimary)
    }
}

@Composable
private fun RatePair(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        Text(text = label, style = FrontierType.caption, color = LightColors.textSecondary)
        Text(text = value, style = FrontierType.h2, color = LightColors.textPrimary)
    }
}

// One cause row. The record-derived facts (missions, method, unrecorded days) are tappable and open the day-by-day
// record (a right chevron, the back chevron mirrored); the several-employers note is general context, not tappable.
@Composable
private fun CauseRow(
    cause: ComparisonCause,
    onViewDays: () -> Unit,
) {
    val title: String
    val body: String
    val opensDays: Boolean
    when (cause) {
        is ComparisonCause.Missions -> {
            title = ComparisonCopy.CAUSE_MISSIONS_TITLE
            body = ComparisonCopy.missionsBody(cause.missionDays, cause.creditedDays, cause.cap)
            opensDays = true
        }
        is ComparisonCause.Method -> {
            title = ComparisonCopy.CAUSE_METHOD_TITLE
            body = ComparisonCopy.methodBody(cause.denominatorKind, cause.simplifiedBasisDays)
            opensDays = true
        }
        is ComparisonCause.UnrecordedDays -> {
            title = ComparisonCopy.CAUSE_UNRECORDED_TITLE
            body = ComparisonCopy.unrecordedBody(cause.count)
            opensDays = true
        }
        ComparisonCause.SeveralEmployers -> {
            title = ComparisonCopy.CAUSE_SEVERAL_TITLE
            body = ComparisonCopy.CAUSE_SEVERAL_BODY
            opensDays = false
        }
    }
    val rowModifier =
        Modifier
            .fillMaxWidth()
            .then(if (opensDays) Modifier.clickable(onClick = onViewDays) else Modifier)
            .padding(vertical = Spacing.space12)
    Row(
        modifier = rowModifier,
        horizontalArrangement = Arrangement.spacedBy(Spacing.space12),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
            Text(text = title, style = FrontierType.bodyM, color = LightColors.textPrimary)
            Text(text = body, style = FrontierType.caption, color = LightColors.textSecondary)
        }
        if (opensDays) {
            Icon(
                painter = painterResource(R.drawable.ic_chevron_left),
                contentDescription = null,
                tint = LightColors.brand,
                modifier = Modifier.size(Spacing.space20).rotate(180f),
            )
        }
    }
}
