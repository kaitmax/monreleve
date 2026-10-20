package ch.monreleve.app.account

import java.security.MessageDigest

// AN-FIX F4 (R303). The opaque, LOCAL-ONLY tag that scopes a recorded day to the account that
// recorded it - the device's half of the server's @@unique([userId, dayDate, portion]).
//
// WHY A HASH, NEVER THE ADDRESS. The only account identity the device can know is the email the
// magic-link callback carries (CallbackLink): GET /api/v1/me deliberately omits it
// (web/lib/me/read.ts - "the address is the fact /confidentialite promises not to make inferable"),
// and the refresh/access tokens are opaque and rotate. An email is a CREDENTIAL in this product's
// threat model (PendingSignInStore says so), and the Room database is NOT excluded from backup, so
// the raw address must never enter a row. accountTagOf returns a SHA-256 hex digest of the normalised
// address: opaque, non-reversible, and 256 bits wide, so a collision between two real people is not a
// practical concern. The digest is never sent on the wire (EntriesWire omits it); the server assigns
// tenancy from the token.
//
// FAIL CLOSED (R303). A row whose account cannot be resolved is UNOWNED, never a blank or shared
// default that two people could collapse into one. UNOWNED is excluded from BOTH sync and display, so
// an unresolved row is HELD - never sent, never shown - rather than mis-attributed. UNOWNED is seven
// uppercase letters and can never equal a 64-character lowercase-hex digest, so the sentinel cannot
// collide with a real account tag.

// KMP-2b (R394): UNOWNED_ACCOUNT MOVED TO :shared commonMain (account/UnownedAccount.kt) because
// EntryEntity.accountTag defaults to it and EntryEntity now lives there. SAME PACKAGE, so every
// existing import still resolves and nothing in :app changed. accountTagOf stays HERE: MessageDigest
// is a JVM API that commonMain cannot see, and dragging a digest across was never the point (R372).

private const val HEX_BYTE_MASK = 0xFF

/**
 * The stable, opaque tag for the account signed in with [email]. The address is normalised
 * (trimmed and lower-cased) before hashing, so the same account always produces the same tag, and a
 * blank address yields no tag (null) so the caller fails closed to UNOWNED rather than tagging a row
 * with the hash of the empty string.
 */
fun accountTagOf(email: String): String? {
    val normalised = email.trim().lowercase()
    if (normalised.isEmpty()) return null
    val digest = MessageDigest.getInstance("SHA-256").digest(normalised.toByteArray(Charsets.UTF_8))
    return digest.joinToString("") { "%02x".format(it.toInt() and HEX_BYTE_MASK) }
}
