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

## INTEGRITY AND RESILIENCE (increment 5)

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
- MEASUREMENT (R233/R254): CONFIRMED ON-DEVICE. android/scripts/an-audit-crossaccount.mjs ran against a scratch
  Postgres + the write container on 3001 behind a blockable proxy on 3000. Sequence: A and B both sign in (real
  /api/v1/auth/callback tokens) and PATCH settings; A records two PAST days OFFLINE (proxy blocked) via the dev
  recorder -> both PENDING, 0 on A's server record; A is revoked server-side; B's real session is injected over
  A's intact PENDING queue (the faithful post-expiry device state - StartupDecider SessionGone and the callback
  both clear NO record); the proxy is unblocked; B records one day and the queue drains. The Postgres ORACLE
  (entriesByUser, joining Entry.userId) then showed, verbatim:
    entries after drain: ["anaudit-acct-b@example.com:2026-09-28","anaudit-acct-b@example.com:2026-09-29",
                          "anaudit-acct-b@example.com:2026-10-01"]
    B owns 3 day(s) (its own is 1); A owns 0; POST path during drain: /api/v1/entries; CROSS_ACCOUNT_LEAK = true
  A's two offline Suisse days (2026-09-28, 2026-09-29) landed under account B's userId; B's own Domicile day is
  2026-10-01; A owns ZERO rows on the server. This is exactly the predicted source chain: B owns A's offline
  days, drained under B's token via POST /api/v1/entries.
- MEASUREMENT CAVEAT (R233): the explicit server-side revoke deleted 0 session rows (revokeAllSessions found no
  SessionToken/Session rows for A - the opaque-hashed-refresh model, D14/R209, does not populate the tables the
  query targets), so the proof rests on the DEVICE-STATE reproduction (B's real token injected over A's intact
  PENDING queue), which is precisely the state the SessionGone->SIGN_IN path and the callback produce - the
  faithful post-expiry state. The leak is measured, not merely sourced.
- FW30 VERDICT (advisor-ratified, carried verbatim): this confirms EXACTLY the source chain, so F4 stays HIGH,
  is recorded here, and the audit CONTINUES to increments 6-7. It is NOT the FW30 immediate stop: it is a
  state-machine integrity defect from a legitimate multi-user sequence (no attacker), there WAS a sign-in, and A
  had no server data for B to READ. Only a categorically different result (a drain with NO sign-in, or B reading
  A's SERVER data) would have reopened the stop question; neither occurred.
- WHAT IT WOULD TAKE TO CLOSE: clear the record when a session ends for ANY reason (extend R295's
  clearForSignOut to the expiry/revocation paths in SessionManager, and to a user change at sign-in in
  CallbackController), OR scope the local entry store to a userId and refuse to drain a queue whose userId does
  not match the current session. Structural (R255) -> an AN14/AN15 task; it is one of the three that most
  deserve a task of their own.

### THE DEVICE CLOCK (increment 5)

The composition root reads the DEVICE clock in three places, each captured at Activity construction:
MainActivity clock = Clock.systemDefaultZone() and taxYear = Year.now(Europe/Paris); AujourdhuiController today
= todayInParis(clock). clientClaimedAt is the raw clock instant, sent verbatim; the late FLAG is the server's
(R216). The clock was moved headless with `cmd alarm set-time <ms>` after `settings put global auto_time 0`
(adb root and su are unavailable on the Play "user" image; cmd alarm set-time is not, and it moved the wall
clock - R233: the subject WAS moved, verified by `adb shell date` at each state). Measured effects, across four
clock states (real 2026-10-01, +8 days, 2027, 2020):

- dayDate + clientClaimedAt FOLLOW THE CLOCK, VERBATIM. A day recorded at device instant 2026-09-30T22:38 UTC
  was filed under Paris date 2026-10-01 (todayInParis) with clientClaimedAt "2026-09-30T22:38:09.736+00:00"
  (read from Room). A day recorded under a skewed clock is filed under the skewed date and carries the skewed
  instant. R216 holds: the client sends its instant verbatim; the server assigns lateness.
- R286 PENDING WARNING follows the clock. The SAME pending 2026-10-01 day showed "En attente de
  synchronisation" with NO escalation at the real clock; with the clock set +8 days (2026-10-09, tax year
  unchanged, BACKFILL_DAYS = 7) it escalated to "dont 1 jour pas encore synchronise ; la plus ancienne depasse
  7 jours et sera signalee comme saisie tardive des sa synchronisation" (OVERDUE). A fast clock makes a fresh
  day look late; a slow clock would suppress a genuinely-late warning. The forecast is a clock-dependent
  WARNING; the real flag is still the server's ("des sa synchronisation").
