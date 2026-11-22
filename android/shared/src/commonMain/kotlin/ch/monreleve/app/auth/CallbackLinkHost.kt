package ch.monreleve.app.auth

// IOS-MOVE-CORE R1300. THE FROZEN APP LINK HOST (R195), SPLIT FROM THE java.net PARSER. CallbackLink - the parser, on
// java.net - stays in :app, and its HOST is this constant; parametres/Site (commonMain) derives the website's origin
// from it. So the callback's validation and the public pages still read ONE value and cannot drift onto two domains
// (R206), and the origin no longer has to live in :app beside the parser.

/** The host of the sign-in callback link and of the website: one domain (R195). */
object CallbackLinkHost {
    const val HOST = "monreleve.ch"
}
