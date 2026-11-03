package ch.monreleve.app.shared

// IOS-2a R768: on Android the restore seeds are exactly what they were - java.io.Serializable
// (see PlatformSerializable.kt).
actual typealias PlatformSerializable = java.io.Serializable
