package ch.monreleve.app.design

// IOS-1b-A R603: MOVED FROM :app to :shared commonMain (package unchanged) - the design system the shared Aujourd'hui
// screen draws with, one definition for both platforms.

import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.SemanticsPropertyReceiver

// AN-ANSWER-ICON (R433). The answer line's kind glyph carries NO contentDescription - the words beside it say
// the same thing and TalkBack must read the day once, not twice (R430) - so a Compose UI test has nothing to
// match it by. This semantics property carries the DRAWABLE RESOURCE ID, which is exactly what R433 asks a
// test to assert: "the right drawable (assert by resource or test tag, not by pixels)".
//
// A RESOURCE ID RATHER THAN A TAG NAMING THE KIND, deliberately. A tag like "kind-icon-SUISSE" asserts that
// SOMETHING was drawn where the Suisse icon belongs; it passes just as happily when the wrong glyph is drawn,
// which is the one mistake this is here to catch. The id is the claim.
//
// IT LIVES IN design/ AND NOT IN ui/ because a SemanticsPropertyKey is constructed with its name as a String
// literal, which FencesTest's fence 4 forbids anywhere under ui/. design/ is not scanned by that fence, and a
// semantics contract for an icon belongs to the design layer in any case.
//
// IT IS NOT AN ACCESSIBILITY ANNOUNCEMENT AND MUST NOT BECOME ONE. A custom SemanticsPropertyKey is not read
// by TalkBack; only contentDescription, text and the standard properties are. Writing this on the glyph
// therefore leaves R430's "the icon is decorative next to its words" exactly true.

/** The drawable resource the answer line's kind glyph was drawn from. Read by tests, never by TalkBack. */
val kindIconResKey = SemanticsPropertyKey<Int>("KindIconRes")

/** Write the glyph's drawable resource onto a node: `Modifier.semantics { kindIconRes = R.drawable.ic_house }`. */
var SemanticsPropertyReceiver.kindIconRes by kindIconResKey
