package ch.monreleve.app.ui.screens.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import ch.monreleve.app.R
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.calc.Regime
import ch.monreleve.app.calc.regimeFor
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.CantonCopy
import ch.monreleve.app.fr.LicencesCopy
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.ModeChoice
import ch.monreleve.app.onboarding.OnboardingError
import ch.monreleve.app.onboarding.OnboardingPhase
import ch.monreleve.app.onboarding.OnboardingState
import ch.monreleve.app.onboarding.OnboardingStep
import ch.monreleve.app.onboarding.RateChoice
import ch.monreleve.app.onboarding.isoOf
import ch.monreleve.app.onboarding.swissDate

// AN-ONBOARD. The onboarding WIZARD (design/onboarding steps 1-7). Stateless: it reads an OnboardingState and
// calls back (fence 5). Every string comes from OnboardingCopy/CantonCopy (R238 / no-literal fence). The
// summary ("Tout est prêt") is PretScreen. Deviations from the mockups, built then noted: no granularity step;
// the real-days method reveals a total field the mockup omits (the engine requires one).

@Composable
fun OnboardingScreen(
    state: OnboardingState,
    actions: OnboardingActions,
    modifier: Modifier = Modifier,
) {
    val submitting = state.phase == OnboardingPhase.SUBMITTING
    val stepNumber = state.step.ordinal + 1
    Column(modifier = modifier.fillMaxSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.space8),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.space8),
        ) {
            BackButton(contentDescription = LicencesCopy.BACK, onBack = actions.onBack)
            StepProgress(step = stepNumber, total = ONBOARDING_TOTAL, label = OnboardingCopy.stepLabel(stepNumber))
        }
        Column(
            modifier =
                Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.space24),
            verticalArrangement = Arrangement.spacedBy(Spacing.space20),
        ) {
            when (state.step) {
                OnboardingStep.NOM -> NomStep(state, actions.onNameChange)
                OnboardingStep.CANTON -> CantonStep(state, actions.onCantonChange)
                OnboardingStep.TAUX -> TauxStep(state, actions.onRateChoiceChange, actions.onCustomRateChange)
                OnboardingStep.METHODE -> MethodeStep(state, actions.onDenominatorChange, actions.onExactTotalChange)
                OnboardingStep.PERIODE -> PeriodeStep(state, actions.onAllYearChange, actions.onActivityStartDateChange)
                OnboardingStep.MODE -> ModeStep(state, actions.onChooseManual, actions.onChooseAuto)
                OnboardingStep.RAPPEL -> RappelStep()
            }
            state.error?.let { Text(text = errorFor(it), style = FrontierType.body, color = LightColors.error) }
            if (state.phase == OnboardingPhase.NETWORK_ERROR) {
                Text(text = OnboardingCopy.ERROR_NETWORK, style = FrontierType.body, color = LightColors.error)
            }
            if (state.phase == OnboardingPhase.SESSION_ENDED) {
                Text(text = OnboardingCopy.ERROR_SESSION_ENDED, style = FrontierType.body, color = LightColors.error)
            }
        }
        BottomActions {
            if (state.step == OnboardingStep.RAPPEL) {
                PrimaryButton(OnboardingCopy.REMINDER_YES, actions.onReminderYes, enabled = !submitting)
                TertiaryButton(OnboardingCopy.REMINDER_NOT_NOW, actions.onReminderNo)
            } else {
                PrimaryButton(OnboardingCopy.CONTINUE, actions.onNext, enabled = !submitting)
            }
        }
    }
}

private const val ONBOARDING_TOTAL = 7

@Composable
private fun NomStep(
    state: OnboardingState,
    onNameChange: (String) -> Unit,
) {
    Text(text = OnboardingCopy.NAME_TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
    Text(text = OnboardingCopy.NAME_SUBTITLE, style = FrontierType.bodyL, color = LightColors.textSecondary)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        Text(text = OnboardingCopy.NAME_LABEL, style = FrontierType.caption, color = LightColors.textPrimary)
        OutlinedTextField(
            value = state.name,
            onValueChange = onNameChange,
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
    }
    Column(
        modifier =
            Modifier.fillMaxWidth()
                .background(LightColors.surface, RoundedCornerShape(Radius.lg))
                .padding(Spacing.space16),
        verticalArrangement = Arrangement.spacedBy(Spacing.space8),
    ) {
        Text(text = OnboardingCopy.NAME_PREVIEW_TITLE, style = FrontierType.caption, color = LightColors.textSecondary)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(text = OnboardingCopy.TITULAIRE, style = FrontierType.body, color = LightColors.textSecondary)
            Text(text = state.name, style = FrontierType.bodyM, color = LightColors.textPrimary)
        }
    }
}