- THE ON-DEVICE RATE follows the clock's YEAR (taxYear). Real clock (2026) -> 28,33 % "Taux a declarer a l'AFC"
  / 40,9 % over 2026's entries. Clock = 2027 -> taxYear 2027 is empty -> "Aucune journee enregistree cette
  annee pour le moment" (THE RATE VANISHES, though the 2026 record is intact and full). Clock = 2020 -> taxYear
  2020's 262 seeded rows -> 37,50 % / 55,0 % (a DIFFERENT year's rate). So a wrong-year device clock shows the
  wrong year's rate, or none - the figure the person relies on is only as trustworthy as the device clock.
- R233 (did it observe its subject): yes - the clock was moved and verified by `adb shell date`; the effects
  were read from the rendered screen and from Room at each of the four clock states.

FINDING F8 (severity LOW) - "today" and taxYear are captured once at Activity construction and not refreshed
while the Activity lives, so a session held open across midnight (or a clock change) can misdate a recorded day.
- EVIDENCE: a day recorded in an Activity that had been launched under the 2020 clock was filed under
  2020-06-01 EVEN AFTER the wall clock was restored to 2026 (clientClaimedAt showed the restored 2026 instant,
  but dayDate followed the stale construction-time today=2020-06-01), because MainActivity.onCreate captures
  today/taxYear once and the running Activity kept them. The same mechanism means a person who opens the app
  before midnight and taps "today" after midnight, without the Activity being recreated, files the day under the
  previous date.
- WHY IT MATTERS / WHY ONLY LOW: this product's whole value is a correctly-dated, audit-defensible record, so a
  misdated day is not cosmetic. But the real-world trigger is narrow (the process must stay warm and the
  Activity not be recreated across the boundary) and it is self-correcting on the next relaunch, and a
  clock-change trigger requires a wrong device clock (itself covered above). Measured under an artificial clock
  jump; the real-midnight case is inferred from the same construction-time capture.
- WHAT IT WOULD TAKE TO CLOSE: recompute today (and re-evaluate taxYear) at record time from the clock rather
  than from a value captured at onCreate, or refresh them on Activity resume. Structural (R255).

### RESILIENCE (increment 5)

PROCESS DEATH (mid-write). `am kill` (SIGKILL) was fired immediately after a record, three times, then the app
was relaunched. NO app FATAL in logcat; the recorded day persisted; `PRAGMA integrity_check` = ok on the pulled
DB. Room/SQLite in WAL mode commits atomically, so a killed transaction rolls back whole - no partial row, no
corruption. VERDICT: process death loses no committed data and cannot corrupt the store.

STORAGE FULL. /data was filled with fallocate to 100 % (df: ~5 MB free) and the app was relaunched and driven:
it started, reached Aujourd'hui, recorded a Domicile day ("Enregistre : Domicile / En attente de
synchronisation") and recomputed the rate (28,75 %) - no crash, no error dialog, no data loss; integrity_check =
ok after. The fill file was deleted immediately and /data recovered to 33 % used. R233 CAVEAT: a true zero-byte
ENOSPC on the Room write was NOT forced - a KB-sized write still succeeds with 5 MB free, and driving /data to
literally zero risks destabilising the OS the accessibility pass needs; what is measured is that the app
tolerates a nearly-full disk gracefully. A genuine ENOSPC would abort the WAL transaction atomically (the same
mechanism the process-death integrity result confirms).

SERVER 500 / MALFORMED JSON.
- GET path (MEASURED): a fault-server on the debug build's endpoint (10.0.2.2:3000) returning 500 to everything
  was reached by the app's authenticated GET /api/v1/dossier?year=2026, which received 500 and was handled
  gracefully - no crash; the Releve falls back to its cached copy (R288). A real "server returns 500" on a real
  authenticated request path, on the shipping HTTP stack (UrlConnectionTransport + SessionManager).
