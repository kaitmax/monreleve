package ch.monreleve.app.ui.screens.parametres

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.fr.CantonCopy
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.RythmeCopy
import ch.monreleve.app.fr.text.formatPercent
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice
import ch.monreleve.app.parametres.ParametresPhase
import ch.monreleve.app.parametres.ParametresState

// AN-PARAMS. The five grouped sections of the settings list (SPEC 11.5 / FD9), each a section heading over a
// white card of Material 3 rows. The « Situation professionnelle » rows open their edit sheets; the
// « Enregistrement » rows carry the detection switch, « En savoir plus » and (when detection is on) the evening
// proposal; « Compte » the sign-out; « Mes données » the export chooser and - set apart, in the error colour -
// account deletion; « À propos » the legal pages, licences and the app version. Stateless (fence 5); every
// string from fr/ (R238). Values are formatted here from the committed settings (R181 - derived, never typed).

private const val PERCENT_WHOLE = 0

/**
 * The last saved settings the rows display and the revert restores - built by ParametresScreen (R181).
 * Serializable, so rememberSaveable's default autoSaver stores it in the Bundle that outlives a background kill
 * (R310) - the same idiom as ParametresSnapshot.
 */
internal data class CommittedSettings(
    val canton: Canton?,
    val employmentRate: String,
    val denominator: DenominatorChoice,
    val exactTotalWorkDays: String,
    val granularity: GranularityChoice,
    val activityStartDate: String,
) : java.io.Serializable {
    companion object {
        private const val serialVersionUID: Long = 1L
    }
}

@Composable
internal fun SituationSection(
    committed: CommittedSettings,
    onEdit: (EditTarget) -> Unit,
    onOpenRhythm: () -> Unit,
) {
    SectionHeading(ParametresCopy.SITUATION_HEADING)
    ParametresCard {
        SettingRow(OnboardingCopy.CANTON_LABEL, cantonValue(committed.canton)) { onEdit(EditTarget.CANTON) }
        RowDivider()
        SettingRow(OnboardingCopy.RATE_LABEL, rateValue(committed.employmentRate)) { onEdit(EditTarget.RATE) }
        RowDivider()
        SettingRow(OnboardingCopy.METHOD_LABEL, methodValue(committed)) { onEdit(EditTarget.METHOD) }
        RowDivider()
        SettingRow(OnboardingCopy.GRANULARITY_LABEL, granularityValue(committed.granularity)) {
            onEdit(EditTarget.GRANULARITY)
        }
        RowDivider()
        SettingRow(OnboardingCopy.START_DATE_LABEL, startDateDisplay(committed.activityStartDate)) {
            onEdit(EditTarget.START_DATE)
        }
        RowDivider()
        // AN-FORECAST: the weekly rhythm (a planning preference, R341) opens its own editor, not an edit sheet.
        ActionRow(RythmeCopy.TITLE, onClick = onOpenRhythm)
    }
}

// Reads the two toggle states and the in-flight flag from `state` and the toggle callbacks from `actions` (the
// column has both), so it stays at three parameters rather than carrying each scalar - no @Suppress the
// no-inline-string fence (Fence 4) forbids in ui/.
@Composable
internal fun SaisieSection(
    state: ParametresState,
    actions: ParametresActions,
    onLearnMore: () -> Unit,
) {
    val enabled = state.phase != ParametresPhase.SAVING
    SectionHeading(ParametresCopy.AUTO_HEADING)
    ParametresCard {
        SwitchRow(
            ParametresCopy.AUTO_LABEL,
            ParametresCopy.AUTO_SUMMARY,
            state.autoDetectionEnabled,
            actions.onToggleAutoDetection,
            enabled,
        )
        RowDivider()
        ActionRow(ParametresCopy.LEARN_MORE, onClick = onLearnMore)
        // R323 / PARKAN-36: the evening proposal appears only when detection is on - without it there is nothing
        // to propose, so offering the switch would be one that can never fire.
        if (state.autoDetectionEnabled) {
            RowDivider()
            SwitchRow(
                ParametresCopy.EVENING_LABEL,
                ParametresCopy.EVENING_DESCRIPTION,
                state.eveningNotificationEnabled,
                actions.onToggleEveningNotification,
                enabled,
            )
        }
        // AN-ALERT: the threshold alert is NOT gated on detection - it reads the forecast, not the position - so
        // its switch is always offered here (its own switch, the Prevision screen offers the same opt-in once).
        RowDivider()
        SwitchRow(
            ParametresCopy.ALERT_LABEL,
            ParametresCopy.ALERT_DESCRIPTION,
            state.thresholdAlertEnabled,
            actions.onToggleThresholdAlert,
            enabled,
        )
    }
}

