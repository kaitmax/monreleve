package ch.monreleve.app.auth

// IOS-2a R770. THE CONTRACT BETWEEN A PLATFORM'S LINK RECEIPT AND THE SHARED SIGN-IN - written down for IOS-1b-B,
// whose universal-link receipt will feed it.
//
// The sign-in link's RECEIPT stays native (R600, R766): on Android, the exported App Link activity and
// CallbackLink.parse (java.net.URI / URLDecoder) in :app; on iOS, the universal-link entry point IOS-1b-B adds. What a
// receipt hands the shared CallbackController is this - or null - and nothing else:
//
//   SignInLink(token, email) - ONLY for a URI that is, exactly, the frozen callback shape: scheme https and host
//       monreleve.ch (both compared ignoring case), path exactly /api/v1/auth/callback, and a non-blank `token` and a
//       non-blank `email` query parameter, each decoded as java.net.URLDecoder does it on Android (UTF-8 percent
//       escapes, and '+' read as a space - an iOS receipt must decode the same way, or a "+" in an address breaks
//       the MISMATCH comparison). The receipt validates; this type does not re-check, and it carries no host,
//       scheme or path, because the exchange never uses one taken from the link - it goes to the app's OWN
//       configured base URL (AuthApi), whatever the link said.
//   null - anything else: another host, scheme or path, a missing or blank parameter, an unparseable URI, no URI.
//       CallbackController answers MALFORMED and makes no request.
//
// The address is passed as received: CallbackController compares it with the pending address trimmed and
// lower-cased (MISMATCH, the login-CSRF defence), and the account tag is derived from it at SIGNED.
data class SignInLink(
    val token: String,
    val email: String,
)