- OFFLINE / transport refused (MEASURED): a day recorded with nothing listening on 3000 stays PENDING ("En
  attente de synchronisation"); no loss.
- POST drain under 500 / garbage (NOT reproduced on-device this session - R233): the SyncWorker drains PENDING
  rows via WorkManager (NetworkType.CONNECTED). With the INJECTED session the drain POST did not reach the
  fault-server within the observation windows (WorkManager deferral; `cmd jobscheduler run` could not target the
  rotating job id; an airplane-mode toggle and the DevRecorder "Synchroniser" did not force it either). The SAME
  HTTP stack's GET-500 WAS observed handled gracefully, and the drain POST ITSELF was proven end-to-end in the
  F4 crossaccount run (real tokens -> POST /api/v1/entries drained). The 500/garbled handling is JVM-tested:
  SyncEngine.syncBatch maps a server error or a garbled body to Retryable -> SyncWorker Result.retry(), so rows
  stay PENDING. Across EVERY fault exercised this session, no PENDING row was lost (final DB: 3592 rows, 3
  non-synced intact) and no crash occurred.
- VERDICT: nothing observed loses a recorded day or crashes the app. The write queue is durable across process
  death, a full disk, a server 500 (GET) and being offline. The on-device POST-500 drain is owed as a small
  confirmation, bounded by WorkManager scheduling on the emulator (not by any observed defect).

## PERFORMANCE (increment 5)

Measured on the seeded 3591-row / 10-year dataset (confirmed via node:sqlite: total 3591, years 2013..2026,
2026 taxYear = 195 rows -> a real rate). HOST CONDITIONS (R233): the host was under heavy memory pressure the
whole pass - free RAM 1112 MB at the start of the cold-start samples, 695 MB by the end, Android Studio (~1.9
GB) open - so the emulator VM was swapping. The APP's own memory was NOT swapped (below), so the wall-clock
timings are inflated by host swap and are reported as environment-limited, never as a clean baseline.

- COLD START (am start -> ActivityTaskManager "Displayed"): 3 samples, force-stop between - +3s340ms, +3s220ms,
  +3s265ms; MEDIAN 3.27 s. The app reaches a FULLY-RENDERED shell (the engine's 28,33 % rate, the mission
  warning, the threshold rail all painted). ENVIRONMENT-LIMITED (host swap, 695-1112 MB free); the tight
  clustering (3.22-3.34 s) is the notable part - the render is stable, the absolute number is host-inflated. A
  brief "Aucune journee" empty-state flashed before the Room flow emitted on one relaunch under swap - a load
  race (the year panel populated a few seconds later), an environment artifact, not a defect.
- ON-DEVICE ENGINE OVER A FULL YEAR (MEASURED): computeYear runs the increment-2 aggregation + calculateTelework
  over the tax year's rows on every entry change and renders at cold start - 28,33 % "Taux a declarer a l'AFC" /
  40,9 % over 2026's 195 rows, with the mission-cap warning and the forecast ("Jours restants avant 40,0 % : 28",
  "avant 49,9 % : 51,5"). The engine is <0.1 ms (FW5); no caching, recomputed live on every change.
- CALENDAR at 10-year volume (MEASURED, with a design fact): the Calendrier is SCOPED TO THE TAX YEAR - the
  back-chevron disables at January of the current year, so the 10-year seeded history is NOT browsable
  month-by-month (the render cost is bounded to <=12 months, which is WHY it stays responsive at volume). A
  fully-populated month renders with per-day kind (S/D/M), provenance underline and a per-month tally (Jan 2026:
  Suisse 10 / Domicile 6 / Mission 6 / Non renseigne 0). Month navigation (dumpsys gfxinfo): 173 frames, 50th
  percentile 44 ms, 90th 73 ms - responsive; 95th 650 ms / 99th 1200 ms are host-swap stalls. No crash across
  the traversal. The full 3591-row dataset feeds the engine (above); the calendar view itself is year-bounded.
- MEMORY (dumpsys meminfo, MEASURED - independent of host swap): holding 3591 rows, TOTAL PSS ~82 MB (RSS ~205
  MB), TOTAL SWAP PSS 80 KB - the app itself is NOT swapped (Java Heap ~19 MB, Native ~14 MB); ~96 MB PSS after
  extended navigation. A modest, healthy footprint at 10-year volume.
