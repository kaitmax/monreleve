package ch.monreleve.app.ui.screens.parametres

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.fr.ParametresCopy
import ch.monreleve.app.fr.text.formatDate

// AN-PARAMS. The settings list's row primitives (Material 3 ListItem) and the one card they sit in. Replaces
// AN12's mixed input styles (a centred pill, a floating-label field, a placeholder field) with ONE row shape
// per purpose: a value row that opens its edit sheet, an action row, a switch row, a read-only version row.
// Stateless (fence 5); every string from fr/ (R238 / the no-literal fence). A row's container is the theme's
// surface (white), matching the card, so the dividers are the only seam between rows.

/**
 * The « Début d'activité » row's value: the stored ISO day shown in the Swiss format (formatDate, dd.MM.yyyy),
 * or « Toute l'année » when empty. The stored value stays ISO (R28); this is presentation only (R181 - derived
 * from the stored string, never a second source). Pure and internal so a JVM test asserts both branches.
 */
internal fun startDateDisplay(iso: String): String =
    if (iso.isBlank()) ParametresCopy.START_DATE_EMPTY else runCatching { formatDate(iso) }.getOrDefault(iso)

/** One white card, 1 px border, no shadow (DESIGN-SYSTEM), holding a section's rows. ListItems self-pad. */
@Composable
internal fun ParametresCard(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.lg))
                .background(LightColors.surface)
                .border(Size.rule, LightColors.borderDefault, RoundedCornerShape(Radius.lg)),
        content = content,
    )
}

/** A divider between two rows in a card (never before the first row or after the last). */
@Composable
internal fun RowDivider() {
    HorizontalDivider(color = LightColors.borderDefault)
}

/** A work-setting row: the setting's name and its current value; tapping opens the edit sheet. */
@Composable
internal fun SettingRow(
    label: String,
    value: String,
    onClick: () -> Unit,
) {
    ListItem(
        headlineContent = { Text(text = label, style = FrontierType.bodyM) },
        supportingContent = { Text(text = value, style = FrontierType.body) },
        trailingContent = { ChevronIcon() },
        colors = transparentListColors(),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    )
}

/** An action row: a label that opens something (a page, a chooser, a confirmation). Optional error colour. */
@Composable
internal fun ActionRow(
    label: String,
    destructive: Boolean = false,
    onClick: () -> Unit,
) {
    val color = if (destructive) LightColors.error else LightColors.textPrimary
    ListItem(
        headlineContent = { Text(text = label, style = FrontierType.bodyM, color = color) },
        trailingContent = { ChevronIcon() },
        colors = transparentListColors(),
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    )
}

/** A switch row: a label, a one-line summary, and the switch that applies at once. Not row-clickable. */
@Composable
internal fun SwitchRow(
    label: String,
    summary: String,
    checked: Boolean,
    onToggle: (Boolean) -> Unit,
    enabled: Boolean,
) {
    ListItem(
        headlineContent = { Text(text = label, style = FrontierType.bodyM) },
        supportingContent = { Text(text = summary, style = FrontierType.body) },
        trailingContent = { Switch(checked = checked, onCheckedChange = onToggle, enabled = enabled) },
        colors = transparentListColors(),
        modifier = Modifier.fillMaxWidth(),
    )
}

/** A read-only row: a label and a value, no chevron, not clickable (the app version). */
@Composable
internal fun ValueRow(
    label: String,
    value: String,
) {
    ListItem(
        headlineContent = { Text(text = label, style = FrontierType.bodyM) },
        trailingContent = { Text(text = value, style = FrontierType.body, color = LightColors.textSecondary) },
        colors = transparentListColors(),
        modifier = Modifier.fillMaxWidth(),
    )
}

// The card already paints the surface and holds the one background; a transparent ListItem container lets it
// show through so the dividers are the only seam (ListItemDefaults, never a raw colour - the token fence).
@Composable
private fun transparentListColors() = ListItemDefaults.colors(containerColor = LightColors.surface)

@Composable
private fun ChevronIcon() {
    Icon(imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = null)
}
