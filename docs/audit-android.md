# Mon Releve - Android adversarial audit (AN-AUDIT, Checkpoint F)

Pure ASCII. This is the findings register the AN-AUDIT session builds up increment by increment; every
finding carries SEVERITY, EVIDENCE (what was run and what it returned) and WHAT IT WOULD TAKE TO CLOSE. The
full session report is REPORT-AN-AUDIT.txt. This audit BUILDS NOTHING new and FIXES ALMOST NOTHING (R255):
increment 0's three operator-ruled fixes (R297-R299) landed before it; everything else is measured and parked.

This file is WORK IN PROGRESS while the session runs. The SUMMARY, UNEXAMINED, FINDINGS BY SEVERITY and the
three-that-deserve-a-task sections are assembled at the end (increment 7), after the security, resilience,
performance, accessibility and code-quality passes.

STANDING FRAME - TWO APKS, TWO CLAIMS:
- The TRUE RELEASE APK (assembleRelease, unsigned) is what ships; every declaration below is read from IT,
  never from source (AC2).
- The AUDIT variant (a committed `audit` build type = release config + debug network access) is what makes the
  release CODE runnable against the local server. Because isMinifyEnabled=false, the release bytecode equals
  debug's, so the audit drive exercises the same code the release ships (AC1). Differences are named in THE
  RELEASE BUILD section.

---

## PRECONDITIONS

- Task placement (R273): tasks/todo.md has AN14 (Play Store release preparation - owns R8/App Bundle/mapping)
  and AN15 (the planned final hardening audit). This AN-AUDIT runs at Checkpoint F, BEFORE AN13/14/15, and is
  named AN-AUDIT rather than a number to avoid an R162 collision with AN15.
- R1 baseline (recorded by the prior session on dee25cb): `pnpm gate:clone` PASSED (install, typecheck, lint,
  test, build, size, db:deploy, test:db, test:container:write; clone removed) and `:app:gate` PASSED
  (assembleDebug, testDebugUnitTest 810 tests, checkTestFloor, ktlint, detekt, verifyPaparazziDebug,
  checkReleaseCleartext, checkReleaseNoDebugInjection). CI is quiet (private repo, CI_FULL unset) - gate:clone
  is the authority. Increment 0 was android-only, each commit `:app:gate`'d green; the authoritative
  clean-machine verification is the final gate:clone + :app:gate in increment 7.

## INCREMENT 0 - the three operator-ruled fixes (R297-R299)

Each test-first with a genuine RED, gated, committed, pushed (03dc71e, 293837f, 9955e1f). Reproduced here from
the prior session's evidence.

- R297 (reverses PARKAN-28): sign-out now CLEARS the calculation settings; a re-sign-in RESTORES them from GET
  /api/v1/me BEFORE the onboarding decision. DeviceLocalStore.clearForSignOut clears settingsStore; new
  parseMeSettings (canton-keyed, null-safe); new StartupDecider (settings->MAIN, none->ONBOARDING, gone
  session->SIGN_IN, unreachable->ONBOARDING); MainActivity gains a RESOLVING state. GENUINE RED first (6 real
  assertion failures), then GREEN. Driven on-device, both branches proven.
- R298 (closes PARKAN-29): checkLicences Gradle task, wired into :app:gate, resolves the release runtime
  classpath (resolutionResult, no artifact download) and fails on any module not attributed on the licences
  screen. R178 REAL FINDING on first run: com.google.guava:listenablefuture, org.jetbrains:annotations and
  org.jspecify:jspecify were bundled but uncredited - added. R180 plant (okio) verified it fires, reverted.
- R299 (closes PARKAN-30): openLegalLink catches ActivityNotFoundException and shows the link's address; no
  crash on a browserless device. R254 mutation confirmed the catch is load-bearing.

## THE DATASET (increment 1) - a device dataset worth measuring against

