# Play release - the procedure, the declarations, the operator's steps (AN14, AN-PLAY-PACK)

Written by AN-PLAY-PACK (relay/AN-PLAY-PACK.txt, R1120-R1126) on 2026-11-20, against main at f6c51121. Everything
here that needs the Play Console account, the release (upload) key or the Firebase console is **the operator's**
(Android Ruling 2) and is marked **[OPERATOR]**. No session creates a signing key (R250).

Companion files: `docs/play-store-listing.md` (the French listing texts, R1123, read by `PlayListingTest`);
`docs/play-background-location.md` (the verdict on background location - LIKELY REFUSED, a risk the operator took
knowingly, REPORT-AN-AUTO.txt R273 - and the honest framing this file builds on).

Policy pages quoted below were read on 2026-11-20 (R273); none shows a "last updated" date:
Data safety form `support.google.com/googleplay/android-developer/answer/10787469`; account deletion
`.../answer/13327111`; background location `.../answer/9799150`; preview assets `.../answer/9866151`; product details
`.../answer/9859152`; Firebase's own disclosure `firebase.google.com/docs/android/play-data-disclosure`.

---

## 1. The release-build procedure (R1120)

**One command builds what Play takes and proves it: `./gradlew :app:playRelease`.** It depends on every
built-artifact check, and it refuses to start on a tree that is not exactly its commit.

| What `:app:playRelease` does | Where it is enforced |
|---|---|
| Refuses to START unless `git status --porcelain --untracked-files=all` at the repository root is empty, and no ignored file sits inside `android/app/src` or `android/shared/src`; names every dirty path | `android/app/build.gradle.kts`, the `whenReady` guard after `playRelease` (A2's Q2) |
| Builds the bundle and checks the BUILT `.aab`: its `META-INF/version-control-info.textproto` names `git rev-parse HEAD` (R171); its protobuf manifest declares INTERNET and exactly the variant's location permissions; it carries the R8 mapping (`BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map`) | `checkReleaseBundle` (A2's Q3), also in `:app:gate` |
| Checks the BUILT release APK: names HEAD; exactly the variant's location set; no `dev.*` component; FCM client only (no analytics/crash SDK, auto-init off); cleartext nowhere; no debug injection; the `/v1` wire survives R8; every runtime dependency attributed | `checkReleaseVcsInfo`, `checkReleaseLocationPermissions`, `checkReleaseNoDevComponent`, `checkReleasePushManifest`, `checkReleaseCleartext`, `checkReleaseNoDebugInjection`, `checkMinifiedWireContract`, `checkLicences` |
| Prints the bundle's path, size and sha256, the variant, whether push is configured, whether it is signed - never a Firebase or signing value | `playRelease`'s `doLast` |

The two location sets come from ONE definition (`releaseLocationPermissions` at the top of
`android/app/build.gradle.kts`): `{ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION}` for the detection release,
none for `-PmanualOnly=true` (section 4). Both checks require INTERNET in the same read first, because an empty set
is also what an empty dump would give (R133).

### The steps

1. **A fresh worktree of the commit to release** (the main checkout carries untracked operator files, and the
   refusal will name them):

       git fetch origin
       git worktree add C:/wt/release-<shortsha> <sha>
       cd C:/wt/release-<shortsha>/android

   With `ANDROID_HOME` set (a worktree has no `local.properties`). Raise `versionCode` in
   `android/app/build.gradle.kts` by one IN A COMMIT before every upload after the first (Play refuses a code it
   has already seen; the first upload is 1).

2. **The gate, WITHOUT any release value:** `./gradlew :app:gate` -> `BUILD SUCCESSFUL`. Not with the FCM values:
   `PushConfigTest` asserts the gate's build carries none (A8), so the gate and the release are two commands.