@Composable
internal fun CompteSection(onSignOut: () -> Unit) {
    SectionHeading(ParametresCopy.ACCOUNT_HEADING)
    // NO EMAIL ROW (AN-PARAMS deviation, in the report): the device stores only an opaque account tag, never the
    // address (AccountStore / D16 / D18). Surfacing an email would need a schema or a /v1 read, both HARD
    // BOUNDARIES - and « never claim more than the record supports ». The section carries the sign-out action.
    ParametresCard {
        ActionRow(ParametresCopy.SIGN_OUT, onClick = onSignOut)
    }
}

@Composable
internal fun DonneesSection(
    onExport: () -> Unit,
    onDelete: () -> Unit,
) {
    SectionHeading(ParametresCopy.DATA_HEADING)
    ParametresCard {
        ActionRow(ParametresCopy.DATA_EXPORT_ROW, onClick = onExport)
    }
    // « Supprimer mon compte » is SET APART in its own card, in the error colour - never next to a harmless row.
    ParametresCard {
        ActionRow(ParametresCopy.DELETE_ROW, destructive = true, onClick = onDelete)
    }
    Text(text = ParametresCopy.DELETE_ROW_HELPER, style = FrontierType.caption)
}

@Composable
internal fun AProposSection(
    appVersion: String,
    onOpenLegal: (ch.monreleve.app.parametres.LegalPage) -> Unit,
    onOpenLicences: () -> Unit,
) {
    SectionHeading(ParametresCopy.ABOUT_HEADING)
    ParametresCard {
        ActionRow(ParametresCopy.LEGAL_ROW) { onOpenLegal(ch.monreleve.app.parametres.LegalPage.LEGAL) }
        RowDivider()
        ActionRow(ParametresCopy.PRIVACY_ROW) { onOpenLegal(ch.monreleve.app.parametres.LegalPage.PRIVACY) }
        RowDivider()
        ActionRow(ParametresCopy.TERMS_ROW) { onOpenLegal(ch.monreleve.app.parametres.LegalPage.TERMS) }
        RowDivider()
        ActionRow(ParametresCopy.SOURCES_ROW) { onOpenLegal(ch.monreleve.app.parametres.LegalPage.SOURCES) }
        RowDivider()
        ActionRow(ParametresCopy.ABOUT_PAGE_ROW) { onOpenLegal(ch.monreleve.app.parametres.LegalPage.ABOUT) }
        RowDivider()
        ActionRow(ParametresCopy.LICENCES_ROW, onClick = onOpenLicences)
        RowDivider()
        ValueRow(ParametresCopy.VERSION_ROW, appVersion)
    }
    Text(text = ParametresCopy.ABOUT_DISCLAIMER_1, style = FrontierType.caption, color = LightColors.textTertiary)
    Text(text = ParametresCopy.ABOUT_DISCLAIMER_2, style = FrontierType.caption, color = LightColors.textTertiary)
}

// « En savoir plus » (the full detection disclosure, relocated VERBATIM) and the export chooser live in their
// own file (ParametresInfoContent) so this file stays under detekt's TooManyFunctions threshold; the list rows
// here only OPEN them. CopyReachabilityTest keeps each relocated string reachable (R238).

private fun cantonValue(canton: Canton?): String = canton?.let(CantonCopy::name) ?: OnboardingCopy.CANTON_PLACEHOLDER

// « 100 % » - the stored whole-number rate with the French percent (R181 - derived, never typed).
private fun rateValue(rate: String): String {
    val whole = rate.toIntOrNull() ?: return rate
    return formatPercent(whole.toDouble(), PERCENT_WHOLE)
}

private fun methodValue(committed: CommittedSettings): String =
    if (committed.denominator == DenominatorChoice.EXACT) {
        OnboardingCopy.METHOD_EXACT
    } else {
        OnboardingCopy.METHOD_SIMPLIFIED
    }

private fun granularityValue(granularity: GranularityChoice): String =
    if (granularity == GranularityChoice.HALF_DAY) {
        OnboardingCopy.GRANULARITY_HALF_DAY
    } else {
        OnboardingCopy.GRANULARITY_DAY
    }
