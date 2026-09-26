package ch.monreleve.app.fr

// AN3 increment 2. Codepoint-exact verification of STATUS_COPY, matching
// this project's own R96-shaped discipline: a copy string is asserted by
// codepoint, never by how it looks in an editor.
//
// TWO REAL DEFECTS WERE FOUND WRITING THIS FILE, both by diffing this
// module's bytes against web/lib/fr/statuses.ts programmatically rather
// than trusting a visual read - which is exactly what caught them, since
// both differences are invisible in a normal editor:
//   1. "fiscal : le regime" / "depasse : votre" - the space before the
//      colon must be U+00A0 (French typography, ruling R91), and a first
//      draft had a plain U+0020 in both places.
//   2. "s'applique" - the apostrophe is U+2019 (the typographic elision
//      mark), and a first draft had the ASCII straight quote U+0027.
// Both are asserted here so a future edit cannot silently regress either
// one back to the plain character - the same class of guard R126
// describes on the web side, applied to this module directly rather than
// cited as a precedent.

import io.kotest.assertions.withClue
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

private val NBSP: Char = 0x00A0.toChar()
private val CURLY_APOSTROPHE: Char = 0x2019.toChar()

class StatusesTest : FunSpec({
    test("finds all four statuses, so the census is not vacuous") {
        STATUS_COPY.keys shouldBe setOf("compliant", "mission-exposure", "regime-lost", "social-switch")
    }

    context("compliant (ruling R41)") {
        test("the label is parallel to the other three - states what it is under, not merely 'within limits'") {
            STATUS_COPY.getValue("compliant").label shouldBe "Sous les deux seuils"
        }

        test("the explanation names the rule, never its value (R153's shape - no bare 40 or 49,9)") {
            val explanation = STATUS_COPY.getValue("compliant").explanation

            explanation shouldBe "Votre taux de télétravail déclarable reste sous le plafond fiscal."
            explanation.contains("40") shouldBe false
            explanation.contains("49") shouldBe false
        }
    }

    context("mission-exposure") {
        test("label and explanation") {
            STATUS_COPY.getValue("mission-exposure").label shouldBe "Missions exposées"
            STATUS_COPY.getValue("mission-exposure").explanation shouldBe
                "Une partie de vos jours de mission dépasse le plafond et reste imposable en France."
        }
    }

    context("regime-lost - the first NBSP-before-colon and curly-apostrophe case") {
        test("the label") {
            STATUS_COPY.getValue("regime-lost").label shouldBe "Régime non applicable"
        }

        test("the explanation, codepoint-exact") {
            val explanation = STATUS_COPY.getValue("regime-lost").explanation

            explanation shouldBe
                "Le télétravail seul dépasse le plafond fiscal$NBSP: le régime frontalier " +
                "ne s$CURLY_APOSTROPHE" + "applique plus."
        }

        test("the space before the colon is NBSP, not a plain space") {
            val explanation = STATUS_COPY.getValue("regime-lost").explanation
            val colonIndex = explanation.indexOf(':')

            explanation[colonIndex - 1].code shouldBe 0x00A0
            (explanation[colonIndex - 1].code == 0x0020) shouldBe false
        }

        test("the apostrophe in s'applique is the curly U+2019, not ASCII U+0027") {
            val explanation = STATUS_COPY.getValue("regime-lost").explanation
            val apostropheIndex = explanation.indexOf(CURLY_APOSTROPHE)

            (apostropheIndex >= 0) shouldBe true
            explanation.contains('\'') shouldBe false
        }
    }

    context("social-switch - the second NBSP-before-colon case") {
        test("the label") {
            STATUS_COPY.getValue("social-switch").label shouldBe "Bascule de sécurité sociale"
        }

        test("the explanation, codepoint-exact") {
            STATUS_COPY.getValue("social-switch").explanation shouldBe
                "Le seuil de sécurité sociale est dépassé$NBSP: votre affiliation peut basculer en France."
        }

        test("the space before the colon is NBSP, not a plain space") {
            val explanation = STATUS_COPY.getValue("social-switch").explanation
            val colonIndex = explanation.indexOf(':')

            explanation[colonIndex - 1].code shouldBe 0x00A0
            (explanation[colonIndex - 1].code == 0x0020) shouldBe false
        }
    }

    test("no explanation names a bare threshold - the copy names the rule, not its value") {
        for ((key, copy) in STATUS_COPY) {
            withClue(key) {
                Regex("""\b40\b|\b49[.,]9\b""").containsMatchIn(copy.explanation) shouldBe false
            }
        }
    }
})
