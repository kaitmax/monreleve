package ch.monreleve.app.settings

// AN5b increment 1. The device's cache of the person's settings, so Aujourd'hui computes offline
// from the first launch (the settings were also PATCHed to /api/v1/me at onboarding). An interface
// so OnboardingController is JVM-testable against a fake; the SharedPreferences implementation needs
// a device.
//
// NO COORDINATE, NO CREDENTIAL - just the six calculation settings. Persisted (not in-memory) so a
// signed-in user reopening the app lands on a computable Aujourd'hui without a network round trip.
//
// KMP-3 (R446): the CONTRACT moved to :shared commonMain; the SharedPreferences implementation
// stayed, as :app/settings/SharedPrefsSettingsStore.kt. Package unchanged (R368), so no import in
// :app moved. The preferences file name, the seven keys and the -1 sentinel did not change by a
// character, which is what an upgrade in place reads back (R448).

/**
 * The device's copy of the person's calculation settings.
 *
 * KMP-3 (R447): written to be implemented from this text alone, because iOS will be.
 *
 * ## What an implementation must guarantee
 *
 * **[load] returns null until a complete [Settings] has been saved**, and null is what
 * sends the person to onboarding. "Complete" here means the three fields with no sensible
 * default - canton, denominatorKind, granularity: a stored set missing any of them is
 * indistinguishable from never having onboarded, so it reads as null rather than as a
 * half-filled object the calculator would then have to defend itself against.
 *
 * **[save] replaces the whole set.** There is no per-field write and no merge: callers
 * load, copy, and save the result. Two half-saves racing would otherwise leave a canton
 * from one and a rate from another.
 *
 * **Absent and null are different, and an implementation must keep them different.** A
 * null `exactTotalWorkDays` is a real answer - the simplified basis - and so is a null
 * `activityStartDate`, meaning the whole year. Whatever an implementation does with them,
 * [load] must return null for each and must not substitute a zero, an empty string or a
 * default date. (The Android implementation below stores one as a sentinel and simply
 * omits the other, because SharedPreferences removes a key written as null - two nulls,
 * two mechanisms, in one file. An iOS implementation is free to encode both the same way,
 * as long as they round-trip as null.)
 *
 * **[clear] erases every field.** It runs on sign-out, because the six settings live on
 * the server and a re-sign-in restores them from GET /api/v1/me (R297), so clearing costs
 * the owner nothing and protects whoever holds the phone next. [clear] on an empty store
 * is a no-op.
 *
 * **[isOnboarded] is a derived default and must NOT be overridden.** It is the one
 * completeness definition the server path uses as well, so an implementation that
 * substituted its own would let the device and the server disagree about whether an
 * account is finished - which is the defect R335 exists to prevent.
 *
 * ## What an implementation must never do
 *
 * It must not store a coordinate or a credential: these are six calculation settings and
 * nothing else. It must not invent a value for a field the person has not answered.
 */
interface SettingsStore {
    /** The cached settings, or null if onboarding has not completed on this device. */
    fun load(): Settings?

    fun save(settings: Settings)

    fun clear()

    /**
     * AN-ONBOARD-2 (R335): onboarded means COMPLETE - every field the releve needs, not merely "some settings
     * exist". Keyed on the ONE completeness definition (ReleveCompleteness.toMeView/isComplete) the server path
     * also uses, so a locally-cached account missing a name (the Q1 case) is sent back to finish onboarding
     * rather than onto Aujourd'hui with a PDF that 422s.
     */
    fun isOnboarded(): Boolean = load()?.toMeView()?.isComplete() ?: false
}