@Composable
private fun CantonStep(
    state: OnboardingState,
    onCantonChange: (Canton) -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    Text(text = OnboardingCopy.CANTON_TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
    OutlinedTextField(
        value = query,
        onValueChange = { query = it },
        placeholder = { Text(text = OnboardingCopy.CANTON_SEARCH) },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )
    val matches = Canton.entries.filter { CantonCopy.name(it).contains(query.trim(), ignoreCase = true) }
    Column(
        modifier = Modifier.fillMaxWidth().background(LightColors.surface, RoundedCornerShape(Radius.lg)),
    ) {
        matches.forEach { canton ->
            Row(
                modifier =
                    Modifier.fillMaxWidth().clickable { onCantonChange(canton) }
                        .padding(horizontal = Spacing.space16, vertical = Spacing.space12),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.space12),
            ) {
                androidx.compose.material3.RadioButton(
                    selected = state.canton == canton,
                    onClick = { onCantonChange(canton) },
                )
                Text(text = CantonCopy.name(canton), style = FrontierType.body, color = LightColors.textPrimary)
            }
        }
    }
    state.canton?.let { chosen ->
        val consequence =
            if (regimeFor(chosen) == Regime.RESIDENCE_1983) {
                OnboardingCopy.CANTON_CONSEQUENCE_RESIDENCE
            } else {
                OnboardingCopy.CANTON_CONSEQUENCE_SOURCE
            }
        Text(text = consequence, style = FrontierType.caption, color = LightColors.textSecondary)
    }
    InfoNote(text = OnboardingCopy.CANTON_INFO)
    Text(text = OnboardingCopy.CANTON_LIST_PROVISIONAL, style = FrontierType.caption, color = LightColors.textSecondary)
}

