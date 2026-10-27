package ch.monreleve.app.design

// IOS-1b-A R603: MOVED FROM :app to :shared commonMain (package unchanged) - the design system the shared Aujourd'hui
// screen draws with, one definition for both platforms.

// AN3 increment 2. Kotlin port of web/lib/ui/core/zone-tokens.ts, adapted:
// the web file's mapping targets CSS custom-property NAMES, resolved later
// against tokens.scss. Android has no such indirection - Tokens.kt IS the
// single source (D37/R8/R62), so this file maps straight to the actual
// Color values it defines rather than to a second layer of string names
// nothing on this platform would resolve.
//
// SPEC 6.2: TWO MAPS, NEVER ONE. The rail is coloured by Zone and the
// badge by Status - colouring the rail by Status is a review rejection.
// STATUS_PRESENTATION is the join this file performs: STATUS_VISUAL (here)
// plus STATUS_COPY (fr/Statuses.kt), by wireKey (see Zones.kt's header for
// why the join cannot be by the Status enum directly).

import ch.monreleve.app.fr.STATUS_COPY

/**
 * The Lucide icons this product actually uses. A mistyped name in a raw
 * String would compile and render nothing; this closes that the same way
 * the TS reference's own narrowed union does - the exhaustive `when` in
 * whatever composable maps this to a real icon becomes a compile error if
 * a fifth status arrives with no branch for it.
 */
enum class LucideIconName(val kebabCase: String) {
    CIRCLE_CHECK("circle-check"),
    TRIANGLE_ALERT("triangle-alert"),
    CIRCLE_X("circle-x"),
    OCTAGON_ALERT("octagon-alert"),
}

/** The presentation half of a badge: what it looks like, with no words. */
data class StatusVisual(
    val icon: LucideIconName,
    val colour: androidx.compose.ui.graphics.Color,
    val softColour: androidx.compose.ui.graphics.Color,
)

val STATUS_VISUAL: Map<Status, StatusVisual> =
    mapOf(
        Status.COMPLIANT to
            StatusVisual(
                icon = LucideIconName.CIRCLE_CHECK,
                colour = ch.monreleve.app.design.LightColors.success,
                softColour = ch.monreleve.app.design.LightColors.successBg,
            ),
        // The warning badge on the green band (SPEC 6.2). Success here
        // would make the badge agree with the rail and the exposure
        // invisible.
        Status.MISSION_EXPOSURE to
            StatusVisual(
                icon = LucideIconName.TRIANGLE_ALERT,
                colour = ch.monreleve.app.design.LightColors.warning,
                softColour = ch.monreleve.app.design.LightColors.warningBg,
            ),
        Status.REGIME_LOST to
            StatusVisual(
                icon = LucideIconName.CIRCLE_X,
                colour = ch.monreleve.app.design.LightColors.error,
                softColour = ch.monreleve.app.design.LightColors.errorBg,
            ),
        // A distinct GLYPH from regime-lost, deliberately. Only three
        // status colours exist for four statuses (SPEC 12), so these two
        // necessarily share the error colour; if they shared the icon too
        // the badge would look identical for "you lost the tax regime"
        // and "your social security affiliation moves" - two different
        // legal consequences flattened into one picture.
        Status.SOCIAL_SWITCH to
            StatusVisual(
                icon = LucideIconName.OCTAGON_ALERT,
                colour = ch.monreleve.app.design.LightColors.error,
                softColour = ch.monreleve.app.design.LightColors.errorBg,
            ),
    )

/** Zone to band colour (SPEC 6.2): the three bands are success / warning / error, in that order. */
val ZONE_BAND_COLOUR: Map<Zone, androidx.compose.ui.graphics.Color> =
    mapOf(
        Zone.COMPLIANT to ch.monreleve.app.design.LightColors.success,
        Zone.FISCAL_EXPOSURE to ch.monreleve.app.design.LightColors.warning,
        Zone.SOCIAL_SWITCH to ch.monreleve.app.design.LightColors.error,
    )

/**
 * Everything a badge needs. SPEC 6.2: "Every status carries icon + label +
 * one-line explanation, identical on web, Android, and PDF."
 * DESIGN-SYSTEM.md section 1: "STATUS IS NEVER COLOUR ALONE: colour + icon
 * + text, always."
 */
data class StatusPresentation(
    val icon: LucideIconName,
    val colour: androidx.compose.ui.graphics.Color,
    val softColour: androidx.compose.ui.graphics.Color,
    val label: String,
    val explanation: String,
)

/**
 * The visual mapping joined to the French copy - the only place the two
 * halves meet. Built by iterating Status.entries and looking each up in
 * STATUS_COPY by wireKey, so a Status added to one half and not the other
 * fails LOUDLY (an exception at first access) rather than rendering a
 * badge with no words - the runtime equivalent of the TS reference's
 * compile-time guarantee; see Zones.kt's header for why this file cannot
 * have the compile-time version.
 */
val STATUS_PRESENTATION: Map<Status, StatusPresentation> =
    Status.entries.associateWith { status ->
        val visual = STATUS_VISUAL.getValue(status)
        val copy =
            STATUS_COPY[status.wireKey]
                ?: error("no STATUS_COPY entry for Status.$status (wireKey '${status.wireKey}')")

        StatusPresentation(
            icon = visual.icon,
            colour = visual.colour,
            softColour = visual.softColour,
            label = copy.label,
            explanation = copy.explanation,
        )
    }
