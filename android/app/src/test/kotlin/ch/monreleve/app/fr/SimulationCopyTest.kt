package ch.monreleve.app.fr

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// AN-SIM (R154, R181). A POSITIVE test of the simulator's one copy generator: a known input produces the known
// rendered string. The consequence sentence interpolates an already-formatted threshold (R181 - the "40 %" is
// never typed, it is formatPercent of the RuleSet fiscal ceiling), so the figure stays true when the ceiling
// moves. The source is stated separately, as the design draws it.

class SimulationCopyTest : FunSpec({
    test("the fiscal consequence interpolates the formatted threshold, never a typed figure") {
        SimulationCopy.consequenceFiscal("40 %") shouldBe
            "Au-delà de 40 %, vos jours de télétravail deviennent imposables en France."
    }

    test("the source names the instrument, stated apart from the consequence") {
        SimulationCopy.CONSEQUENCE_SOURCE shouldBe "Source : AFC Genève."
    }
})
