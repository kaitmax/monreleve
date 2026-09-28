package ch.monreleve.app.detection

import android.content.Context

// AN6a increment 5. Loads the bundled polygon from the APK's assets on a device. Kept out of
// BorderPolygon itself so that class stays a pure, JVM-testable value; this is the one line
// that needs a Context.

fun loadBundledBorder(context: Context): BorderPolygon =
    context.assets.open("border/switzerland.json").bufferedReader().use { BorderPolygon.fromGeoJson(it.readText()) }
