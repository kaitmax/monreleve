package ch.monreleve.app.data.remote

// AN4 increment 1. The auth error codes this client branches on, transcribed
// from the FROZEN contract (docs/api-v1.md 1.4, web/lib/auth/bearer.ts
// AUTH_CODES). R195: the client consumes the contract exactly, so these wire
// strings are the server's, never reworded. The client branches on the CODE,
// never on the French message (contract 1.4 / 6.5), which is why the message is
// not modelled here at all.
//
// R198 - the mapping preserves WHICH rule fired. Each code carries its own
// ClientAction, transcribed from the contract's "what the client does" column;
// two codes that share an action (expiry and rotation both refresh) still keep
// distinct identities, so a surface can render distinct copy per code
// (increment 5 renders revoked_session differently from an ordinary expiry, R210)
// while the state machine acts on the action.

/** What the client does when a server code comes back, from docs/api-v1.md 1.4. */
enum class ClientAction {
    /** expired_token, rotated_token: refresh silently and retry; the person sees nothing. */
    REFRESH,

    /** unknown_token, revoked_session, invalid_link, invalid_refresh_token: sign in again. */
    SIGN_IN,

    /** missing_token, malformed_authorization, malformed_body: a defect in this client. */
    CLIENT_BUG,
}

/** The stable ASCII codes the auth routes return. Never translated, reworded or reordered. */
enum class AuthServerCode(val wire: String, val action: ClientAction) {
    MISSING_TOKEN("missing_token", ClientAction.CLIENT_BUG),
    MALFORMED_AUTHORIZATION("malformed_authorization", ClientAction.CLIENT_BUG),
    UNKNOWN_TOKEN("unknown_token", ClientAction.SIGN_IN),
    EXPIRED_TOKEN("expired_token", ClientAction.REFRESH),
    ROTATED_TOKEN("rotated_token", ClientAction.REFRESH),
    REVOKED_SESSION("revoked_session", ClientAction.SIGN_IN),
    INVALID_LINK("invalid_link", ClientAction.SIGN_IN),
    INVALID_REFRESH_TOKEN("invalid_refresh_token", ClientAction.SIGN_IN),
    MALFORMED_BODY("malformed_body", ClientAction.CLIENT_BUG),
    ;

    companion object {
        /**
         * The code for a wire string, or null when it is one this build does not
         * know. Null is deliberate and load-bearing (contract 6.5): an unrecognised
         * code is TERMINAL, never guessed into a known one - a client that mapped a
         * future code onto an existing action would act wrongly on it.
         */
        fun fromWire(wire: String?): AuthServerCode? = entries.firstOrNull { it.wire == wire }
    }
}