A COMMITTED DEBUG SEEDER, because direct SQLite seeding is out (sqlite3 is absent from the emulator image, and
a hand-written INSERT would risk drifting from Room's identity hash). DebugSeeder (a pure, deterministic
generator, R197) + DebugSeederActivity (a thin src/debug activity that inserts through the app's own EntryDao
inside one Room transaction). It JOINED the SessionInjection guard family: both R284 guards
(NoDebugInjectionInMainTest source scan; checkReleaseNoDebugInjection merged-release-manifest check) now name
"DebugSeeder" alongside "SessionInjection". Both extensions were proven with a plant that was verified to land
before its RED was read (R180): guard (a) went red naming
`DebugSeeder in src\main\kotlin\ch\monreleve\app\PlantDebugSeeder.kt`; guard (b) went red naming
`[DebugSeeder] is present in the merged RELEASE manifest`. Both plants reverted.

Scenarios, laid out in DISJOINT calendar years below a run-time anchor so ALL composes with no (dayDate,
portion) collision:
- DECADE: anchor-9..anchor weekdays, one FULL day each, a realistic CH/HOME/mission mix, SYNCED.
- HALF_DAY: anchor-10 weekdays, an AM (CH) and a PM (HOME) row each, SYNCED.
- ABSENT: anchor-11 weekdays, every one an absence with a cycling reason, SYNCED.
- LATE: anchor-12 weekdays, recorded in a single backfill the next July (firstRecordedAt months after the day).
- NOTES: four pathological-but-locally-legal notes, built from codepoints (R96), sized against the server cap
  (R181): an OVERSIZED note of MAX_NOTE_LENGTH*20 = 10000 chars (locally legal - Room has no length bound -
  but wire-illegal, so its consistent lifecycle is FAILED with null server columns); a WHITESPACE-only note
  (the server schema is z.string().max(500) with no .min()/.trim(), verified, so it is wire-legal -> SYNCED);
  an RTL note; an EMOJI note (a ZWJ family, a flag, a skin tone).

EVIDENCE (measured on the emulator, asOf pinned 2026-09-30):
- On-device status line (read-back through a real SELECT): `SEEDED anchor=2026 DECADE=2543 HALF_DAY=522
  ABSENT=261 LATE=261 NOTES=4 generated=3591 stored=3591` - generated equals stored, no silent drop.
- Independent host count via node:sqlite on a binary-safe (adb exec-out) pull, byte-identical to the device
  (929792 bytes): total 3591; years 2013..2026 (hi = asOf, no future rows); DECADE sums to 2543; HALF_DAY 522
  = 261 AM + 261 PM; ABSENT 261 all with a reason (0 null), 0 non-absent rows carrying a reason; 1 FAILED row
  (the 10000-char note, serverId null); a LATE sample 2014-01-01 recorded 2015-07-01. DebugSeederTest asserts
  the same counts, determinism, disjoint ranges and every invariant with independently-computed expectations.

## THE RELEASE BUILD (increment 2, AC1)

THE AC1 REFRAME (a confirmed finding, not a blocker): the release build is NOT R8-minified -
android/app/build.gradle.kts sets isMinifyEnabled=false, and proguard-rules.pro is a placeholder. This is a
CONFIRMED KNOWN DEFERRAL owned by AN14, not a surprise defect. So the classic R8 failure modes (a renamed
serialised field, a stripped reflective lookup, a shrunk Room/Compose class) cannot exist yet. BUT the release
CONFIGURATION had still never been launched, so AC1 still had work to do. Parked as PARKAN-31 (NEEDS:
re-exercise the shipping artifact once AN14 enables R8, monreleve.ch resolves + serves assetlinks, and a
release key exists).

SIZE: TRUE release APK (unsigned) = 7,348,435 bytes (7.01 MB), audit APK = 7,356,771 bytes (7.02 MB). Both are
well under the SPEC 977 budget of 12 MB. Caveat: SPEC names the *download* size, which needs an App Bundle +
Play compression (an AN14 concern); the raw APK is the closest measure available now and it has headroom.

