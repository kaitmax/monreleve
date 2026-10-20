package ch.monreleve.app.design

import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.SemanticsPropertyReceiver

// AN-POLISH (R435). The answer line's SYNC-STATUS glyph carries no contentDescription - the words beside it
// say the same thing - so a Compose UI test has nothing to match it by. This semantics property carries the
// DRAWABLE RESOURCE ID, exactly as design/KindIconSemantics.kt does for the KIND glyph.
//
// IT IS A SECOND KEY AND NOT A REUSE OF kindIconRes, DELIBERATELY. The two glyphs sit on different rows and
// mean different things - what the day WAS, and whether the server HAS it. One key for both would let a test
// asserting "the pending clock is on screen" pass while the clock was drawn where the kind belongs, which is
// the one confusion R432 says the two must never fall into. A shared key cannot tell those apart; two keys
// cannot be made to.
//
// IT IS NOT AN ACCESSIBILITY ANNOUNCEMENT AND MUST NOT BECOME ONE. A custom SemanticsPropertyKey is not read
// by TalkBack; only contentDescription, text and the standard properties are. Writing this on the glyph
// leaves "the icon is decorative next to its words" exactly true.
//
// IT LIVES IN design/ for KindIconSemantics.kt's reason: a SemanticsPropertyKey is constructed with its name
// as a String literal, which FencesTest's fence 4 forbids anywhere under ui/.

/** The drawable resource the answer line's sync-status glyph was drawn from. Read by tests, never by TalkBack. */
val statusIconResKey = SemanticsPropertyKey<Int>("StatusIconRes")

/** Write the glyph's drawable resource onto a node: `Modifier.semantics { statusIconRes = R.drawable.ic_clock }`. */
var SemanticsPropertyReceiver.statusIconRes by statusIconResKey
