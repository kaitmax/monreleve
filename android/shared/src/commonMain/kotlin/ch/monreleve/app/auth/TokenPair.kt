package ch.monreleve.app.auth

// AN4 increment 2. The opaque token pair the callback issues and refresh rotates.
// The two tokens are the credentials; the two expiries are not (they are ISO
// instants the server assigns, useful in a log). SPEC 10 / docs/api-v1.md 1.1.
//
// LOG FENCE, class level. A data class's GENERATED toString() prints every field,
// so a stray Log.d(TAG, "$pair") - or a crash reporter serialising it - would put
// both tokens in a log line. toString() is overridden to redact the tokens; a
// runtime test (TokenPairTest) asserts the values never appear in it, and the
// source scanner (LogFenceTest) forbids logging a credential in the first place.
// The two defences are deliberate: the scanner stops the obvious leak, the
// override stops the one that goes through a generic serialiser nobody wrote.

data class TokenPair(
    val accessToken: String,
    val refreshToken: String,
    val accessExpiresAt: String,
    val refreshExpiresAt: String,
) {
    override fun toString(): String =
        "TokenPair(accessToken=<redacted>, refreshToken=<redacted>, " +
            "accessExpiresAt=$accessExpiresAt, refreshExpiresAt=$refreshExpiresAt)"
}
