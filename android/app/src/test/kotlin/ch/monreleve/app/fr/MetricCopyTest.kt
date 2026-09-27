package ch.monreleve.app.fr

// AN3 increment 6. MetricCopy had no test at all before this - it was a
// genuine live orphan (no surface called it) until this task's gallery
// wired it in, and the gallery's own walkthrough screenshot is what
// found a defect here: RED first, confirmed against the code as it
// stood, then fixed - twice, in fact.
//
// THE FIRST FIX WAS THE WRONG ONE, found by reading the web reference
// rather than assumed correct because the test went green: this file's
// own first version taught `over()` to elide "de le" into "du", because
// the gallery had called `over("le plafond fiscal")`. web/lib/fr/metrics.ts
// says plainly that `threshold` "is an already-formatted percentage - the
// output of formatPercent" and warns against passing anything else. The
// REAL defect was the call site, not the function; this test asserts the
// contract the web source actually documents.

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

class MetricCopyTest : FunSpec({
    test("remaining names the threshold as a formatted percentage (SPEC 9.3)") {
        MetricCopy.remaining("40 %") shouldBe "Jours restants avant 40 %"
        MetricCopy.remaining("49,9 %") shouldBe "Jours restants avant 49,9 %"
    }

    test("over names the threshold as a formatted percentage - no elision, because it never sees an article") {
        MetricCopy.over("40 %") shouldBe "Jours au-dessus de 40 %"
        MetricCopy.over("49,9 %") shouldBe "Jours au-dessus de 49,9 %"
    }
})