@Composable
private fun TauxStep(
    state: OnboardingState,
    onRateChoiceChange: (RateChoice) -> Unit,
    onCustomRateChange: (String) -> Unit,
) {
    Text(text = OnboardingCopy.RATE_TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
    Text(text = OnboardingCopy.RATE_SUBTITLE, style = FrontierType.bodyL, color = LightColors.textSecondary)
    val pills =
        listOf(
            RateChoice.R100 to OnboardingCopy.RATE_100,
            RateChoice.R80 to OnboardingCopy.RATE_80,
            RateChoice.R60 to OnboardingCopy.RATE_60,
            RateChoice.OTHER to OnboardingCopy.RATE_OTHER,
        )
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        pills.forEach { (choice, label) ->
            RatePill(label, state.rateChoice == choice, Modifier.weight(1f)) { onRateChoiceChange(choice) }
        }
    }
    if (state.rateChoice == RateChoice.OTHER) {
        OutlinedTextField(
            value = state.customRate,
            onValueChange = onCustomRateChange,
            label = { Text(text = OnboardingCopy.RATE_OTHER_LABEL) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
    }
    InfoNote(text = OnboardingCopy.RATE_INFO)
}

@Composable
private fun RatePill(
    label: String,
    selected: Boolean,
    modifier: Modifier,
    onClick: () -> Unit,
) {
    Box(
        modifier =
            modifier.height(Size.buttonLarge).background(
                if (selected) LightColors.brand else LightColors.surface,
                RoundedCornerShape(Radius.pill),
            ).clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            style = FrontierType.bodyM,
            color = if (selected) LightColors.surface else LightColors.textPrimary,
        )
    }
}

@Composable
private fun MethodeStep(
    state: OnboardingState,
    onDenominatorChange: (DenominatorChoice) -> Unit,
    onExactTotalChange: (String) -> Unit,
) {
    Text(text = OnboardingCopy.METHOD_LABEL, style = FrontierType.h1, color = LightColors.textPrimary)
    Text(text = OnboardingCopy.METHOD_SUBTITLE, style = FrontierType.bodyL, color = LightColors.textSecondary)
    ChoiceCard(
        selected = state.denominator == DenominatorChoice.SIMPLIFIED240,
        text = ChoiceCardText(OnboardingCopy.METHOD_SIMPLIFIED_TITLE, OnboardingCopy.METHOD_SIMPLIFIED_DESC),
        onClick = { onDenominatorChange(DenominatorChoice.SIMPLIFIED240) },
    )
    ChoiceCard(
        selected = state.denominator == DenominatorChoice.EXACT,
        text = ChoiceCardText(OnboardingCopy.METHOD_EXACT, OnboardingCopy.METHOD_EXACT_DESC),
        onClick = { onDenominatorChange(DenominatorChoice.EXACT) },
    ) {
        if (state.denominator == DenominatorChoice.EXACT) {
            OutlinedTextField(
                value = state.exactTotalWorkDays,
                onValueChange = onExactTotalChange,
                label = { Text(text = OnboardingCopy.EXACT_TOTAL_LABEL) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
    InfoNote(text = OnboardingCopy.METHOD_INFO)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PeriodeStep(
    state: OnboardingState,
    onAllYearChange: (Boolean) -> Unit,
    onActivityStartDateChange: (String) -> Unit,
) {
    var showPicker by rememberSaveable { mutableStateOf(false) }
    Text(text = OnboardingCopy.PERIOD_TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
    ChoiceCard(
        selected = state.allYear,
        text = ChoiceCardText(OnboardingCopy.PERIOD_ALL_TITLE, OnboardingCopy.PERIOD_ALL_DESC),
        onClick = { onAllYearChange(true) },
    )
    ChoiceCard(
        selected = !state.allYear,
        text = ChoiceCardText(OnboardingCopy.PERIOD_PART_TITLE, OnboardingCopy.PERIOD_PART_DESC),
        onClick = { onAllYearChange(false) },
    ) {
        if (!state.allYear) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
                Text(
                    text = OnboardingCopy.PERIOD_START_LABEL,
                    style = FrontierType.caption,
                    color = LightColors.textPrimary,
                )
                Box(
                    modifier =
                        Modifier.fillMaxWidth().height(Size.buttonLarge)
                            .background(LightColors.surface, RoundedCornerShape(Radius.md))
                            .clickable { showPicker = true }
                            .padding(horizontal = Spacing.space16),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    Text(
                        text = swissDate(state.activityStartDate),
                        style = FrontierType.body,
                        color = LightColors.textPrimary,
                    )
                }
            }
        }
    }
    if (showPicker) {
        val pickerState = androidx.compose.material3.rememberDatePickerState()
        androidx.compose.material3.DatePickerDialog(
            onDismissRequest = { showPicker = false },
            confirmButton = {
                TertiaryButton(
                    label = OnboardingCopy.CONTINUE,
                    onClick = {
                        pickerState.selectedDateMillis?.let { onActivityStartDateChange(isoOf(it)) }
                        showPicker = false
                    },
                )
            },
        ) { androidx.compose.material3.DatePicker(state = pickerState) }
    }
}

@Composable
private fun ModeStep(
    state: OnboardingState,
    onChooseManual: () -> Unit,
    onChooseAuto: () -> Unit,
) {
    Text(text = OnboardingCopy.MODE_TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
    ChoiceCard(
        selected = state.mode == ModeChoice.MANUAL,
        text = ChoiceCardText(OnboardingCopy.MODE_MANUAL_TITLE, OnboardingCopy.MODE_MANUAL_DESC),
        onClick = onChooseManual,
    )
    ChoiceCard(
        selected = state.mode == ModeChoice.AUTO_DETECT,
        text =
            ChoiceCardText(
                OnboardingCopy.MODE_AUTO_TITLE,
                OnboardingCopy.MODE_AUTO_DESC,
                OnboardingCopy.MODE_AUTO_BADGE,
            ),
        onClick = onChooseAuto,
    )
    InfoNote(text = OnboardingCopy.MODE_INFO)
}

@Composable
private fun RappelStep() {
    IconCircle(
        iconRes = R.drawable.ic_bell,
        contentDescription = OnboardingCopy.REMINDER_TITLE,
        diameter = Spacing.space64,
        iconSize = Spacing.space28,
    )
    Text(text = OnboardingCopy.REMINDER_TITLE, style = FrontierType.h1, color = LightColors.textPrimary)
    Text(text = OnboardingCopy.REMINDER_SUBTITLE, style = FrontierType.bodyL, color = LightColors.textSecondary)
    InfoNote(text = OnboardingCopy.REMINDER_LOCK_INFO)
}

private fun errorFor(error: OnboardingError): String =
    when (error) {
        OnboardingError.NAME_MISSING -> OnboardingCopy.ERROR_NAME_MISSING
        OnboardingError.CANTON_MISSING -> OnboardingCopy.ERROR_CANTON_MISSING
        OnboardingError.RATE_INVALID -> OnboardingCopy.ERROR_RATE_INVALID
        OnboardingError.EXACT_TOTAL_MISSING -> OnboardingCopy.ERROR_EXACT_TOTAL_MISSING
        OnboardingError.EXACT_TOTAL_INVALID -> OnboardingCopy.ERROR_EXACT_TOTAL_INVALID
        OnboardingError.START_DATE_INVALID -> OnboardingCopy.ERROR_START_DATE_INVALID
        OnboardingError.PERIOD_INVALID -> OnboardingCopy.ERROR_PERIOD_INVALID
        OnboardingError.SAVE_REFUSED -> OnboardingCopy.ERROR_SAVE_REFUSED
    }
