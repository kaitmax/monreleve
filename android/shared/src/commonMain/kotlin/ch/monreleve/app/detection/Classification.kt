package ch.monreleve.app.detection

// IOS-1b-A R602: MOVED FROM :app to :shared commonMain (package unchanged), so the shared Aujourd'hui controller
// can read it on every platform. Platform-free as it stood.
// The rest of AN6a's Classification.kt (ClassifiedFix, classifyFix - where a coordinate exists and then does not)
// stays in :app beside BorderPolygon.

enum class Classification {
    INSIDE,
    OUTSIDE,
    BUFFER,
}
