package ch.monreleve.app.auth

// AN4 increment 2. The seam between the session logic and at-rest storage. The
// session manager (increment 5) depends on this interface, so its logic is
// JVM-testable against a fake, while the real Keystore-backed implementation
// (KeystoreTokenStore) needs a device and is exercised by an instrumented test.

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
