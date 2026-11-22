package ch.monreleve.app.design

import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.SemanticsPropertyReceiver

// IOS-SHELL-1 (R1326, iOS Ruling 11 Q3). THE BOTTOM BAR'S GLYPH, READABLE BY A TEST - kindIconRes's shape
// (KindIconSemantics.kt), one component over. The bar's icons carry NO contentDescription (the visible label names the
// destination, so the icon is decorative - AppBottomBar.kt), so a Compose UI test had nothing to read them by, and the
// render proof iOS Ruling 11 Q3 asks for - "the four glyphs resolve" - could only have asserted that SOMETHING was
// drawn.
// This carries glyphSemanticsId(glyph): Android's R.drawable id, iOS's Glyph ordinal. The id is the claim, as there.
//
// IT IS NOT AN ACCESSIBILITY ANNOUNCEMENT: a custom SemanticsPropertyKey is read by tests, never by TalkBack or
// VoiceOver, so the icon stays decorative beside its label. It lives in design/ for kindIconRes's reason (a key is
// constructed with its name as a String literal, which the ui/ fence forbids). It draws nothing: no pixel moves.

/** The glyph a bottom-bar item's icon was drawn from (glyphSemanticsId). Read by tests, never announced. */
val navIconResKey = SemanticsPropertyKey<Int>("NavIconRes")

/** Write the bar icon's glyph id onto a node: `Modifier.semantics { navIconRes = glyphSemanticsId(Glyph.SUN) }`. */
var SemanticsPropertyReceiver.navIconRes by navIconResKey
