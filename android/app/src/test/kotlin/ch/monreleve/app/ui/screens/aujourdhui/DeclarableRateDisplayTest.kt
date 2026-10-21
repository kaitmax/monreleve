package ch.monreleve.app.ui.screens.aujourdhui

import ch.monreleve.app.calc.declarableRateFor
import ch.monreleve.app.fr.format.formatDeclarableRate
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// AN-CALENDAR (R479). ONE RATE, ONE STRING. The screen-level proof - one record through both controllers onto both
// screens, RED on main on the S9 - is RateOneStringInstrumentedTest. These pin its two pieces on the JVM, where the
// gate runs them: the one formatting every screen uses, and the hand-over that lets Aujourd'hui use it on the
// engine's own figure rather than on a Float copy.
//
// The figures are the engine's, through declarableRateFor (DeclarableRate.kt - the one truncation, SPEC 7.3). The
// literals are the assertion itself (R171): 39,16 % is Geneva's published worked example (fixtures), and 1/240 is
// the record whose third decimal (0,416...) is 5 or more, where a rounding screen would say 0,42.

private const val NBSP = ' '

private fun engine(days: Int): Double = declarableRateFor(days.toDouble(), 240)

class DeclarableRateDisplayTest : FunSpec({
    test("R479 the one formatting states the engine's figure: 1/240, 2/240 and Geneva's 94/240") {
        formatDeclarableRate(engine(1)) shouldBe "0,41$NBSP%"
        formatDeclarableRate(engine(2)) shouldBe "0,83$NBSP%"
        formatDeclarableRate(engine(94)) shouldBe "39,16$NBSP%"
    }

    test("R479 a Float copy of the same figure states a hundredth less - the hazard the hand-over exists to avoid") {
        // KMP-4's fingerprints exactly: Aujourd'hui read these where the forecast read the line above.
        formatDeclarableRate(engine(1).toFloat().toDouble()) shouldBe "0,40$NBSP%"
        formatDeclarableRate(engine(2).toFloat().toDouble()) shouldBe "0,82$NBSP%"
        formatDeclarableRate(engine(94).toFloat().toDouble()) shouldBe "39,15$NBSP%"
    }

    test("R479 at rest Aujourd'hui hands over the engine's Double itself, so it states what the forecast states") {
        for (days in listOf(1, 2, 94)) {
            val figure = engine(days)
            // At rest, animateFloatAsState stands on the engine's value converted to a Float.
            shownRate(figure.toFloat(), figure) shouldBe figure
            formatDeclarableRate(shownRate(figure.toFloat(), figure)) shouldBe formatDeclarableRate(figure)
        }
    }

    test("R479 between two figures the frame shows the animation's own value, for the moment it is on screen") {
        shownRate(0.5f, engine(2)) shouldBe 0.5
    }
})
