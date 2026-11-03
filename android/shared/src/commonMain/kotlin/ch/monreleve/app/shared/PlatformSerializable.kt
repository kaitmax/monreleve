package ch.monreleve.app.shared

// IOS-2a R768. WHAT LETS A RESTORE SEED CROSS AN ANDROID REBUILD, NAMED WITHOUT NAMING java.
//
// SignInSnapshot and CodeSnapshot (auth/) are the sign-in screens' state across a rotation, a text-size change and a
// background kill (AN-STATE, R310): MainActivity keeps them with rememberSaveable, which writes them into the
// activity's saved-state Bundle - and a Bundle takes them because they are java.io.Serializable. They moved to
// commonMain with their controllers, where java.* cannot be named, so the supertype is this expect interface:
//   ANDROID  actual typealias to java.io.Serializable - the SAME supertype, the same serialVersionUID, the same
//            bytes in the Bundle; nothing about the Android restore changes;
//   iOS      an empty marker interface - nothing on iOS serialises them; an iOS host restores state its own way.
expect interface PlatformSerializable
