package ch.monreleve.app.account

// KMP-2b (R394/R368/R206). THE UNOWNED SENTINEL, AND ONLY THE SENTINEL, LIVES IN :shared.
//
// EntryEntity.accountTag defaults to UNOWNED_ACCOUNT and EntryEntity moved to commonMain, so the
// constant had to move with it. accountTagOf did NOT move and must not: it hashes with
// java.security.MessageDigest, which commonMain cannot see. Splitting the file is the smallest move
// that lets the entity compile for iOS without dragging a JVM digest across (R372's shape).
//
// THE PACKAGE DOES NOT CHANGE (R368): this is still ch.monreleve.app.account, so every existing
// `import ch.monreleve.app.account.UNOWNED_ACCOUNT` in :app resolves exactly as it did, and the
// remaining half of the file keeps its own name. The FILE is named UnownedAccount.kt rather than
// AccountTag.kt deliberately: two files with the same name in the same package across two modules
// would compile to the same JVM facade class (AccountTagKt) and collide on :app's runtime classpath.
//
// WHAT IT IS, carried verbatim from AccountTag.kt because the reasoning is the value:
// FAIL CLOSED (R303). A row whose account cannot be resolved is UNOWNED, never a blank or shared
// default that two people could collapse into one. UNOWNED is excluded from BOTH sync and display, so
// an unresolved row is HELD - never sent, never shown - rather than mis-attributed. UNOWNED is seven
// uppercase letters and can never equal a 64-character lowercase-hex digest, so the sentinel cannot
// collide with a real account tag.

const val UNOWNED_ACCOUNT = "UNOWNED"