- R233 (did it observe its subject): cold start read from the "Displayed" log; the engine and calendar from the
  rendered screen; memory from meminfo - each names its instrument. Cold start is caveated environment-limited;
  memory and the engine/calendar renders are clean app-local measurements.

## CODE QUALITY (increment 6, code-quality half)

MEASURED BY A ZERO-JVM TEXT SCAN (R254). The emulator cannot boot on the audit machine (see UNEXAMINED /
handoff) and every heavy JVM step (detekt, ktlint, the test suites) thrashes at ~2.5 GB free, so this half was
measured by text analysis only, with each result verified by eye. The scanner is UNTRACKED
(android/scripts/an-audit-codequality.mjs, beside the other AN-AUDIT drive scripts) so this commit is doc-only
(R132 carve-out). Four dimensions, each with its instrument's blind spots named (R233):

DUPLICATION (Kotlin <-> TypeScript, OUTSIDE the fixture-bound calc engine).
- INSTRUMENT: enumerated every self-declared port from its header (grep "port of web" / "ports web" over
  main Kotlin -> ~34 headers). Tie-status was then determined the ONLY way that distinguishes a real
  drift-reddening tie from a comment: does the port's TEST perform a runtime read of the web source or a
  shared fixture (the WireContractParityTest idiom - File(repoRoot(), "web/..."). readText())? The read census
  (grep .readText across the test tree, then the web/fixtures path each targets) was VALIDATED by opening seven
  candidates (DatesTest, NumbersTest, NumbersExhaustiveTest, ZonesTest header, RailGeometryTest header,
  MetricCopyTest, StatusesTest) - every one with zero reads hand-asserts its values and only NAMES its web
  source in a comment. A first, coarser grep that matched the path anywhere reported MetricCopyTest/StatusesTest/
  AuthServerCodeTest as "tied"; opening them corrected that to comment-only - the audit's own R233/R252
  discipline applied to its headline duplication claim.
