package ch.monreleve.app.fr

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain

// AN5c increment 3 (R286/R154). The pending line's escalation is a substitution - the threshold is
// interpolated, not typed (R153/R181) - so it gets a POSITIVE delivery test: a known input produces the
// known rendered string. The escalation is the last element of a scrolling screen, so it falls below
// the fold of a fixed-viewport baseline; this asserts the text the on-device walkthrough scrolls to see.

class AujourdhuiCopyTest : FunSpec({
    test("NONE renders only the plain unsynced count, unchanged from before R286") {
        AujourdhuiCopy.pendingNote(3, "NONE", 7) shouldBe "dont 3 jours pas encore synchronisés"
    }

    test("a single unsynced day is singular") {
        AujourdhuiCopy.pendingNote(1, "NONE", 7) shouldBe "dont 1 jour pas encore synchronisé"
    }

    test("APPROACHING keeps the count and adds the threshold, interpolated not typed (R153)") {
        val note = AujourdhuiCopy.pendingNote(3, "APPROACHING", 7)
        note shouldContain "dont 3 jours pas encore synchronisés"
        note shouldContain "seuil de saisie tardive (7 jours)"
    }

    test("APPROACHING interpolates whatever threshold it is given, proving it is not a typed 7") {
        AujourdhuiCopy.pendingNote(3, "APPROACHING", 9) shouldContain "(9 jours)"
    }

    test("OVERDUE predicts the flag on sync (R216), never asserts the record is already late") {
        val note = AujourdhuiCopy.pendingNote(3, "OVERDUE", 7)
        note shouldContain "dépasse 7 jours"
        note shouldContain "sera signalée comme saisie tardive dès sa synchronisation"
    }
})
