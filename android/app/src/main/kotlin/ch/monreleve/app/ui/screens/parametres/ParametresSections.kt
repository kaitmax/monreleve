package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import ch.monreleve.app.calc.Canton
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.CantonCopy
import ch.monreleve.app.fr.OnboardingCopy
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.format.formatPercent
import ch.monreleve.app.onboarding.DenominatorChoice
import ch.monreleve.app.onboarding.GranularityChoice

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
    }
}

@Composable
internal fun SaisieSection(
    autoDetectionEnabled: Boolean,
    eveningNotificationEnabled: Boolean,
    enabled: Boolean,
    onToggleAuto: (Boolean) -> Unit,
    onToggleEvening: (Boolean) -> Unit,
    onLearnMore: () -> Unit,
) {
    SectionHeading(ParametresCopy.AUTO_HEADING)
    ParametresCard {
        SwitchRow(
            ParametresCopy.AUTO_LABEL,
            ParametresCopy.AUTO_SUMMARY,
            autoDetectionEnabled,
            onToggleAuto,
            enabled,
        )
        RowDivider()
        ActionRow(ParametresCopy.LEARN_MORE, onClick = onLearnMore)
        // R323 / PARKAN-36: the evening proposal appears only when detection is on - without it there is nothing
        // to propose, so offering the switch would be one that can never fire.
        if (autoDetectionEnabled) {
            RowDivider()
            SwitchRow(
                ParametresCopy.EVENING_LABEL,
                ParametresCopy.EVENING_DESCRIPTION,
                eveningNotificationEnabled,
                onToggleEvening,
                enabled,
            )
        }
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
        ActionRow(ParametresCopy.LICENCES_ROW, onClick = onOpenLicences)
        RowDivider()
        ValueRow(ParametresCopy.VERSION_ROW, appVersion)
    }
    Text(text = ParametresCopy.ABOUT_DISCLAIMER_1, style = FrontierType.caption, color = LightColors.textTertiary)
    Text(text = ParametresCopy.ABOUT_DISCLAIMER_2, style = FrontierType.caption, color = LightColors.textTertiary)
}

// « En savoir plus »: the full detection disclosure, relocated here VERBATIM (R282/R312/R317 honest disclosures
// are moved, never deleted; CopyReachabilityTest keeps each reachable, R238). The title is the switch's own label.
@Composable
internal fun LearnMoreSheetContent(onClose: () -> Unit) {
    SheetColumn {
        Text(text = ParametresCopy.AUTO_LABEL, style = FrontierType.h3)
        Text(text = ParametresCopy.AUTO_DESCRIPTION, style = FrontierType.body)
        Text(text = ParametresCopy.AUTO_BETA_NOTE, style = FrontierType.body, color = LightColors.textSecondary)
        Text(text = ParametresCopy.AUTO_BATTERY_NOTE, style = FrontierType.body, color = LightColors.textSecondary)
        OutlinedButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.CLOSE)
        }
    }
}

// The export chooser: one « Exporter mes données » row opens this, offering the two documents (AC2) and the
// helper that names what they contain. Tapping either hands the server's render to the platform share sheet.
@Composable
internal fun ExportChooserContent(
    onExportJson: () -> Unit,
    onExportCsv: () -> Unit,
    onClose: () -> Unit,
) {
    SheetColumn {
        Text(text = ParametresCopy.DATA_EXPORT_ROW, style = FrontierType.h3)
        Text(text = ParametresCopy.EXPORT_HELPER, style = FrontierType.body)
        Button(
            onClick = {
                onExportJson()
                onClose()
            },
            modifier = Modifier.fillMaxWidth().heightIn(min = Size.buttonLarge),
        ) {
            Text(text = ParametresCopy.EXPORT_JSON)
        }
        OutlinedButton(onClick = {
            onExportCsv()
            onClose()
        }, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.EXPORT_CSV)
        }
        TextButton(onClick = onClose, modifier = Modifier.fillMaxWidth()) {
            Text(text = ParametresCopy.CLOSE)
        }
    }
}

@Composable
private fun SheetColumn(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
        content = content,
    )
}

private fun cantonValue(canton: Canton?): String = canton?.let(CantonCopy::name) ?: OnboardingCopy.CANTON_PLACEHOLDER

// « 100 % » - the stored whole-number rate with the French percent (R181 - derived, never typed).
private fun rateValue(rate: String): String = rate.toIntOrNull()?.let { formatPercent(it.toDouble(), PERCENT_WHOLE) } ?: rate

private fun methodValue(committed: CommittedSettings): String =
    if (committed.denominator == DenominatorChoice.EXACT) {
        OnboardingCopy.METHOD_EXACT
    } else {
        OnboardingCopy.METHOD_SIMPLIFIED
    }

private fun granularityValue(granularity: GranularityChoice): String =
    if (granularity == GranularityChoice.HALF_DAY) OnboardingCopy.GRANULARITY_HALF_DAY else OnboardingCopy.GRANULARITY_DAY
