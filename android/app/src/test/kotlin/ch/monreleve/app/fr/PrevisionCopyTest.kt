package ch.monreleve.app.fr

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

// AN-FORECAST (R154). A POSITIVE test of the forecast copy generators: a known input produces the known
// rendered string. R154 - a mechanism is proven to DELIVER, not merely to not fail: the domicile phrase,
// the method line and the hypotheses sentence are built by code, so each gets a known-output assertion.
// The design's own example (design/decide/README.md) is "domicile le mardi et le jeudi, 59 jours ouvres".

class PrevisionCopyTest : FunSpec({
    test("domicile phrase joins weekdays the French way") {
        PrevisionCopy.domicilePhrase(listOf(1, 3)) shouldBe "domicile le mardi et le jeudi"
        PrevisionCopy.domicilePhrase(listOf(0)) shouldBe "domicile le lundi"
        PrevisionCopy.domicilePhrase(listOf(0, 1, 4)) shouldBe "domicile le lundi, le mardi et le vendredi"
        PrevisionCopy.domicilePhrase(emptyList()) shouldBe "aucun jour à domicile"
    }

    test("method names the basis and the engine's own day count") {
        PrevisionCopy.method("SIMPLIFIED240", 240) shouldBe "méthode simplifiée (240 jours)"
        PrevisionCopy.method("EXACT", 228) shouldBe "méthode réelle (228 jours)"
    }

    test("assumptions renders the design's sentence from its parts") {
        PrevisionCopy.assumptions(
            rhythm = "domicile le mardi et le jeudi",
            workingDays = 59,
            method = "méthode simplifiée (240 jours)",
        ) shouldBe
            "Hypothèses : domicile le mardi et le jeudi, 59 jours ouvrés jusqu’au 31 décembre, " +
            "méthode simplifiée (240 jours). Les congés à venir ne sont pas déduits : " +
            "la projection prévient un peu tôt, jamais trop tard."
    }

    test("unrecorded-past agrees in number") {
        PrevisionCopy.unrecordedPast(1) shouldBe
            "1 journée ouvrée passée n’est pas encore enregistrée ; elle ne figure pas dans cette projection."
        PrevisionCopy.unrecordedPast(3) shouldBe
            "3 journées ouvrées passées ne sont pas encore enregistrées ; elles ne figurent pas dans cette projection."
    }

    test("tile labels carry the formatted threshold, never a typed figure") {
        PrevisionCopy.daysMarginBeforeFiscal("40 %") shouldBe "jours de marge avant 40 %"
        PrevisionCopy.daysBeforeSocial("49,9 %") shouldBe "jours avant 49,9 %"
        PrevisionCopy.daysOver("40 %") shouldBe "jours au-dessus de 40 %"
    }
})