3. **[OPERATOR] The release, with the values on THIS command only** (never `~/.gradle/gradle.properties`, never a
   persistent environment variable - A8, Android Ruling 14):

       ./gradlew :app:playRelease \
         -PRELEASE_STORE_FILE=<path to the upload keystore> -PRELEASE_STORE_PASSWORD=... \
         -PRELEASE_KEY_ALIAS=... -PRELEASE_KEY_PASSWORD=... \
         -PFCM_ANDROID_PROJECT_ID=... -PFCM_ANDROID_APPLICATION_ID=... \
         -PFCM_ANDROID_API_KEY=... -PFCM_ANDROID_SENDER_ID=...

   The four FCM values are A8's (REPORT-AN-FCM-CLIENT.txt, WHAT THE OPERATOR MUST SUPPLY): from the Firebase
   console of the project the server's FCM_PROJECT_ID names, Android app `ch.monreleve.app`. **A release built
   WITHOUT them is still a valid release: push is unavailable** (the app runs as before; `playRelease` prints "push:
   NOT configured"). Three of four is NOT configured, by design. A `-P` value is visible in the shell's history;
   environment variables of the same names, set for the one command and removed after, are the alternative the
   build also reads.
   `-PmanualOnly=true` added to the same command builds the manual-only fallback (section 4).

4. **[OPERATOR] What to upload:** `android/app/build/outputs/bundle/release/app-release.aab`, signed by the upload
   key during step 3 (`playRelease` prints "signed: yes"). Play App Signing re-signs it with the app-signing key Play
   holds. **The mapping file needs no separate upload**: it is inside the bundle, and `checkReleaseBundle` fails
   when it is not. Keep with the release record: the printed sha256, the HEAD it names, and
   `android/app/build/outputs/mapping/release/mapping.txt` (how a reported stack trace is read; there is no crash
   SDK, SPEC D32).

5. Remove the worktree afterwards (`git worktree remove`), after checking it has nothing uncommitted (R392).

---

## 2. Data safety, traced to code (R1121; AN14 AC2)

Play's definitions (answer/10787469): "**'Collect' means transmitting data from your app off a user's device**",
including by libraries and SDKs; "**'Sharing' refers to transferring user data collected from your app to a third
party**", and a service provider processing data on the developer's behalf is not sharing; data "only processed
locally on the user's device and not sent off device" is not declared. What leaves the phone is the `/api/v1`
contract (`docs/api-v1.md`), plus what the Firebase SDK sends to Google.

Each row names what ENFORCES the answer, not the intention. A row that cannot be traced is a question (section 2.2),
never a guess.

| Play data type | Answer | What, exactly | Enforced by |
|---|---|---|---|
| **Location - Precise location** | NOT collected, not shared | The fix is classified on the phone against the bundled border polygon and discarded; no coordinate is stored, logged or sent (D18). Holds ONLY while D18 holds | `android/app/src/main/kotlin/ch/monreleve/app/detection/LiveLocation.kt` (the coordinate's two reads go straight to `classify`); `CoordinateConfinementTest` (the type leaving classification holds no coordinate); `fences/FencesTest.kt` (no coordinate name escapes `detection/`); `RoomSchemaContractTest` (no coordinate column); server: `web/lib/entries/no-coordinates.ts` `findLocationKeys`, refused as `coordinates_refused` by every `/api/v1` write route (`entries`, `me`, `devices`, ...), `web/tests/unit/entries/no-coordinates.test.ts`, `web/tests/db/privacy-claims.test.ts` "CLAIM (R325)" |
| **Location - Approximate location** | **QUESTION Q-DS1** (section 2.2) | A confirmed day's `kind` (`CH` / `HOME`, ...) with `provenance` `DETECTED_CONFIRMED` and `detectedKind`/`detectedAt` - a per-day, country-level conclusion | `docs/api-v1.md` fields:write; `web/prisma/schema.prisma` `Entry` |
| **Personal info - Email address** | Collected, required, not shared. Purposes: Account management, App functionality (the sign-in code) | `User.email` | `web/prisma/schema.prisma` `User.email`; the sign-in routes under `web/app/api/v1/auth/`; mail sent by the service provider named on `/confidentialite` |
| **Personal info - Name** | Collected, required, not shared. Purpose: App functionality (the holder printed on the relevé) | `User.name`, asked at onboarding (step NOM) | `web/prisma/schema.prisma` `User.name`; `android/shared/.../settings/ReleveCompleteness.kt` (NAME is a releve field) |
| **Personal info - Other info** | Collected, required, not shared. Purpose: App functionality | The canton, the employment rate, the day-count method, the granularity, the activity start date; the reminder time and opt-in; the logging mode and the date detection consent was given | `web/prisma/schema.prisma` `User` (canton, employmentRate, denominatorKind, exactTotalWorkDays, granularity, activityStartDate, reminderTime, reminderEnabled, loggingMode, detectionConsentAt); the `fields` table of `PATCH /api/v1/me` in `docs/api-v1.md` |
| **App activity - Other user-generated content** | Collected, required, not shared. Purpose: App functionality | The recorded days: date, portion, kind, absence reason, the free-text note (500 characters at most), provenance, what detection proposed and when, the client's claimed time; the server's receipt timestamps; the append-only history of every change | `docs/api-v1.md` fields:write; `web/prisma/schema.prisma` `Entry`, `EntryEvent` (append-only, guarded by a trigger) |
| **Device or other IDs** | Collected, OPTIONAL, not shared. Purpose: App functionality (the daily reminder) | The FCM registration token (`Device.fcmToken`, with `platform` and `appVersion`), sent only for a signed-in person who turned the reminder on and granted notifications, in a build carrying the Firebase values. Firebase Installations sends Google a per-installation id (FID) to obtain it - Firebase's own disclosure: "Generates and collects a per-installation identifier (FID)"; Play names "Firebase installation ID" as an example of this type | `android/app/src/main/kotlin/ch/monreleve/app/push/PushRegistration.kt` (the conditions), `push/PushRuntime.kt` (no Firebase without the four values), `PushConfigTest`, `checkReleasePushManifest` (auto-init off: no token until asked); server `web/app/api/v1/devices/route.ts`, `web/tests/db/devices-route.test.ts`, `web/tests/db/privacy-claims.test.ts` "CLAIM: a notification token" |
| App info and performance (crash logs, diagnostics) | NOT collected | No crash, analytics or measurement SDK is in the release | `checkReleasePushManifest` (fails on any analytics/measurement/crash component in the BUILT APK); `checkLicences` (every runtime dependency is named); SPEC D32 |
| Files and docs | NOT collected | The PDF/CSV/JSON exports are produced by the server from the data above and handed to the person's own share sheet (a user-initiated action); the phone writes them to its private cache only | `AndroidManifest.xml` FileProvider (`exports/` only); `web/app/api/v1/export/*` |
| All other types (financial, health, messages, photos, audio, calendar, contacts, web browsing, installed apps, search) | NOT collected | The app has no permission or API for any of them | `checkReleaseLocationPermissions` / the release manifest: INTERNET, the two location permissions, POST_NOTIFICATIONS only |

**Is all user data encrypted in transit? YES.** The release reaches `https://monreleve.ch` only
(`API_BASE_URL` in the release build type) and permits cleartext nowhere (`src/release/res/xml/network_security_config.xml`,
`checkReleaseCleartext`); FCM traffic is Google's ("Firebase encrypts the data in transit using HTTPS"). The server's
TLS termination is the hosting's, not this repository's (the operator's Coolify proxy).

**Can users request deletion? YES, in the app**: Paramètres -> Supprimer mon compte -> `POST /api/v1/account/delete`
(`web/lib/account/delete.ts`, `web/tests/db/account-delete.test.ts`, `web/tests/db/privacy-claims.test.ts` "CLAIM 9":
the account, the days, their history and the devices are erased; the FCM token row goes with the account by cascade).
On the phone, every session ending (sign-out, server-ended, deletion) invalidates the token and wipes the local store
(`auth/SessionEndSeam.kt`, `SessionEndSeamTest`, `ErasureCensusTest`). The **web link** Play also requires is
**QUESTION Q-DS2**.

### 2.1 What the form is answered from

Answer "Yes" to "Does your app collect or share any of the required user data types?", then the rows above.
"Shared": none (Google, for FCM, and the mail provider act as service providers). "Processed ephemerally": no for
every collected type (each is stored).

### 2.2 Questions this section cannot answer from the code (the operator's)

- **Q-DS1 - approximate location.** Play: "**User or device physical location to an area greater than or equal to 3
  square kilometers**". A confirmed day sent as `CH` or `HOME` is a statement of where the person worked that day, at
  country level; in automatic mode it carries `DETECTED_CONFIRMED` and `detectedKind`, i.e. it was derived from the
  phone's location before the person confirmed it. `docs/android-skills.md` 7.2 and PARKAN-32 classify detection as
  "Case 1, not collected" because no coordinate leaves the phone - true of the coordinate; silent on the
  conclusion. `tasks/todo.md` AN14 says "location collected but not stored or shared". The safer reading
  (never claim less than the record supports) declares Approximate location COLLECTED, not shared, App
  functionality; the narrower reading declares it under Other user-generated content only. Precise location is not
  collected under either.
- **Q-DS2 - the account-deletion web link.** Play (answer/13327111): an app that enables account creation must
  "provide a web link resource where users can request app account deletion" and give it in the Data safety form;
  the page must work "without sending the user back to the app". `/confidentialite` today says the deletion is done
  in the app "lorsqu'elle sera disponible" (`PRODUCT_STATE.appExists` is false) and that the person may write to the
  contact address. A web route or a published request path is a web change outside this task.
- **Q-DS3 - the server's request logs.** Whether the hosting's proxy or the server logs keep client IP addresses
  (which Play counts as inferred location) is not traceable in this repository.

---

## 3. The background-location declaration (R1122)

Play's form (answer/9799150): Play Console -> App content -> Sensitive app permissions -> Location permissions. It
asks "What is the main purpose of your app?", "Why does your app need access to the location in the background?",
for **one** location-based feature only ("The inclusion of multiple features will result in an app's rejection"),
and a link to a short video (recommended 30 seconds or shorter; YouTube preferred, a Google Drive MP4 accepted)
showing "The feature being activated from the background", "The prominent in-app disclosure dialog" and the
"Runtime prompt". Written in ENGLISH, the language Play's reviewers read; the French equivalent is the in-app
disclosure (`DisclosureCopy.kt`). The framing is `docs/play-background-location.md`'s, not re-derived and not
strengthened.

**Main purpose of the app:**

> Mon Releve keeps the register of a cross-border worker's working days (worked in Switzerland, at home in France,
> on mission, absent), timestamped by our server on receipt, and computes from them how many telework days remain
> before the French tax threshold and the social-security threshold. Its output is the person's annual telework
> statement (PDF/CSV).

**The one feature that needs background location: automatic day detection (beta, opt-in).**

> Automatic day detection determines, without storing any coordinate, whether each working day was spent in
> Switzerland or at home - which is the fact the annual statement is built from. With the person's opt-in, the app
> checks the phone's location four times during the working hours the person declared, including while the app is
> closed, because a working day is spent away from the phone screen. Each fix is compared ON THE PHONE with a
> bundled Swiss border polygon and immediately discarded: no coordinate, route or history is stored, logged or
> sent; our API refuses any payload carrying a coordinate. In the evening the app proposes "in Switzerland" or "at
> home" for the day, and nothing is recorded until the person confirms it.

**Why it cannot work without background access:**

> The checks have to happen during the working day, when the person is at work and the app is closed; a
> foreground-only grant would see the phone only when the person opens the app, typically in the evening at home,
> and would propose the wrong country. Detection is optional: people who do not grant background location record
> their days manually, which produces the same statement.

**Video:** recorded on the emulator (labelled "emulator API 36"), `adb shell screenrecord`, from the commit named in
REPORT-AN-PLAY-PACK.txt; path, sha256 and duration there; NOT committed (C:/wt/play-assets/). **[OPERATOR]** uploads
it (YouTube unlisted or Google Drive) and pastes the link into the form. What it shows, in order, and what it cannot:
see the report's R1122 section.

**Prominent disclosure** (Play: "must appear before your app's location runtime permission", must name "location"
and "background" / "when the app is closed", and must be "within the app itself as well as in the app description
and website"): in the app, `ui/screens/disclosure/DisclosureScreen.kt` with `fr/DisclosureCopy.kt`, shown before
the system prompt from onboarding's mode step and from Paramètres; in the description, the detection paragraph of
`docs/play-store-listing.md`; on the website, `/confidentialite` (`web/lib/fr/confidentialite.ts`, R325). The
disclosure deliberately does not copy Google's "collects location data" template: the app does not transmit a
coordinate (`docs/play-background-location.md`, THE DISCLOSURE).

---

## 4. The manual-only fallback (R1124)

**If Play refuses background location, the release is one property away: `-PmanualOnly=true` on the same
`:app:playRelease` command.** It produces a release whose manifest declares NO location permission and whose app
shows no detection entry point:

- **The manifest:** every variant merges `android/app/src/manualOnly/AndroidManifest.xml`, which only removes
  `ACCESS_FINE_LOCATION` and `ACCESS_BACKGROUND_LOCATION` (`tools:node="remove"`). `ManualOnlyOverlayTest` (in the
  gate) keeps it equal to src/main's location set, both directions.
- **The entry points, derived from the manifest (one fact, R181):** `detection/DetectionAvailability.kt` reads the
  permissions the installed package requests. Without both, onboarding does not ask its mode step
  (`onboarding/ManualOnlyOnboarding.kt`, `ManualOnlyOnboardingTest`) and Paramètres shows neither the detection switch
  nor « En savoir plus » (`ParametresActions.onToggleAutoDetection` is null; baseline
  `ParametresListScreenshotTest_parametresListManualOnly`).
- **What stays inert by construction:** a server that says `AUTO_DETECT` is restored as manual, because the
  permission can never be granted (`detection/LoggingModeRestore.kt`, `LoggingModeRestoreTest`); the sampler takes
  no fix without the permission (`LiveLocation.kt`).
- **The checks, each variant's exact set:** `checkReleaseLocationPermissions` (APK) and `checkReleaseBundle` (.aab)
  assert `{}` with the property and `{FINE, BACKGROUND}` without it.
- **The listing:** `docs/play-store-listing.md` minus its detection paragraph (`PlayListingTest` asserts nothing
  outside that paragraph names location or detection); leave out any screenshot showing detection.
- **The declaration:** none (no restricted permission is declared). Data safety: the precise-location row stays
  "not collected"; Q-DS1 becomes moot for new days (no day is `DETECTED_*`).
- **Pending A7** (AN-MANUAL-REMINDER, not merged at the time of writing): it adds the Paramètres reminder switch in
  both modes and the 19:00 fallback reminder; neither collects new data, and neither is a detection entry point.

---

## 5. AN14b - the operator's Play Console steps (R1125)

Every step is **[OPERATOR]** unless marked otherwise; none can be done by a session (Android Ruling 2).

1. **Create the developer account** (Google Play Console), complete identity verification, pay the registration fee.
2. **Create the app:** All apps -> Create app; name « Mon Relevé » (docs/play-store-listing.md), default language
   French (France); App; Free; accept the declarations.
3. **Create the upload key** on the operator's own machine, never in the repository and never by a session (R250):
   `keytool -genkeypair -v -keystore <outside the repo>/upload.jks -alias upload -keyalg RSA -keysize 2048
   -validity 10000`. Keep the keystore and passwords in the operator's password manager.
4. **Supply the Firebase values** (A8): Firebase console -> the project FCM_PROJECT_ID names -> add the Android app
   `ch.monreleve.app`; take the four values (REPORT-AN-FCM-CLIENT.txt). Restrict the API key to the app (package +
   the app-signing SHA-1 from step 7) and to the Installations and FCM APIs. Optional: skip, and the release ships
   with push unavailable.
5. **Build the release:** section 1, steps 1-4. Record the printed sha256 and HEAD.
6. **Set up the app's content (App content page)** before the first review:
   - Privacy policy: `https://monreleve.ch/confidentialite`.
   - App access: sign-in by e-mail code - give the reviewers a way in (a test address whose code they can receive,
     or instructions); decide how (QUESTION in the report).
   - Ads: the release contains no ad SDK (`checkLicences` names every runtime dependency;
     `checkReleasePushManifest` refuses analytics/measurement components). The content-rating questionnaire, the
     target audience and the remaining declarations are the operator's answers; nothing in the code decides them.
   - Data safety: section 2 (and Q-DS1/Q-DS2 decided first).
   - Sensitive app permissions -> Location permissions: section 3, with the video link. Not needed for the
     manual-only build.
7. **Play App Signing:** on the first upload, let Google generate and hold the app-signing key (the default). Then
   Setup -> App signing: copy the **app-signing** SHA-256 fingerprint into the server's
   ANDROID_SHA256_CERT_FINGERPRINTS (assetlinks, so the sign-in link opens the app; PARK4-2: the SIGNING key, not the
   upload key) and, for step 4, its SHA-1.
8. **Internal testing first:** Testing -> Internal testing -> Create release -> upload `app-release.aab`; release name
   from versionName; notes in French. Add testers (an e-mail list), share the opt-in link, install from Play, and
   check: sign-in, a recorded day, an export. Internal testing is not reviewed for the permission declaration in the
   same way; do not read its availability as an approval.
9. **Closed testing (AN14 AC3):** Testing -> Closed testing -> a track; same bundle promoted or a new upload with
   versionCode + 1; add at least one external tester; they complete sign-in, a week of logging and a PDF export.
   New personal developer accounts may also have to meet Play's minimum closed-test requirement before production
   access - read it in the Console at the time.
10. **The store listing:** Grow -> Store presence -> Main store listing: the texts of `docs/play-store-listing.md`, the
    screenshots (C:/wt/play-assets/, 2 to 8 phone screenshots), the 512 x 512 icon, the 1024 x 500 feature graphic
    (not produced by this task).
11. **The mapping file:** nothing to do - it is inside the bundle (section 1, step 4). If Play ever shows "no
    deobfuscation file", upload `mapping.txt` from the same build on that release's App bundle explorer page.
12. **IF PLAY REFUSES BACKGROUND LOCATION:** do not argue the feature into "core". Rebuild with
    `-PmanualOnly=true` (section 4) and versionCode + 1, remove the declaration, re-submit with the listing minus its
    detection paragraph and without detection screenshots. Nothing is lost (`docs/play-background-location.md`).
13. **Production** only after closed testing (and Checkpoint G stays the human gate on leaving beta).
14. **After release:** turn on ANDROID_MINIMUM_VERSION_CODE only once a release exists to require (A4); rotate the
    FCM private key so the server's daily push runs (A8).

---

## 6. Measured on this branch (R1126)

The release APK size against the 12 MB budget, and cold start on the emulator: the values, how they were measured
and how they differ from Play's download size are in REPORT-AN-PLAY-PACK.txt, R1126. The "mid-range device"
criterion is the S9's (a human gate; an emulator figure never closes it).