- MEASURED RESULT: the runtime cross-tree read-tie (a test that goes RED the moment the two languages drift)
  exists on exactly two surfaces: (1) the entry-enum vocabulary and the batch limit, read from
  web/lib/entries/schema.ts by WireContractParityTest and BatchLimitParityTest; (2) the fixture-bound engine,
  aggregation, lateness, rate and denominator, read from fixtures/*.json by the calc/dossier conformance suites
  - which is the area the prompt legitimately excludes. dossier/Aggregate.kt IS in this tied bucket
  (AggregationConformanceTest reads the shared fixture), so it is not a finding.
- FINDING F5 (severity LOW): every OTHER self-declared Kotlin port of a web TS module is defended by a
  hand-copied behavioral or codepoint test that names its web source in a COMMENT but does not read it, so
  cross-language drift is not mechanically caught. The untied set found: fr/format/Dates.kt (port of
  web/lib/ui/core/format/date.ts, DatesTest), fr/format/Numbers.kt (number.ts, NumbersTest/NumbersExhaustiveTest),
  design/ZonesTest's zones port (zones.ts), design/rail/RailGeometry.kt (ui/core/rail/geometry.ts,
  RailGeometryTest), fr MetricCopy (fr/metrics.ts, MetricCopyTest), fr Statuses (fr/statuses.ts, StatusesTest),
  and the auth server-code port (auth/bearer.ts, AuthServerCodeTest - classified from the read census, not
  opened). A further remainder is named by a port header but referenced by NO parity test at all:
  fr/rates.ts, fr/rail.ts, ui/core/period.ts, ui/core/zone-tokens.ts, dossier/service.ts,
  releve/print/page.tsx, and the four React component ports (ThresholdRail.tsx, ZoneBadge.tsx, RateDisplay.tsx,
  MetricTile.tsx) - UNEXAMINED individually beyond "no runtime tie found".
  - WHY ONLY LOW: the highest-drift-risk surface, the enum vocabulary the server can extend unilaterally, IS
    read-tied; the untied ports carry values frozen by SPEC 6.4 (Swiss dots, the "a" separator), by the wire
    contract (R187 auth codes) or by copy the two products render differently anyway; and the hand-copied tests
    are genuinely rigorous about what they DO assert - StatusesTest caught two invisible-character defects
    (U+00A0 vs U+0020, U+2019 vs U+0027) by a one-time byte diff at authoring. The residual risk is a
    SPEC-frozen value moving on the web side with the Kotlin port left behind and every Kotlin test still green.
  - WHAT IT WOULD TAKE TO CLOSE: extend the WireContractParityTest read idiom (or the shared-fixture idiom) to
    the formatting and copy ports - have DatesTest/NumbersTest/StatusesTest read their web counterpart at
    runtime the way WireContractParityTest reads schema.ts - or accept the ports as SPEC-derived and record the
    decision. Structural (R255); an AN14/AN15 item.

DEAD CODE.
- INSTRUMENT: a reference census over main Kotlin - top-level non-private declarations with zero references in
  main (the declaration token discounted) - producing a SHORTLIST that was then hand-verified by reading each,
  never cited by count. The census is BLIND to reflection, the Android manifest, the src/debug and dev source
  sets, generated code and Compose @Preview; a zero-ref name is a candidate to read, not a finding. The
  demonstrated manifest blind spot: CallbackActivity came up zero-ref and is CORRECTLY alive (the App Link
  callback, invoked by the framework via its intent-filter - not dead).
- MEASURED RESULT: six shortlist names, hand-verified. CallbackActivity - alive via manifest (above).
  detectionPlaceholder() - a documented placeholder ("a real function replaces it at AN6"), referenced nowhere,
  deliberate scaffolding. exportFieldRun (detection/FieldExport.kt) and isInWorkingWindow
  (detection/WorkingWindow.kt) - referenced only by their own unit tests, never by main. MAX_NOTE_LENGTH
  (data/sync/EntriesWire.kt) - declared in the main wire file but consumed only by the src/debug seeder and
  tests; the production wire builder does not enforce it (the server does, and the client sends verbatim -
  defensible). HYSTERESIS_SIGNIFICANT_MINUTES (detection/Tally.kt) - a genuinely unused non-private const val
  (its sibling HYSTERESIS_PROVISIONAL_MINUTES is consumed in the same file); because detekt's UnusedPrivate*
  rules are private-only, a non-private unused const escapes the gate - a real, if trivial, gap the census
  caught. detekt runs buildUponDefaultConfig with only MagicNumber/MaxLineLength/FunctionNaming overridden and
  the gate is green, so the default unused-PRIVATE-member rules hold; this const is outside their scope.
- FINDING F6 (severity LOW): the on-device DETECTION pipeline ships in the release APK (R280) and is
  unit-tested, but is NOT reachable from any production UI path. The only non-test importer of
  ch.monreleve.app.detection in a shipping source set is the exported dev.DetectionReplayActivity - which is
  itself F1 (a dev activity exported in release). No production code writes the Tally table (TallyDao exists;
  no non-dev, non-test writer). This is forward-staging for AN6, not rot - but it is the audit-relevant edge of
  F2: the shipping build declares ACCESS_FINE_LOCATION and bundles+tests a location-consuming detection feature
  that NOTHING a normal user can reach uses, which is exactly the shape Play review scrutinises (a permission
  claiming a feature the UI does not expose, R282).
  - WHAT IT WOULD TAKE TO CLOSE: either wire detection into a production surface before release, or defer the
    detection code AND ACCESS_FINE_LOCATION together to the task that ships the feature (AN6+), so the manifest
    claims only features this build exposes; and delete or consume HYSTERESIS_SIGNIFICANT_MINUTES. Structural
    (R255); ties to F1 and F2.

THE FIVE LARGEST FUNCTIONS.
- INSTRUMENT: block-bodied functions only, measured by brace-span after scrubbing comments and string/template
  literals; the top five were each opened and the span confirmed by eye. One scanner artifact noted: the entry
  "DrawScope at design/rail/ThresholdRail.kt:183" is the regex capturing the RECEIVER of an extension function,
  not a function named DrawScope - excluded from the five.
- MEASURED RESULT: NO FINDING. The five largest are each long for a structural reason, not tangled logic:
  1. railGeometry (design/rail/RailGeometry.kt:161, 118 lines) - a pure RailData -> geometry transform, already
     @Suppress("LongMethod","CyclomaticComplexMethod"); straight-line SVG layout math feeding one constructor,
     no branching depth. The length is inherent and the author annotated the deliberate choice.
  2. calculateTelework (calc/Calculate.kt:30, 76 lines) - the engine's public entry point; a linear
     validate -> denominator -> mission cap -> waterfall -> assemble pipeline, ~40 of its lines a single
     named-argument TeleworkResult(...) assembly. Engine, conformance-tested.
  3. warningsFor (calc/Warnings.kt:12, 72 lines) - engine; the span is dominated by regulatory-citation
     comments (each threshold's legal basis), the executable body a flat guard-and-append list one level deep.
  4. onCreate (MainActivity.kt:110, 68 lines) - the composition root; length is dependency wiring (no DI
     framework, by design) plus the top-level nav when-branch, not logic.
  5. ParametresScreen (ui/screens/parametres/ParametresScreen.kt:49, 60 lines) - a declarative Compose tree
     already decomposed into named sub-composables (CantonField, DataSection, AccountSection, ...) plus
     dialog-hosting ?.let blocks; low complexity.

RANDOM 20-TEST SAMPLE (R133 - could each actually fail?).
- INSTRUMENT: population 164 @Test functions (159 src/test + 5 androidTest), drawn with a deterministic
  mulberry32 shuffle, seed 20260930 (recorded so the draw reproduces). Verdicts are READ-BASED - does the
  assertion bind to its subject, and would a plausible product mutation flip it - NOT mutation-proven: each
  mutation would need a Kotlin edit and a JVM suite, which this RAM-starved, zero-JVM session cannot run. The
  weaker claim is written as weaker (FW30's census caveat form). One sampled test is androidTest (instrumented)
  and is emulator-blocked to run here.
- RESULT: 20 of 20 CAN fail (no dead tautology like FW30's params/schema.test.ts). The texture: seven are
  paparazzi bitmap baselines (host JVM) that CAN fail on any pixel drift but certify STABILITY, not CORRECTNESS
  (FW13/R135 - they render distinct states/configs, no redundant pair in the sample); two are soft (below); two
  share one structural gap (F7); one is not runnable here. The 20, with verdict:
  1. androidTest data/local/MonReleveMigrationTest.kt:29 migratesFromVersion1ToVersion2 - CAN FAIL:
     runMigrationsAndValidate checks the v2 schema, not merely no-throw. NOT RUN (androidTest, emulator-blocked).
  2. account/ErasureCensusTest.kt:76 everyExemptionStatesWhyItIsNotAccountData - CAN FAIL but SHALLOW: asserts
     reason.length > 20, a PROXY for "states why", not the reason's truth; a 21-char boilerplate passes. Same
     shape as FW30's schema.test.ts finding (name promises meaning, code measures string length).
  3. data/local/WireContractParityTest.kt:59 absenceReasonsMatchTheServer - CAN FAIL, strong: reads schema.ts,
     order-exact; a missing file or array throws rather than passing, so it cannot pass vacuously.
  4. data/repo/EntryRepositoryTest.kt:57 clientClaimedAtIsInTheFormatTheServerAccepts - CAN FAIL, strong: a
     strict ISO-instant-with-offset regex bound to the server's zod .datetime({offset:true}) contract.
  5. design/ComponentsScreenshotTest.kt:152 dayCellSplit - paparazzi; CAN FAIL on drift (split half-day cell).
  6. design/ComponentsScreenshotTest.kt:196 confidenceTierLow - paparazzi; CAN FAIL on drift (LOW badge; MEDIUM/
     HIGH siblings cover the variants).
  7. design/RadiusTest.kt:15 everyDocumentedValueIsExact - CAN FAIL, strong: exact dp value per token (the value
     IS the assertion, R171).
  8. design/RadiusTest.kt:50 theObjectDeclaresNoFieldBeyondTheMapAndTheNineAccessors - CAN FAIL, strong and
     exemplary: a Java-reflection field census that closes the "tenth token typed directly into the object"
     evasion the other two Radius tests would miss.
  9. detection/ClassificationTest.kt:26 insideOutsideAndBuffer - CAN FAIL, strong: three real points (Bern
     INSIDE, Lyon OUTSIDE, a border vertex BUFFER) against the bundled Switzerland polygon.
  10. detection/ClassificationTest.kt:33 classifyFixKeepsTheSideAndTheTimestampAndNoCoordinate - CAN FAIL on the
     two things it asserts (classification, timestamp); the NAME's "AndNoCoordinate" is NOT asserted in the body
     - it is true by TYPE CONSTRUCTION (ClassifiedFix has no coordinate field), so the name overclaims what the
     test verifies. Soft.
  11. detection/ProposalTest.kt:51 aThinnerOrBufferHeavyDayIsMedium - CAN FAIL, strong: a tier boundary, fenced
     from both sides by the HIGH and LOW sibling cases.
  12. fences/FencesTest.kt:91 calcImportsNothingFromAndroidOrOtherProjectPackages - CAN FAIL today; but NO
     vacuity guard (see F7).
  13. fences/FencesTest.kt:283 everyCardInUiIsThemedWithExplicitShapeAndElevation - CAN FAIL today (strengthened
     against a spelled-out-default evasion, documented); same no-vacuity-guard gap (F7) plus a name-based limit
     the test's own comment records.
  14. fences/NoBareThresholdTest.kt:107 findsFilesToInspectSoTheGuardCannotPassVacuously - CAN FAIL, exemplary:
     it asserts the scan found files (and one per scanned dir) - the presence guard FencesTest lacks.
  15. fences/NoBareThresholdTest.kt:118 noScannedFileCarriesABareForbiddenFraction - CAN FAIL, strong:
     vacuity-guarded by #14 and paired with a positive control (rulesKtDoesCarryThem - the forbidden list is
     not matching nothing).
  16. ui/screens/aujourdhui/AujourdhuiScreenScreenshotTest.kt:148 aujourdhuiEmptyLarge - paparazzi; CAN FAIL on
     drift; a fontScale=2f (200 percent text) baseline.
  17. ui/screens/onboarding/OnboardingScreenScreenshotTest.kt:69 onboardingEmpty - paparazzi; CAN FAIL on drift.
  18. ui/screens/onboarding/OnboardingScreenScreenshotTest.kt:85 onboardingFilledExactLarge - paparazzi; CAN
     FAIL on drift; distinct state+config (filled, 200 percent).
  19. ui/screens/releve/ReleveScreenScreenshotTest.kt:204 releveDefault - paparazzi; CAN FAIL on drift (COMPLIANT).
  20. ui/screens/releve/ReleveScreenScreenshotTest.kt:209 releveLarge - paparazzi; CAN FAIL on drift; same
     COMPLIANT state at 200 percent text + taller screen = the large-font accessibility baseline.
- FINDING F7 (severity LOW): FencesTest's eight fence tests have no vacuity guard. Their shared census helper
  ktFiles(subpackage) returns emptyList() for a directory that does not exist, and every fence is an ABSENCE
  assertion (no file under X does Y) - which an empty list satisfies. Today they fire (the directories are
  populated), but the day calc/ or ui/ is renamed or moved, all eight pass on zero files, silently. The sibling
  NoBareThresholdTest already shows the fix in this very package: findsFilesToInspectSoTheGuardCannotPassVacuously
  asserts the scan is non-empty (R169's presence corollary, R175's space-between). ktFiles is PRIVATE to
  FencesTest.kt, so no other file can guard it - every assertion that could is in that one file, and none does.
  - WHAT IT WOULD TAKE TO CLOSE: add one test asserting ktFiles("calc"), ktFiles("ui"), ktFiles("detection")
    are each non-empty, mirroring NoBareThresholdTest:107. Small and provable inside its own increment, but out
    of this audit's record-only scope (R255).

## ACCESSIBILITY (increment 6, accessibility half)

MEASURED on the running emulator (density 420 = 2.625 px/dp; 48 dp = 126 px), on the seeded, signed-in shell.
INSTRUMENT + ITS BLIND SPOT (R233): `uiautomator dump` (streamed via `exec-out ... /dev/tty` - a device-path
`/sdcard/...` argument is rewritten by the Git-Bash MSYS path conversion, which is why an earlier dump read
empty; R252, the harness failed, not the app) reports each node's text, content-desc, class,
clickable/checkable/selected state and bounds - the RAW MATERIAL TalkBack speaks from. It does NOT observe
TalkBack's COMPOSED spoken utterance (how it concatenates label + role + state), its traversal ORDER, or
live-region timing; those need a sighted TalkBack session. So this measures "is there a correct label, role and
state for each control", not "what TalkBack says, in what order".

ANNOUNCEMENTS - every shell screen exposes a label, and stateful controls expose their state:
- Aujourd'hui (53 nodes): every button and line carries text (En Suisse / Domicile / Mission / Declarer une
  absence / Enregistre : Domicile / En attente de synchronisation / Missions exposees / 28,75 % / Taux a
  declarer a l'AFC ...), AND the graphical rate+rail carries a descriptive content-desc: "Taux de teletravail
  declarable 28,75 %, imposition en Suisse." - a semantic sentence, not a bare number.
- Calendrier - EXEMPLARY: each day cell has a content-desc announcing day, KIND, STATE and PROVENANCE, exactly
  as the prompt asks: "Aujourd'hui, Jour 1, Domicile, en attente de synchronisation, saisie manuelle." and an
  empty day "Jour 2, Non renseigne, sans objet."; the chevrons are "Mois precedent" / "Mois suivant".
- Parametres (52 nodes): every control labelled with helper text (Canton de travail GE; Taux d'activite (%)
  100; Methode de decompte; Decompte des journees), and the SELECTED option carries state - the active radio is
  class RadioButton checked="true" (Forfait de 240 jours; Journees entieres), so TalkBack announces it as
  selected.
- Releve: the offline state is a labelled error with a retry ("Le releve n'a pas pu etre charge. Verifiez votre
  connexion, puis reessayez." / "Reessayer") - not a blank or a crash (no server this session, so real data was
  not loaded - noted in UNEXAMINED at the data level).
- The current bottom-nav tab carries selected="true" on every screen (the active tab is announced as selected).
- ONE minor note (not a finding): the recorder buttons (En Suisse/Domicile/Mission) do not carry their OWN
  selected state; the current choice is conveyed by the adjacent "Enregistre : <kind>" line, so a TalkBack user
  still learns it.

TOUCH TARGETS - every clickable node measured from its bounds: all >= 48 dp. Recorder buttons 371x56 dp; the
full-width rows 371x48 dp; nav items 97x80 dp; the month chevrons 48x48 dp (the minimum, met exactly). No
sub-48 dp tap target found. The calendar day cells are NOT clickable (a read-only view) but ARE focusable via
content-desc, so TalkBack reaches them.

TOKEN CONTRAST IN SITU (WCAG, measured from a raw RGBA screencap - darkest vs lightest luminance pixel per text
region; observes the actual rendered token colours, light theme only, as no dark mode exists by project rule):
- Primary text navy rgb(17,24,39) on background rgb(247,248,250): 16.69:1 (AAA).
- Navy button label rgb(23,59,99) on background: 10.73:1; white rgb(255,255,255) on the navy button: 11.40:1.
- The green AFC rate rgb(21,128,61) on background: 4.72:1 - passes AA for normal text, comfortably for its large
  display size.
- Secondary/muted grey rgb(102,112,133) on background ("Taux a declarer a l'AFC", "Part de jours hors de
  Suisse"): 4.68:1 - passes AA (>= 4.5) with little margin; worth watching if the muted token ever moves.
- Every measured pair PASSES WCAG AA.

200 PERCENT TEXT - end to end at font_scale 2.0: every shell screen reflows and scrolls; no text clipped,
truncated or overlapping (headings wrap to two lines, helper cards grow, the radio selection stays visible). The
one cosmetic quirk: the bottom-nav labels wrap mid-word ("Aujourd'/hui", "Calendri/er", "Paramet/res") -
legible, not lost. This complements the committed host-JVM record: the *Large paparazzi baselines
(onboardingFilledExactLarge, aujourdhuiEmptyLarge, releveLarge and siblings) already render every screen at
fontScale=2f, so 200 % text now has BOTH a committed visual baseline AND an in-situ device confirmation.

VERDICT: strong accessibility semantics - labels, roles, state and rich per-day descriptions are all present;
touch targets meet 48 dp; token contrast meets AA; 200 % text reflows without loss. The residual is a
sighted-TalkBack pass for spoken-utterance phrasing and traversal order (the one thing uiautomator cannot
observe), and the Releve's data-level rendering (not loaded, no server this session).
