package ch.monreleve.app.data.remote

import kotlinx.serialization.json.Json

// KMP-1 (R380). THE ONE Json configuration for every moved wire file (AuthApi, ApiFailure, the entries DTOs,
// and - via its own tree reads - DossierPayload). internal, so :app never sees it; the encode/parse functions
// it backs are the public seam. EVERY flag is set to REPRODUCE what org.json did today, NOT for taste - the
// server's schemas are .strict() (one extra key is a 400), so a flag that changed the bytes would be a
// production failure, not a style choice:
//
//   explicitNulls = false
//     org.json NEVER wrote a key for a null optional - the code did `x?.let { put("x", it) }`, so a null was an
//     ABSENT key, never `"x":null`. The server's zod uses .optional() (absent allowed) and NOT .nullable()
//     (literal null rejected), so a `"x":null` would be a 400. explicitNulls=false omits a null property on
//     ENCODE (reproducing the omission) and, on DECODE, reads an absent nullable key as null - which is exactly
//     what org.json's `if (isNull(key)) null else ...` did for both the absent and the explicit-null cases.
//
//   encodeDefaults = false
//     org.json has no notion of a default - it wrote precisely the keys the code put(). The request DTOs give
//     their ALWAYS-SENT fields NO Kotlin default, so encodeDefaults=false can never drop one of them; it only
//     ever affects a nullable optional sitting at its null default, which explicitNulls=false already omits.
//     The two together reproduce "write exactly the non-null keys the code set".
//
//   ignoreUnknownKeys = true
//     org.json read ONLY the keys it named (getString("id"), etc.) and silently ignored the rest. The contract
//     makes this a CLIENT OBLIGATION (docs/api-v1.md 6.5: "Ignore unknown keys ... this is what makes additive
//     change possible"); a server that adds a response field must not break this client. true = ignore, matching.
//
//   isLenient = false
//     org.json parsed the strict JSON the server sends; it was never fed a lenient (unquoted / trailing-comma)
//     body in practice. Strict parsing of a real server body yields the identical accept/refuse decision, and a
//     malformed body is refused by both - which the callers already turn into null / a load failure.
//
//   coerceInputValues = false
//     org.json NEVER coerced a null or an out-of-type value into a default - a missing required field threw
//     (getString on an absent key), which the callers caught via runCatching and turned into null / Malformed.
//     coerceInputValues=false keeps that: a missing mandatory field throws (MissingFieldException), reproducing
//     "a malformed success body is not a success". Coercing would invent a value org.json never produced.
internal val wireJson: Json =
    Json {
        explicitNulls = false
        encodeDefaults = false
        ignoreUnknownKeys = true
        isLenient = false
        coerceInputValues = false
    }
