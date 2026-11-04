package ch.monreleve.app.auth

import android.content.Context

// AN4 increment 4. The address a sign-in link was requested FOR on this device.
// It is the login-CSRF defence: a co-installed app can fire the exported callback
// activity with a VALID link for an account the user never asked to sign into, and
// binding the exchange to the address the app itself last requested closes that -
// a callback whose email does not match the pending request is refused (R195's
// "never act on extras an external app could supply", applied to the whole flow).
//
// An interface so CallbackController and SignInController are JVM-testable against
// a fake; the SharedPreferences implementation needs a device. Persisted (not
// in-memory) so it survives the process death between requesting the link and the
// App Link re-opening the app. Excluded from backup alongside the token store -
// an email is a credential in this product's threat model (the log fence lists it).
//
// IOS-2a R768: the PendingSignInStore CONTRACT moved to :shared commonMain (auth/PendingSignInStore.kt there), with
// the controllers that read it. This file keeps the Android implementation and its keys, renamed after its class
// (was auth/PendingSignInStore.kt; OnDeviceFormatGoldenTest reads the keys here).

private const val PENDING_PREFS = "monreleve.pending"
private const val PENDING_EMAIL = "email"

class SharedPrefsPendingSignInStore(context: Context) : PendingSignInStore {
    private val prefs = context.applicationContext.getSharedPreferences(PENDING_PREFS, Context.MODE_PRIVATE)

    override fun remember(email: String) {
        prefs.edit().putString(PENDING_EMAIL, email.trim().lowercase()).commit()
    }

    override fun pending(): String? = prefs.getString(PENDING_EMAIL, null)

    override fun clear() {
        prefs.edit().remove(PENDING_EMAIL).commit()
    }
}
