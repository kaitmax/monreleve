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
#  - THE /v1 WIRE KEYS ARE COMPILE-TIME STRING LITERALS, NOT REFLECTED FIELD NAMES.
#    KMP-1 moved the wire code to :shared and replaced org.json with kotlinx.serialization,
#    but the keys still survive as LITERALS. For the @Serializable DTOs (EntryWrite,
#    ServerEntry, EntriesResponse, the auth request/pair DTOs) the serialization COMPILER
#    PLUGIN emits each field name as a string into the generated $serializer descriptor
#    (addElement("dayDate")), and R8 never rewrites the CONTENT of a string literal. The
#    reads kept on the JSON tree (parseServerFailure, parseDossier) use "code"/"dayDate"/...
#    literals too. So every /v1 key still lands in the minified dex string pool
#    (clientMutationId, dayDate, portion, kind, provenance, absenceReason, note,
#    detectedKind, detectedAt, clientClaimedAt, id, firstRecordedAt, lastModifiedAt,
#    written, duplicates, entries) - proven on each HEAD by checkMinifiedWireContract (R307),
#    which passed with this file still empty of keep rules after the KMP-1 move.
#  - ENUM VALUES ON THE WIRE SURVIVE. The values go out as `enum.name` and come back
#    via `Enum.valueOf(...)` (WireEnums.kt: EntryKind, Portion, AbsenceReason,
#    Provenance). R8 renamed the enum CLASSES (EntryKind -> R1.h) and the constant
#    FIELDS (CH -> d), but `.name` returns the string the compiler passed to the Enum
#    constructor in <clinit>, NOT the field name - and that literal is left intact. So
#    CH, HOME, MISSION_FR, MISSION_THIRD, ABSENT, FULL, AM, PM, CONGE, MALADIE, FERIE,
#    AUTRE, MANUAL, DETECTED_CONFIRMED, DETECTED_CORRECTED all survive in the dex. The
#    default proguard-android-optimize.txt also keeps `values()`/`valueOf()` on every
#    enum, which blocks the enum-unboxing optimisation that could otherwise erase them.
#  - SERIALISATION IS COMPILE-TIME (kotlinx.serialization), NOT REFLECTION. KMP-1 added
#    kotlinx.serialization for the moved :shared wire code. It is NOT the reflection kind
#    (Gson/Moshi) that reads field names at runtime and that R8 renames: its serializers are
#    generated at compile time, and the library ships CONSUMER ProGuard rules (in its own
#    artifact) that keep every @Serializable class's generated serializer - exactly like the
#    WorkManager/Room/Compose consumer rules noted below. Those kept serializers carry the
#    field-name literals, so NO rule is needed HERE; verified by checkMinifiedWireContract
#    passing on this HEAD with this file still empty of keep rules. No Gson/Moshi or any
#    runtime-reflection JSON library is present.
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
