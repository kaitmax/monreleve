package ch.monreleve.app.shared

// IOS-2a R768: nothing on iOS serialises the restore seeds, so the supertype is an empty marker
// (see PlatformSerializable.kt).
actual interface PlatformSerializable
