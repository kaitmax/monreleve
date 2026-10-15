package ch.monreleve.app.data.local

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import ch.monreleve.app.dossier.EntryKind as SharedEntryKind
import ch.monreleve.app.dossier.Portion as SharedPortion

// KMP-0 increment 6c (R372, R206). The boundary map (EntryAggregation.toShared) is a NAME IDENTITY between
// the Room/wire vocabulary (data.local.EntryKind/Portion) and the shared aggregation vocabulary
// (dossier.EntryKind/Portion). The exhaustive `when`s already make a NEW value on either side a compile
// error; this asserts the standing invariant the map rests on - that the two enums carry the SAME constant
// names, in the SAME order, in both directions - so a rename that slipped the compiler (same arity, different
// spelling) is a RED test rather than a silently wrong bucket. It is the twin of WireContractParityTest, one
// boundary over: that binds data.local to the web schema; this binds data.local to the shared engine input.

class EntryVocabularyBindingTest : FunSpec({
    test("EntryKind: the wire vocabulary and the shared vocabulary carry identical names, in order") {
        EntryKind.entries.map { it.name } shouldBe SharedEntryKind.entries.map { it.name }
    }

    test("Portion: identical names, in order") {
        Portion.entries.map { it.name } shouldBe SharedPortion.entries.map { it.name }
    }

    test("toShared maps every wire kind to the same-named shared kind") {
        EntryKind.entries.forEach { it.toShared().name shouldBe it.name }
    }

    test("toShared maps every wire portion to the same-named shared portion") {
        Portion.entries.forEach { it.toShared().name shouldBe it.name }
    }
})
