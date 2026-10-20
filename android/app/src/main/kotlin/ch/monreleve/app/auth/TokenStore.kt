package ch.monreleve.app.auth

// AN4 increment 2. The seam between the session logic and at-rest storage. The
// session manager (increment 5) depends on this interface, so its logic is
// JVM-testable against a fake, while the real Keystore-backed implementation
// (KeystoreTokenStore) needs a device and is exercised by an instrumented test.
//
// KMP-3 (R447). THE KDOC BELOW IS A SPECIFICATION, NOT A DESCRIPTION, because an iOS
// implementation will be written from this text and nothing else. Anything a Keychain
// implementer would otherwise have to infer by reading KeystoreTokenStore.kt - which they
// cannot, because it is Android - is stated here instead.

/**
 * Where this device keeps the signed-in session's token pair, encrypted at rest.
 *
 * ## What an implementation must guarantee
 *
 * **One pair, or none.** There is no key, no list and no versioning: the store holds at
 * most one [TokenPair], and [save] replaces whatever was there. Two sessions on one device
 * is not a state this product has.
 *
 * **[save] is durable and whole before it returns.** A process killed on the next
 * instruction must still find that pair on the next launch, and a reader must never
 * observe half of it: the old refresh token beside a new access token would make the next
 * refresh a REPLAY, and a replay ends the whole session (R210). So the pair is written as
 * ONE value - on Android a single `commit()`, on iOS a single Keychain item holding the
 * encoded pair, never four items written in sequence.
 *
 * **[load] before any [save] returns null.** A fresh install has no session. Null means
 * "sign in", and it is the only thing that does.
 *
 * **[load] returns null rather than throwing, and clears the store when it does.** A pair
 * that cannot be read - an invalidated key, a corrupted blob, an encoding that no longer
 * parses - is not an error the caller can act on: there is no usable session, and the only
 * useful answer is the one a fresh install gives. Dropping it is what stops the app
 * looping on a session it can neither use nor replace. It is the device's mirror of the
 * server's `unknown_token` "corrupted stored token" case.
 *
 * **[clear] erases the pair and nothing else.** Not the settings, not the record, not the
 * cached releve, not the account tag - those belong to the device's LocalStore, which
 * clears them alongside this one on sign-out (R295). [clear] on an empty store is a no-op
 * and must not throw: it is called on the recovery path above, where there may be nothing
 * to remove.
 *
 * **[clear] must not need the network, a session, or the user present.** It runs inside
 * `withContext(NonCancellable)` at the end of sign-out, after a revoke that may have
 * failed or been cancelled. Signing out is a promise about the DEVICE, and that half must
 * not depend on anything else being reachable.
 *
 * ## What an implementation must never do
 *
 * It must not log, print or copy the tokens anywhere a backup or a crash report could
 * reach: on Android the backing preferences file is excluded from backup by the manifest
 * rules, and an iOS implementation owes the equivalent decision rather than inheriting a
 * default.
 *
 * It must not require the device to be unlocked. Silent refresh runs while the phone is
 * locked, so whatever protects the bytes must not be gated on a user-presence check.
 */
interface TokenStore {
    /** Persist the pair, encrypted at rest. Overwrites any existing pair. */
    fun save(pair: TokenPair)

    /**
     * The stored pair, or null when there is none OR when the stored bytes can no
     * longer be read (an invalidated Keystore key, a corrupted blob). A read that
     * cannot be trusted returns null AND clears the store, so the caller lands on
     * sign-in rather than looping on an unreadable session - the local mirror of
     * the server's `unknown_token` "corrupted stored token" case.
     */
    fun load(): TokenPair?

    /** Remove the stored pair. Signing out, and the recovery path above. */
    fun clear()
}
