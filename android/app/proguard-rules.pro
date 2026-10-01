# R8 keep rules for the release (and audit) build. R8 is ON from AN14a (increment 2).
#
# THIS FILE IS DELIBERATELY EMPTY OF KEEP RULES, AND THAT IS THE FINDING (R306).
# R8 was switched on for the first time in AN14a expecting the classic Kotlin
# debug-works/release-breaks failures - a serialised class whose fields R8 renamed,
# an enum constant renamed on the wire, a class reached only by reflection and
# removed. NONE of them appeared. The build held with no warning and no
# missing_rules.txt, and the wire survived minification statically (verified in the
# dex, increment 2; formalised by the checkMinifiedWireContract gate task, R307,
# increment 4). So the NARROWEST rule set that works is no rules at all - adding one
# anyway would turn minification off by another name and hide the next real breakage
# (R306). Every reason this codebase escapes R8's usual victims, each checked:
#
#  - THE /v1 WIRE IS MANUAL org.json WITH STRING-LITERAL KEYS. EntriesWire.kt builds
#    the request with item.put("dayDate", ...) etc. R8 NEVER rewrites the CONTENT of
#    a string literal, so every JSON key survives untouched (clientMutationId,
#    dayDate, portion, kind, provenance, absenceReason, note, detectedKind,
#    detectedAt, clientClaimedAt, written, duplicates, entries - all present in the
#    minified dex string pool).
#  - ENUM VALUES ON THE WIRE SURVIVE. The values go out as `enum.name` and come back
#    via `Enum.valueOf(...)` (WireEnums.kt: EntryKind, Portion, AbsenceReason,
#    Provenance). R8 renamed the enum CLASSES (EntryKind -> R1.h) and the constant
#    FIELDS (CH -> d), but `.name` returns the string the compiler passed to the Enum
#    constructor in <clinit>, NOT the field name - and that literal is left intact. So
#    CH, HOME, MISSION_FR, MISSION_THIRD, ABSENT, FULL, AM, PM, CONGE, MALADIE, FERIE,
#    AUTRE, MANUAL, DETECTED_CONFIRMED, DETECTED_CORRECTED all survive in the dex. The
#    default proguard-android-optimize.txt also keeps `values()`/`valueOf()` on every
#    enum, which blocks the enum-unboxing optimisation that could otherwise erase them.
#  - NO REFLECTION-BASED SERIALISATION. No kotlinx.serialization, Gson, Moshi or any
#    library that reads field names by reflection (which R8 DOES rename). The AN-AUDIT
#    confirmed zero third-party HTTP/JSON libraries in the release APK.
#  - PLATFORM HTTP. data/remote wraps HttpsURLConnection; nothing is instantiated by
#    name or proxied.
#  - LIBRARY CONSUMER RULES COVER THE ONE REFLECTION PATH THAT EXISTS. WorkManager
#    instantiates SyncWorker by class; its bundled consumer rules keep ListenableWorker
#    subclasses, and the mapping confirms `SyncWorker -> SyncWorker` (kept UNRENAMED).
#    Room's generated EntryDao_Impl is kept by Room's consumer rules and its column
#    names are SQL string literals. Compose ships its own consumer rules too. None of
#    these needs a rule HERE.
#
# THE DISCIPLINE FOR ANY FUTURE RULE (R306), so this file never silently grows into a
# blanket keep:
#  1. A keep rule is added ONLY AFTER a build or a drive shows a concrete failure that
#     needs it - never pre-emptively, never "to be safe".
#  2. Every rule carries a comment naming the exact failure it fixes (the stack trace,
#     the missing class, the renamed key) and the build/drive that proved it.
#  3. NO rule of the form `-keep class some.package.** { *; }` (keep everything in a
#     package) unless a comment here explains why nothing narrower works - a blanket
#     keep is minification off by another name.
#  4. A rule nobody can still explain is REMOVED and the build re-tested; if nothing
#     breaks, it was never needed.
