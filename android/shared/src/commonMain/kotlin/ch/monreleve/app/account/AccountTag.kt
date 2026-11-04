package ch.monreleve.app.account

// AN-FIX F4 (R303). The opaque, LOCAL-ONLY tag that scopes a recorded day to the account that recorded it. The whole
// reasoning - why a hash and never the address, why a blank address fails closed to no tag - is carried with the
// Android implementation (androidMain AccountTag.android.kt), which is the body that has always run.
//
// IOS-2a R768: THE DECLARATION IS COMMON BECAUSE THE SIGN-IN CONTROLLERS THAT CALL IT ARE. Each platform computes the
// SAME digest with its own library - Android java.security.MessageDigest, iOS CommonCrypto (both in the platform, no
// dependency) - and SignInStatePinTest, in commonTest, pins both to one SHA-256 vector computed outside this code.

/**
 * The SHA-256 hex digest (64 lowercase hex characters) of [email] trimmed and lower-cased, or null for a blank
 * address - so a caller fails closed to UNOWNED rather than tagging a row with the hash of the empty string.
 */
expect fun accountTagOf(email: String): String?
