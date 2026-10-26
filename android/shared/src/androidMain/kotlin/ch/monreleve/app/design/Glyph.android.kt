package ch.monreleve.app.design

import android.annotation.SuppressLint
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource

// IOS-1b-A R603. ANDROID'S GLYPHS ARE THE APP'S OWN DRAWABLES, FOUND BY NAME (see Glyph.kt for why they did not move).
//
// :shared cannot import :app's R, so the id is looked up by the derived file name in the running app's resources -
// the very resource, and the very Int, the screen used before it moved: painterResource(id) renders identically and
// the instrumented tests' R.drawable assertions see the same value. Measured before it was built: under Paparazzi
// 1.3.5, getIdentifier("ic_house", "drawable", packageName) returned 2131034129 = R.drawable.ic_house.
//
// A NAME THAT DOES NOT RESOLVE FAILS LOUDLY (getIdentifier returns 0, check() throws) - never a blank glyph.
// R8's resource shrinker cannot see a name built at run time, so app/src/main/res/raw/glyph_keep.xml keeps the
// ten files by name.

@SuppressLint("DiscouragedApi") // by name on purpose: :shared cannot see :app's R (Glyph.kt).
@Composable
actual fun glyphSemanticsId(glyph: Glyph): Int {
    val context = LocalContext.current
    return remember(glyph, context) {
        val id = context.resources.getIdentifier(glyph.fileName, "drawable", context.packageName)
        check(id != 0) { "no drawable named ${glyph.fileName} in ${context.packageName}" }
        id
    }
}

@Composable
actual fun glyphPainter(glyph: Glyph): Painter = painterResource(glyphSemanticsId(glyph))
