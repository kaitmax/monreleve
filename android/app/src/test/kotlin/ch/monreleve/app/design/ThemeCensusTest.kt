package ch.monreleve.app.design

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.Typography
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.reflect.full.memberProperties

/**
 * FrontierTheme's KDoc claims every ColorScheme and Typography slot is a
 * token, never a Material default (D37). A claim like that is R154's shape -
 * proven to deliver, not proven not to fail - so this asserts it on EVERY
 * slot Material3 defines, not just the ones a call site happens to read.
 *
 * kotlin-reflect is a test-only dependency here (androidx Typography and
 * ColorScheme are library data classes with generated equals/component
 * methods that Java reflection cannot enumerate cleanly the way it does the
 * project's own Radius, which uses a plain Map for exactly that reason).
 */
class ThemeCensusTest {
    private val nineStyles =
        setOf(
            FrontierType.display,
            FrontierType.display.tabularNums(),
            FrontierType.h1,
            FrontierType.h2,
            FrontierType.h3,
            FrontierType.bodyL,
            FrontierType.body,
            FrontierType.bodyM,
            FrontierType.caption,
            FrontierType.micro,
        )

    @Test
    fun everyTypographySlotIsOneOfTheNineDocumentedStyles() {
        val slots = Typography::class.memberProperties.filter { it.returnType.classifier == TextStyle::class }

        assertTrue("expected 15 Typography slots, found ${slots.size}", slots.size == 15)

        for (slot in slots) {
            val value = slot.get(FrontierTypography) as TextStyle

            assertTrue(
                "Typography.${slot.name} = $value is not one of the nine documented " +
                    "styles (DESIGN-SYSTEM.md section 1) - it falls back to a Material " +
                    "default, or invents an untracked tenth size.",
                nineStyles.contains(value),
            )
        }
    }

    /**
     * Every colour frontierColorScheme() is allowed to use: LightColors'
     * fields, plus Color.Transparent (surfaceTint's explicit "no tint").
     * Built by reflecting LightColors rather than hand-copied, so a new token
     * added there is automatically an allowed value here - the closed set is
     * the SOURCE, never a second list that can drift from it.
     */
    private val allowedColors: Set<Color> =
        LightColors::class.memberProperties
            .filter { it.returnType.classifier == Color::class }
            .map { it.get(LightColors) as Color }
            .toSet() + Color.Transparent

    @Test
    fun everyColorSchemeSlotIsSourcedFromTheTokenLayer() {
        val frontier = frontierColorScheme()
        // Restricted to Color-typed members. ColorScheme also exposes internal,
        // nullable *Cached fields (defaultAssistChipColorsCached and siblings) -
        // memoised colours for OTHER components (AssistChip, TextField, ...),
        // null on both sides until one is actually composed. They are
        // implementation detail, not a design-token slot - found on this
        // test's first RED run, not assumed in advance.
        //
        // MEMBERSHIP, NOT "differs from Material's baseline": onError = white
        // is correct (standard white-on-error text) AND happens to equal
        // Material's own baseline pick - a coincidence, not a leak. Proving
        // every slot comes FROM LightColors is the positive signal D37 asks
        // for; "differs from an arbitrary Material value" both under- and
        // over-claims.
        val slots = ColorScheme::class.memberProperties.filter { it.returnType.classifier == Color::class }

        assertTrue("expected at least 30 Color-typed ColorScheme slots, found ${slots.size}", slots.size >= 30)

        for (slot in slots) {
            val value = slot.get(frontier) as Color

            assertTrue(
                "ColorScheme.${slot.name} = $value is not one of LightColors' " +
                    "values (or Color.Transparent) - it is either a Material " +
                    "default nothing overrode, or an untracked colour invented " +
                    "outside the token layer.",
                allowedColors.contains(value),
            )
        }
    }
}
