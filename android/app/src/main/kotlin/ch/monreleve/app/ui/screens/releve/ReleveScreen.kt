package ch.monreleve.app.ui.screens.releve

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import ch.monreleve.app.design.FrontierType
import ch.monreleve.app.design.LightColors
import ch.monreleve.app.design.Radius
import ch.monreleve.app.design.Size
import ch.monreleve.app.design.Spacing
import ch.monreleve.app.fr.ReleveCopy
import ch.monreleve.app.fr.SignInCopy
import ch.monreleve.app.releve.ReleveError
import ch.monreleve.app.releve.ReleveState

// AN11 (SPEC 11.4, SPEC 12, FD7). The Releve screen: the SERVER's Releve annuel de teletravail, rendered
// natively - the same document as the PDF at a phone's width. Stateless (fence 5): it reads a ReleveState
// and calls back through ReleveActions; every figure comes from the parsed DossierDocument, none is
// recomputed here (FW12). All copy is ReleveCopy's (the document's words); the two rate captions are
// RatesCopy's one home, the fallback note AujourdhuiCopy's, the retry label SignInCopy's.
//
// FD7 IS A VISUAL REFERENCE; A RULING OR THE DOCUMENT WINS (named in REPORT-AN11). Where FD7 draws a 1 px
// card border the Android build uses white-on-grey CONTRAST as every other component does (the AN10/FD6
// decision); where FD7 puts a status chip with an icon the document's WORD stands, because the badge's
// status inputs are not on the wire and the device must not recompute them.
//
// THE DOCUMENT IS SPLIT ACROSS THREE FILES to keep each within detekt's per-file function budget (the
// calendar's split idiom): this file holds the shell and the legal footer; ReleveHeader.kt the banner,
// identification and tiles; ReleveSections.kt the zone panel, monthly table and annex.

@Composable
fun ReleveScreen(
    state: ReleveState,
    actions: ReleveActions,
    modifier: Modifier = Modifier,
) {
    when (state) {
        ReleveState.Loading -> CenteredMessage(ReleveCopy.LOADING, modifier)
        is ReleveState.Failed -> FailedBody(state.reason, actions.onRetry, modifier)
        is ReleveState.Loaded -> DocumentBody(state, actions, modifier)
    }
}

@Composable
private fun CenteredMessage(
    message: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.fillMaxSize().padding(Spacing.space20),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = message, style = FrontierType.body, color = LightColors.textSecondary)
    }
}

@Composable
private fun FailedBody(
    reason: ReleveError,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val message =
        when (reason) {
            ReleveError.NETWORK -> ReleveCopy.ERROR_NETWORK
            ReleveError.SERVER -> ReleveCopy.ERROR_SERVER
            ReleveError.SESSION_EXPIRED -> ReleveCopy.ERROR_SESSION_EXPIRED
            ReleveError.SESSION_ENDED -> ReleveCopy.ERROR_SESSION_ENDED
            ReleveError.NO_SESSION -> ReleveCopy.ERROR_NO_SESSION
        }
    Column(
        modifier = modifier.fillMaxSize().padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(text = message, style = FrontierType.body, color = LightColors.textPrimary)
        Button(onClick = onRetry, shape = RoundedCornerShape(Radius.buttonLg)) {
            Text(text = SignInCopy.RETRY)
        }
    }
}

@Composable
private fun DocumentBody(
    loaded: ReleveState.Loaded,
    actions: ReleveActions,
    modifier: Modifier = Modifier,
) {
    val document = loaded.document
    Column(
        modifier = modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(Spacing.space20),
        verticalArrangement = Arrangement.spacedBy(Spacing.space16),
    ) {
        Text(text = ReleveCopy.TITLE, style = FrontierType.h2)
        // R288: when this is a cached copy shown offline, it says so first - dated, never presented as current.
        if (loaded.offline) OfflineBanner(generatedAt = document.generatedAt)
        ProvisionalBanner(generatedAt = document.generatedAt, taxYear = document.taxYear)
        // R287: days still pending on this device are not in the server's document, and the releve says so -
        // exactly when something is pending, so a reader who sees two rates knows which one this is.
        if (loaded.pendingCount > 0) {
            Text(
                text = ReleveCopy.pendingNotSynced(loaded.pendingCount),
                style = FrontierType.caption,
                color = LightColors.textSecondary,
            )
        }
        if (document.recordedEntries == 0) {
            Text(
                text = ReleveCopy.EMPTY_RECORD_NOTE,
                style = FrontierType.caption,
                color = LightColors.textSecondary,
            )
        }
        IdentificationCard(document, loaded.rules)
        TilesGrid(document.tiles)
        // R225: the denominator is a prorated basis, not a row count, and the tile says so.
        Text(
            text = ReleveCopy.TILE_WORKED_DAYS_NOTE,
            style = FrontierType.caption,
            color = LightColors.textTertiary,
        )
        ZonePanel(document.zone, loaded.rules, document.creditedMissionDays, document.rateWithoutMissions)
        MonthlyTable(document.months)
        AnnexSection(document)
        ExportButtons(onExportPdf = actions.onExportPdf, onExportCsv = actions.onExportCsv)
        LegalFooter()
    }
}

// FD7 section 8: a primary PDF button and a secondary CSV button. Text-only (no lucide file-down/table
// glyph shipped - the FD7 icon is the named conflict); the labels carry the meaning. The export is a server
// render handed to the platform share sheet by the composition root (AC2 / R136).
@Composable
private fun ExportButtons(
    onExportPdf: () -> Unit,
    onExportCsv: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space8)) {
        Button(
            onClick = onExportPdf,
            shape = RoundedCornerShape(Radius.buttonLg),
            modifier = Modifier.fillMaxWidth().heightIn(min = Size.buttonLarge),
        ) {
            Text(text = ReleveCopy.EXPORT_PDF)
        }
        OutlinedButton(
            onClick = onExportCsv,
            shape = RoundedCornerShape(Radius.md),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(text = ReleveCopy.EXPORT_CSV)
        }
    }
}

// The white card every section sits in: contrast on the grey canvas, no drawn 1 px border (the AN10/FD6
// decision - a 1 dp hairline has no token; FD7's border is the named conflict). internal: the other two
// releve files compose it too.
@Composable
internal fun SectionCard(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radius.lg))
                .background(LightColors.surface)
                .padding(Spacing.space16),
    ) {
        content()
    }
}

@Composable
private fun LegalFooter() {
    // R183: UNCONDITIONAL here. Every entry in an exported dossier IS timestamped, or it would not be in
    // the document - unlike the site footer, whose version is conditional on a product state.
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.space4)) {
        Text(text = ReleveCopy.FOOTER_TIMESTAMPS, style = FrontierType.caption, color = LightColors.textTertiary)
        Text(text = ReleveCopy.FOOTER_DECLARATION, style = FrontierType.caption, color = LightColors.textTertiary)
        Text(text = ReleveCopy.FOOTER_NOT_ADVICE, style = FrontierType.caption, color = LightColors.textTertiary)
    }
}
