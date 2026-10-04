package ch.monreleve.app.detection

// AN-NEXT-2 / R324. Which OS location provider produced a fix, and the classification-plus-provider that
// crosses OUT of the sampling path so the tally can COUNT how often each provider decided a day.
//
// THIS IS A LABEL, NOT A COORDINATE AND NOT AN ACCURACY VALUE (D18). AN-NEXT added a GPS -> NETWORK
// fallback (LiveLocation.kt): a NETWORK fix (wifi/cell) works indoors but can be off by hundreds of
// metres, where GPS is metres. R324 reads the fix's accuracy at classification and discards it with the
// coordinate; the PROVIDER is kept only as a label that becomes an aggregate COUNT in daily_tally
// (gpsCheckCount / networkCheckCount). The field test reads those counts to see how often network
// location decided a day. No per-fix provider label, no accuracy value and no coordinate is ever
// persisted (R324; the /v1 API likewise rejects a provider name, SPEC D18).

/** Which provider produced a fix: GPS (metres) or NETWORK (wifi/cell, can be hundreds of metres). */
enum class FixProvider {
    GPS,
    NETWORK,
    ;

    companion object {
        /**
         * Map LocationManager's frozen provider strings to the label. "gps" is GPS; anything else is
         * treated as NETWORK - the conservative bucket, since the only other provider the sampler asks
         * for is "network" (FIX_PROVIDERS) and an unknown provider is, like network, not GPS-precise.
         */
        fun ofManagerProvider(provider: String): FixProvider = if (provider == "gps") GPS else NETWORK
    }
}

/**
 * What survives the sampling path per fix: the side (INSIDE/OUTSIDE/BUFFER) and which provider produced
 * it. NO coordinate and NO accuracy value (D18) - the accuracy was read at classification and discarded,
 * the provider is a label the tally turns into a count.
 */
data class ProviderFix(
    val classification: Classification,
    val provider: FixProvider,
)
