package ch.monreleve.app.auth

// IOS-2a R770. ANDROID'S LINK RECEIPT, FEEDING THE SHARED CALLBACK CONTROLLER.
//
// CallbackController moved to :shared commonMain; the URI it used to parse did not (java.net, and R600 keeps the
// receipt native). This extension is the old entry point, same name and same argument, so CallbackActivity and
// CallbackControllerTest call exactly what they called before: CallbackLink.parse validates the URI (unchanged), and
// the result crosses the R770 contract (SignInLink.kt in :shared) - the token and address, or null for MALFORMED.
// The order is the old order: the URI is parsed first, then the controller reads the pending address.

/** Validate an incoming App Link URI and hand the shared controller what it carried (R770). */
fun CallbackController.handle(uriString: String?) {
    handleLink(CallbackLink.parse(uriString)?.let { SignInLink(token = it.token, email = it.email) })
}