WHAT R8 REMOVED: nothing, measured three ways. (1) isMinifyEnabled=false (config). (2) No `mapping/` directory
is produced by the release build (build output). (3) Class names survive UNOBFUSCATED in the release dex -
`ch/monreleve/app/calc` (5 hits), `EntryEntity` (2), `SyncEngine` (3), `ch/monreleve/app/detection` (15) -
so R8 renamed nothing (bytecode).

THE AUDIT VARIANT - differences from release, named exactly:
- SAME: isMinifyEnabled=false, non-debuggable, same applicationId, same proguard files (initWith release).
- DIFFERENT: the auto DEBUG signature (so it installs; R250 forbids the RELEASE key, not the debug one); a
  LOCAL api url over cleartext to 10.0.2.2 (release points at https://monreleve.ch, which does not resolve);
  and it reuses src/debug (the injection + seeder + the cleartext-to-10.0.2.2 network config).
- The release guards are UNTOUCHED: checkReleaseCleartext and checkReleaseNoDebugInjection read the RELEASE
  variant and stayed green after the audit variant was added - the FW14 "audit does not weaken the release
  guards" evidence. Positive signal (R133): the injection/seeder markers are ABSENT from the release APK
  (0 in the release dex and manifest) and PRESENT in the audit APK (24 in the audit dex, 2 in the manifest) -
  the guard's markers match real components, not typos matching nothing.

WHAT RUNNING IT SHOWED:
- TRUE release APK, debug-signed copy, installed and launched: renders the Connexion sign-in screen with no
  ch.monreleve crash (a fresh install with no session correctly routes to sign-in). The server call only fires
  on "Recevoir le lien"; at that point the release build would reach https://monreleve.ch, which does not
  resolve on the emulator.
- AUDIT variant against the local container: GET /api/v1/me DECODED (200, a full settings object); the MAIN
  shell rendered ("Bonjour Camille", "Saisie manuelle", the En Suisse/Domicile/Mission recorder, the
  Aujourd'hui/Calendrier/Releve/Parametres bottom nav); a canton-null account routed to ONBOARDING; a
  canton=GE account reached MAIN; the sign-out dialog rendered the R297 copy. No crash. The serialisation
  round-trip AC1 targets works on the release config.
- WHAT WOULD EXERCISE IT END TO END (NEEDS, PARKAN-31): R8 enabled with real keep rules; a resolving
  monreleve.ch serving assetlinks.json with the release key's fingerprints; a release signing key; then a
  drive of the TRUE release APK over HTTPS through the real magic-link -> App Link callback, reading the R8
  mapping for anything wrongly kept or stripped.

## WHAT THE APK DECLARES (increment 3, AC2)

All read from the BUILT release APK (aapt2 dump + dex string scans), never from source.

PERMISSIONS (aapt2 dump permissions):
- android.permission.INTERNET - the client talks to /api/v1 over the network. Justified.
- android.permission.ACCESS_FINE_LOCATION - on-device detection reads a GPS fix, classifies it against the
  bundled border polygon and DISCARDS the coordinate (D18). Justified ONLY IF detection is a feature this
  build has; the detection code and polygon ship (R280). NOTE for Play review / the data-safety form / R282:
  a foreground location permission is a claim of a location feature, so the data-safety form must declare
  location access (used on-device, not collected/transmitted) and the store listing must match. This is the
  one permission that will draw Play scrutiny. ACCESS_BACKGROUND_LOCATION is NOT declared (correct - it is the
  restricted permission and an AN7 decision).
- android.permission.WAKE_LOCK, ACCESS_NETWORK_STATE, RECEIVE_BOOT_COMPLETED, FOREGROUND_SERVICE, and the
  auto ch.monreleve.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION - all transitive from androidx.work
  (the offline-sync WorkManager: wake to sync, a network constraint, reschedule on boot, a foreground service,
  and the runtime-receiver export guard). Justified by the sync feature.

EXPORTED COMPONENTS (aapt2 dump xmltree of the release manifest):
- ch.monreleve.app.MainActivity - exported=true. REQUIRED (LAUNCHER). OK.
- ch.monreleve.app.CallbackActivity - exported=true. REQUIRED (the App Link callback, SPEC 10). OK.
- ch.monreleve.app.dev.GalleryActivity - exported=true. FINDING (see below).
- ch.monreleve.app.dev.SignInProbeActivity - exported=true. FINDING.
- ch.monreleve.app.dev.DevRecorderActivity - exported=true. FINDING.
- ch.monreleve.app.dev.DetectionReplayActivity - exported=true. FINDING.
- androidx.core.content.FileProvider - exported=false. OK.
- androidx.startup.InitializationProvider - exported=false. OK.
- androidx.work SystemAlarmService / SystemForegroundService and all androidx.work receivers - exported=false.
  OK.
- androidx.work.impl.background.systemjob.SystemJobService - exported=true. This is standard WorkManager: the
  platform JobScheduler binds it, and it is protected by the system-only permission android.permission.
  BIND_JOB_SERVICE. Not a finding (a framework requirement, system-gated).
- The debug session-injection and the DebugSeeder are ABSENT from the release APK (0 markers in the release
  manifest AND 0 in the release dex - not merely undeclared, the code is not compiled in).

HOSTS (release dex string scan):
- https://monreleve.ch - the one API base URL (BuildConfig.API_BASE_URL). Present.
- 10.0.2.2 - ABSENT from the release dex (0). The emulator host does not ship in release.
- No cleartext http:// endpoint - the only http:// strings are the XML and SVG namespace URIs
  (schemas.android.com, www.w3.org/2000/svg), which are not network endpoints. Consistent with the release
  network security config denying cleartext everywhere.

LIBRARIES (release dex package census, cross-checked against checkLicences R298):
- androidx (19538 refs), kotlin (4696), kotlinx.coroutines (1565), org.jetbrains (32),
  com.google.common = Guava (12), org.jspecify (4). Exactly the set checkLicences attributes on the licences
  screen. No third-party HTTP/JSON library (okhttp/retrofit/gson/moshi/ktor/volley all 0) - the app uses the
  platform HttpsURLConnection and org.json.
- NO analytics, crash-reporting or advertising SDK: firebase, gms/analytics, crashlytics, facebook, amplitude,
  adjust, bugsnag, sentry, mixpanel, doubleclick, admob all scanned, all 0. Consistent with the privacy notice.

SECRETS (release dex string scan): none. AUTH_SECRET, AWS keys (AKIA...), PEM private keys (-----BEGIN...),
client_secret, password=, apikey/api_key/SECRET_KEY - all absent. The app holds only the signed-in user's
runtime tokens (never in the APK); the server's AUTH_SECRET is server-side.

FINDING F1 (severity MEDIUM) - four dev-only activities are exported in the shipping release APK.
- EVIDENCE: aapt2 dump xmltree of the release APK manifest lists dev.GalleryActivity, dev.SignInProbeActivity,
  dev.DevRecorderActivity and dev.DetectionReplayActivity, each android:exported=true, each present because
  they live in src/main (not src/debug like the injection). They have no intent-filter, so they are not in the
  launcher and no App Link opens them, but any app on the device can start them by name
  (`am start -n ch.monreleve.app/ch.monreleve.app.dev.DevRecorderActivity` succeeds).
- WHY IT MATTERS: DevRecorderActivity records a day through EntryRepository and can trigger a sync;
  DetectionReplayActivity runs the real detection pipeline; SignInProbeActivity reads the stored session;
  GalleryActivity renders the component gallery. None writes a day on launch alone (DevRecorder needs a tap on
  its own launched UI - measured by reading the source: the write is in the onRecord button handler, not
  onCreate), so this is NOT the absolute-stop "exported component that writes a day" case. But shipping a
  functional day-recorder, a detection-pipeline runner and a session-reader as launchable surfaces to every
  other app is a real attack surface and a tapjacking/UI-redress vector, and it is exactly what the built-APK
  sweep exists to catch. Increment 4 fires hostile intents at each.
- WHAT IT WOULD TAKE TO CLOSE: move the four dev activities to src/debug (as the injection and the seeder are),
  or set android:exported=false / gate them behind a debug BuildConfig, and add a built-APK check that the
  release manifest declares no ch.monreleve.app.dev.* component - the manifest analogue of
  checkReleaseNoDebugInjection. This is structural (R255) and belongs to AN14's release hardening.

FINDING F2 (severity LOW, informational) - ACCESS_FINE_LOCATION ships and must be declared on the data-safety
form.
- EVIDENCE: the release manifest declares ACCESS_FINE_LOCATION; the detection code and border polygon ship in
  the APK (R280). D18 holds (the coordinate is discarded on-device; increment 4 proves it is never sent).
- WHY IT MATTERS: R282 - asking for a permission is claiming a feature. A foreground location permission is
  the single most scrutinised item in Play review, and the data-safety form must declare location as
  accessed-on-device / not-collected / not-transmitted to match the manifest and the privacy notice.
- WHAT IT WOULD TAKE TO CLOSE: an AN14 data-safety-form entry and a store-listing sentence, and a confirmation
  that foreground detection is a shipping feature (if detection is deferred, the permission should be too).

## SECURITY AND PRIVACY, PROBED (increment 4)

Probed on the DEBUG build (state checks need run-as, which the non-debuggable audit variant blocks); the
release code is identical (minify off, dex-equal, increment 2) and the release exported surface was measured
from the release APK (increment 3), so probing debug loses nothing and gains prefs/DB/traffic evidence.

TOKENS - cross-app read (a second app, ch.monreleve.probe, committed as a Gradle module OUTSIDE :app).
- PROBE: signed with the SAME debug key as the app, so it is a STRONGER attacker than a real third-party app
  (it shares any signature-level permission). A POSITIVE CONTROL ran first and passed: "CONTROL own filesDir:
  READ OK (probe works)". With the victim's monreleve.auth.xml confirmed present, the probe then tried five
  reads across the sandbox and ALL were DENIED (FileNotFoundException): the AUTH tokens, the DOSSIER cache, the
  SETTINGS, the ROOM db, and the FileProvider (content://ch.monreleve.app.fileprovider/exports/releve.pdf with
  no grant).
- VERDICT: NO LEAK. The per-app UID sandbox holds; a second app cannot read the tokens, the database, the
  cached releve or an exported file. (This is the FW30 stop-rule surface - the result is the safe one.)

INTENTS - hostile intents at every exported component and the App Link callback (nothing may sign in, write a
day, or crash).
- Fired junk + 8000-char oversized extras at all four dev activities (they launch, as exported components do);
  fired eight hostile URIs at the callback: a foreign host, a cleartext scheme, a wrong path, a missing token,
  an 8000-char oversized token, javascript:, malformed percent-encoding, a content:// URI, and null data.
- RESULT: the intent-filter REJECTED the foreign host, the cleartext scheme, the wrong path, the javascript:
  URI, the content:// URI and null data ("Activity not started, unable to resolve Intent"); the well-formed-
  path callbacks launched CallbackActivity but, with an invalid or missing token, produced NO session. After
  the whole fuzz: zero app crashes (no FATAL for ch.monreleve.app in logcat), and monreleve.auth.xml was ABSENT
  - no session was written by any hostile intent, and no day was written.
- VERDICT: nothing signed in, wrote a day, or crashed.

PENDING INTENTS - zero app-owned. A source scan (grep PendingIntent app/src/main) returns nothing: the app
creates no PendingIntent. The only PendingIntents in the build are androidx.work's, which the library creates
with an explicit mutability flag on modern SDKs. The reminder settings (reminderTime/reminderEnabled in /me)
are a stored preference with no scheduler wired yet (no AlarmManager/NotificationManager in main), consistent
with there being no app-owned PendingIntent.

D18 - no coordinate sent, proven from captured traffic. A logging reverse proxy recorded every request the app
made during a full drive (inject, reach MAIN, record a Swiss day which triggers a sync, and drive the
detection replay - the sharpest D18 surface). PRESENCE BEFORE ABSENCE (R169 corollary): the capture contained
the expected POST /api/v1/entries, so the no-coordinate result is not an empty-capture artifact. The actual
entry payload, verbatim:
  {"entries":[{"clientMutationId":"...","dayDate":"2026-09-30","portion":"FULL","kind":"CH",
   "provenance":"MANUAL","clientClaimedAt":"2026-09-30T16:59:05.681+00:00"}]}
A coordinate scan of every captured body (coordinate-shaped KEYS lat/lng/geo/accuracy/bearing/altitude/speed,
AND value pairs of Geneva-plausible decimals lat 43-47 / lng 5-8) found NOTHING. The engine's rates (39,16 /
4,16) and the tally's integer minutes/fixCount are legal and out of those ranges. Reproduced identically
across two runs. VERDICT: the running app sends no coordinate. This complements the source fence and the DDL
scan (which prove it cannot be written) - this proves it is not sent.

LOGS - logcat scanned during the same drive for the EXACT token/refresh/email values the harness minted (an
advantage a generic scan lacks: it knows the real secrets). A positive control confirmed the app process
logged something at all. RESULT: none of the three secret values appeared in logcat. VERDICT: no credential or
address reaches a log line (consistent with the LogFenceTest source guard).

BACKUP - two claims. The backup RULES (res/xml/backup_rules.xml for API 26-30, data_extraction_rules.xml for
31+) EXCLUDE monreleve.auth.xml and monreleve.pending.xml from BOTH cloud-backup AND device-transfer, so a
restored backup cannot resurrect a session or replay a queued mutation. The dynamic `adb backup` run against
the debug build DECLINED headless (it requires an on-screen confirmation the headless emulator cannot tap,
which itself yields nothing) - noted rather than passed off as rule-based exclusion (R233). NOTE: the Room DB
and the cached dossier (monreleve.dossier.xml) are NOT excluded, so a backup carries the user's own tax record
to their own account backup - defensible (it is their data, not a credential), but worth an explicit AN14
data-safety decision.

FINDING F3 (severity LOW) - no FLAG_SECURE; the recents thumbnail shows the tax record.
- EVIDENCE: FLAG_SECURE appears in no app screen (source scan - only a rationale comment in LogFenceTest). The
  recents thumbnail, captured via KEYCODE_APP_SWITCH, shows the full Aujourd'hui screen: "Bonjour Camille",
  "Taux a declarer a l'AFC 0,00 %", "Sous les deux seuils", "Jours restants avant 40,0 % : 96".
- WHY IT MATTERS / THE EXISTING POSITION: the project deliberately does NOT set FLAG_SECURE, with a tested
  rationale (LogFenceTest.noRawTokenReachesTheUiLayer): no screen renders a token or the sign-in link, so there
  is no CREDENTIAL to hide, and a black recents would also defeat the audit's own screenshots. That rationale
  is sound for credentials. It does not cover the tax RECORD, which the thumbnail (and any screenshot) exposes
  to someone with physical device access. This is personal data, not a credential, so it is a LOW finding and a
  deliberate product trade-off rather than a defect.
- WHAT IT WOULD TAKE TO CLOSE: an AN14 decision on whether to set FLAG_SECURE (or exclude the app from recents
  previews) to hide the tax record, weighed against losing in-app screenshots and the screenshot-based audit
  instruments. Conservative today: leave it, and record the trade-off.

## INTEGRITY AND RESILIENCE (increment 5, PARTIAL - see UNEXAMINED)

FINDING F4 (severity HIGH) - an expired or revoked session does NOT clear the offline queue, so one account's
queued days drain into the NEXT account that signs in on the same device.
- THE R295 GAP, NAMED BY THE PROMPT: R295 made the SIGN-OUT BUTTON clear the record (the Room entries ARE the
  mutation queue - a pending mutation is a row with syncState=PENDING). But an EXPIRED or REVOKED session is not
  a sign-out, and nothing on that path clears the record.
- EVIDENCE (established from source, which increment 2 PROVED byte-identical to what ships - minify off, no
  mapping.txt, class names unobfuscated in the release dex - so the source chain below is the shipping chain):
  1. SessionManager.applyRefresh: RefreshResult.Invalid (an expired/rotated-out refresh) -> tokenStore.clear()
     ONLY (no record clear). SessionManager.onUnauthorized: a dead session (revoked_session/unknown_token, R210)
     -> tokenStore.clear() ONLY.
  2. StartupDecider.decideStartAfterSignIn: MeFetch.SessionGone -> StartDestination.SIGN_IN - no record clear.
     MainActivity routes !session.isSignedIn() -> SIGN_IN; the clearRecord seam (MonReleveDatabase
     .clearAllTables) is wired ONLY to DeviceLocalStore.clearForSignOut, i.e. the sign-out button.
  3. CallbackController.exchange (the real sign-in): tokenStore.save(newPair) + pending.clear() - no record
     clear. So account B signing in does not clear account A's rows.
  4. EntryEntity has NO userId column (by design - "the token identifies the user"), so the local queue is not
     scoped to an account.
  5. SyncEngine.sync drains dao.pending() through AuthenticatedPoster, which loads the CURRENT token (B's) at
     post time; server tenancy is assigned from the token (@@unique([userId, dayDate, portion])). So account
     A's PENDING rows POST under account B's userId - A's fiscal days land in B's server record. SyncEngine's
     own SyncOutcome.Unauthenticated doc comment states the drain mechanism verbatim - "Rows stay PENDING until
     a fresh sign-in triggers another sync" - written without contemplating that the fresh sign-in may be a
     DIFFERENT person. The code describes the defect in its own words.
- SCENARIO: a shared, handed-over or resold device. A records days offline; A's refresh token expires or is
  revoked server-side; A is dropped to the sign-in screen with the queue intact; B signs in; B's first sync
  drains A's queue into B's account. A's days are attributed to B, and A's record is silently altered.
- TWO CONSEQUENCES beyond the drain: (a) BEFORE any sync, B SEES A's leftover days rendered locally - the
  calendar and Aujourd'hui read the unscoped local entry store, so A's record is on B's screen the moment B
  reaches the shell; (b) AFTER the drain, B's exported Releve annuel de teletravail - the audit-defensible
  document this product exists to produce - contains days B never worked.
- MEASUREMENT STATUS (R233/R254): an on-device measurement was BUILT
  (android/scripts/an-audit-crossaccount.mjs - A records offline behind a blockable proxy, A is revoked in
  Postgres, B signs in, the queue drains, and a Postgres entriesByUser() reads which account owns A's offline
  days) but did NOT run: the emulator could not boot on the audit machine because the disk was 99% full (the
  Play-Store AVD needs ~7.37 GB free for a fresh userdata partition; ~7.28 GB was free, with active external
  churn). THE SOURCE CHAIN IS CONCLUSIVE; the on-device confirmation is owed and is the successor's first task.
- WHAT IT WOULD TAKE TO CLOSE: clear the record when a session ends for ANY reason (extend R295's
  clearForSignOut to the expiry/revocation paths in SessionManager, and to a user change at sign-in in
  CallbackController), OR scope the local entry store to a userId and refuse to drain a queue whose userId does
  not match the current session. Structural (R255) -> an AN14/AN15 task; it is one of the three that most
  deserve a task of their own.
