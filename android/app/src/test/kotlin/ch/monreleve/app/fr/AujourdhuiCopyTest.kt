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

    // AN-HOME section 1: the choice closes into the answer line. kindLabel is the kind ALONE (the sync status
    // line carries « Enregistré »), so there is no « Enregistré : » prefix; answerHalfDay shows BOTH halves.
    test("kindLabel returns the kind alone, with no Enregistré prefix") {
        AujourdhuiCopy.kindLabel("SUISSE", null) shouldBe "En Suisse"
        AujourdhuiCopy.kindLabel("DOMICILE", null) shouldBe "Domicile"
        AujourdhuiCopy.kindLabel("MISSION_FRANCE", null) shouldBe "Mission (France)"
        AujourdhuiCopy.kindLabel("MISSION_THIRD", null) shouldBe "Mission (pays tiers)"
    }

    test("kindLabel names the absence reason") {
        AujourdhuiCopy.kindLabel("ABSENCE", null) shouldBe "Absence"
        AujourdhuiCopy.kindLabel("ABSENCE", "CONGE") shouldBe "Absence — Congé"
    }

    // AN-ANSWER-ICON (R430): one entry PER HALF, where this used to assert the two joined by an em dash.
    // R292 is unchanged and still what is asserted - both halves, never one label - and no word moved: the
    // prefixes and the kind labels are the same constants. Only the joining went, because R430's glyph has
    // to sit beside the words of its own half and a single joined string has no side of the dash to belong
    // to. The halves render as two lines in the answer card instead.
    test("answerHalfDay gives BOTH halves, one entry each, never one label (R292)") {
        AujourdhuiCopy.answerHalfDay("Domicile", "En Suisse") shouldBe
            ("Matin : Domicile" to "Après-midi : En Suisse")
    }

    // AN-POLISH (R434): the per-half answer line and the two-half answer must word the prefix IDENTICALLY,
    // because they are the same sentence seen in two card states. Asserting that halfLabel is what
    // answerHalfDay is built from is the one check that cannot pass while the two have drifted (R206).
    test("halfLabel is the one home both the per-half line and the two-half answer are built from") {
        AujourdhuiCopy.halfLabel(AujourdhuiCopy.MORNING, "Domicile") shouldBe "Matin : Domicile"
        AujourdhuiCopy.answerHalfDay("Domicile", "En Suisse") shouldBe
            (
                AujourdhuiCopy.halfLabel(AujourdhuiCopy.MORNING, "Domicile") to
                    AujourdhuiCopy.halfLabel(AujourdhuiCopy.AFTERNOON, "En Suisse")
            )
    }

    // AN-POLISH (R434): the announcement names BOTH halves - the one recorded and the one still to fill in -
    // and reads correctly in either order, because either half can be answered first.
    test("the half-day announcement names the half recorded and the half that remains, either way round") {
        AujourdhuiCopy.halfRecordedAnnouncement(AujourdhuiCopy.MORNING, AujourdhuiCopy.AFTERNOON) shouldBe
            "Matin enregistré. Après-midi : à renseigner."
        AujourdhuiCopy.halfRecordedAnnouncement(AujourdhuiCopy.AFTERNOON, AujourdhuiCopy.MORNING) shouldBe
            "Après-midi enregistré. Matin : à renseigner."
    }

    test("the sync truth is persistent copy, pending distinct from synced (AN-HOME section 1)") {
        AujourdhuiCopy.PENDING shouldBe "Enregistré sur le téléphone, en attente d’envoi"
        AujourdhuiCopy.SYNCED shouldBe "Enregistré"
    }
})
