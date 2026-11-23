# iOS release - what the operator owes

IOS-AUDIT R1357 (iOS phase, I3). This is the one list of every step that needs the Apple Developer account or a real iPhone
before Mon Relevé ships on iOS. For each step it says how to do it and what proves it done. **Nothing here is done.** No
line in this file claims otherwise. A step is done only when its proof exists and is recorded in a report.

What CI already proves on the simulator is not repeated here. See REPORT-IOS-AUDIT.txt, REPORT-IOS-WALK.txt and the
ios-shared, ios-app and ios-walk workflows.

---

## 0. SHIP BLOCKER - the sign-in link voids the code (F8, iOS Ruling 18, R1392)

**First, because nothing below matters until it is decided.**

The sign-in mail carries two things in one `VerificationToken` row: a link (`/api/v1/auth/callback?token&email`) and a
six-digit code. A GET of the link deletes the row and answers a token pair as JSON. So:

- a person on iOS who taps the link lands in Safari on a JSON token pair, and their code is dead (iOS has no universal
  link yet - section 6);
- a mail scanner or a link preview that fetches the link ends the person's sign-in **and** receives a valid session.

IOS-WALK measured it 7 times out of 7: the code with no GET first gave 200, the link GET gave 200, and the code after
the GET gave 400 `invalid_code`. Nothing was tested against production.

**The options, as Ruling 18 names them. None has been chosen. The decision is the operator's:**

- **(A) A code-only mail for iOS.** The request carries the client, and iOS gets a mail with no link. This needs new
  mail copy and changes on the server and on iOS. Android is untouched.
- **(B) The app's exchange sends a header the server requires before it answers with JSON.** Every other GET gets a
  page that consumes nothing. This needs new page copy. Android ships a release first, the server accepts both forms
  for a window, and then the bare GET is refused.
- **(C) The link and the code are consumed independently**, each single-use on its own. The person's code survives a
  fetch, but a fetcher still gets a session, and the mail's "only once" copy needs rereading.
- **(D) Keep it as it is**, and make the iOS code screen tell the person not to open the link. This needs new copy.

**Proof it is done:** a decision recorded in a ruling. Then, for (A)-(C), a walk run whose R1385 line reads: the code
still accepted after a GET of the link. For (D), the code screen's copy on the walk's screenshot.

---

## 1. Apple Developer account, team and signing

- **What:** enrol (or use) the Apple Developer Program account. Record the **Team ID**. Set `DEVELOPMENT_TEAM` and
  `CODE_SIGN_STYLE: Automatic` (or a distribution certificate and profile) in `ios/project.yml`. Today the project is
  ad-hoc signed, identity `-`, no team (IOS-HOST R1211).
- **How:** in Xcode, open Settings, then Accounts, and add the Apple ID. Then put the Team ID in `ios/project.yml`. It
  is the one home of every build setting (R206). Never edit the generated project.
- **Proof:** `xcodebuild -configuration Release -sdk iphoneos archive` succeeds on a Mac with the account, and
  `codesign -dvvv` on the archived `.app` prints `TeamIdentifier=<the team>`.

## 2. The bundle identifier

- **What:** register the App ID `ch.monreleve.app` (`PRODUCT_BUNDLE_IDENTIFIER` in `ios/project.yml`) in the
  developer portal, with the capabilities the app uses: Keychain Sharing is implicit. Add Associated Domains only with
  section 6. Push Notifications is not needed, because iOS v1 is manual-only (iOS Ruling 2).
- **Proof:** the identifier is listed under Certificates, Identifiers & Profiles, and the archive in section 1 is signed
  with a profile naming it.

## 3. TestFlight

- **What:** upload the archived build and install it through TestFlight on a real iPhone.
- **Before the first TestFlight build:** section 0 decided, and section 7's onboarding check passed.
- **Proof:** the build appears in App Store Connect, is installed from TestFlight on the iPhone, and launches to
  Bienvenue. The launch screen is the plain `UILaunchScreen: {}` (ios/project.yml), so it shows the system background
  and then the app.

## 4. The App Store Connect listing and the privacy answers

- **What:** create the app record, the listing (name, subtitle, description, screenshots, support URL, privacy policy
  URL), the age rating, and the **App Privacy** questionnaire.
- **The app icon does not exist yet** (R1354): there is no `AppIcon` asset catalog under `ios/`. A submission needs
  a 1024 x 1024 opaque icon. Deriving it from the logo kit (`relay/mon-releve-logo`) needs a rasteriser that is not
  in the project. This is a QUESTION in REPORT-IOS-AUDIT.txt.
- **The privacy answers** must match what the web privacy page discloses (`DISCLOSED_RECORDS`, R206). The mapping of
  each record to Apple's data types is the operator's (QUESTION in REPORT-IOS-AUDIT.txt, R1354). The app has no third-party
  SDK, no analytics, no advertising identifier and no tracking.
- **The privacy manifest** is `ios/MonReleve/Resources/PrivacyInfo.xcprivacy` (R1354). It declares no tracking and
  one required-reason category, UserDefaults with reason CA92.1, which is the only one the app's OWN code calls (a
  grep for each API shows it).
  - The Release binary also IMPORTS `stat`, `fstat` and `lstat` (file timestamp) and `statfs` and `fstatfs` (disk
    space). This was measured by ios-app.yml's R1353 step, and the app's own code calls none of them, so they come
    from the linked libraries (bundled SQLite, the Kotlin/Native runtime).
  - Whether they need a declaration, and with which reason, is a QUESTION. Apple's upload check reports a missing
    one, so the first TestFlight upload answers it.
  - `NSPrivacyCollectedDataTypes` is not declared (see the privacy answers above).
- **Proof:** the App Privacy section in App Store Connect is filled in and "Published", and each answer is traceable to a
  `DISCLOSED_RECORDS` entry. The first upload passes without a privacy-manifest warning.

## 5. Export compliance - `ITSAppUsesNonExemptEncryption`

- **What:** the export-compliance answer. The app uses only the system's HTTPS (`NSURLSession`) and the Keychain. It
  has no cryptography of its own. **The answer is the operator's.** It is not set in `ios/project.yml` (R1354), so App
  Store Connect will ask at each upload until it is.
- **Proof:** either the key in `ios/project.yml` with the operator's ruling cited beside it, or the answer recorded in
  App Store Connect.

## 6. The universal link - AASA and Associated Domains

- **What:** iOS Ruling 3 Q2 keeps iOS code-only until this exists. It needs three things:
  - `https://monreleve.ch/.well-known/apple-app-site-association`, served with the Team ID and the bundle id, and
    withheld until both are known (R205's rule for `assetlinks.json`);
  - the `com.apple.developer.associated-domains` entitlement (`applinks:monreleve.ch`) in `ios/project.yml`, which is
    a new entitlement, and so a question for its own task;
  - the app handling the callback URL.
- **Depends on section 0:** with (B), the link that opens the app is the one path that answers JSON.
- **Proof:** on the iPhone, a tap on the mail's link opens the app (not Safari), and the AASA file is fetched with 200
  and the right `appID`.

## 7. Checks on a real iPhone (iOS Rulings 14 Q3, 16, 18 - R1347, R1393)

Each check has a step and the record that proves it. Do them on a TestFlight build.

1. **New-account onboarding past the name step.** This check comes BEFORE TestFlight is opened to anyone. Sign in with
   a new address, then go through the name, the canton (search "Genève" in the screen's own field), the rate and the
   rest, to the tabs. The walk never got past the canton step on the simulator (F2/F5).
   *Proof:* a screen recording reaching Aujourd'hui, and `GET /api/v1/me` complete on the server.
2. **The mail button.** On the code screen, "Ouvrir ma messagerie" is shown (the simulator measured `canOpenURL`
   false, so it is hidden there) and opens Mail.
   *Proof:* a screenshot of the button. R574 applies: the code fields must be empty in the shot.
3. **A real 19:00 reminder.** Opt in, leave a working day unrecorded, and wait for 19:00 local. Then TAP the reminder.
   The walk saw it delivered and gone before the tap.
   *Proof:* the notification shown at 19:00, and the tap opening Aujourd'hui. Nothing is recorded by the tap.
4. **Background sync (PARK-IF1).** BGTaskScheduler is device-only. The shipped app registers no task (R1350 removed
   the probe's keys), so today a pending day leaves the phone only at a foreground.
   *Proof:* the PARK-IF1 task's own report. Until then, record the day offline, background the app, come back online,
   and foreground it: the day goes up at the foreground.
5. **The universal link** (section 6).
6. **Release logging.** The Release build logs through IosLogger's one console function without a crash (iOS Ruling
   14 Q3: closed in the test process, confirmed here).
   *Proof:* Console.app filtered on the process while signing in, recording a day and exporting. No crash, and no code,
   token or address in any line.
7. **The export's share sheet.** Use "Exporter en PDF" on the Relevé and choose a destination.
   *Proof:* the PDF arrives and opens.
8. **The employer comparison.** Use "Comparer avec mon employeur", type a figure, see the gap, and go back.
9. **Licences.** Open Paramètres, then Licences, and come back.
10. **Accessibility** (R1355). The simulator measured three things a person on an iPhone must confirm:
    - Compose 1.7.3 syncs its tree to UIAccessibility ONLY while VoiceOver runs (F1).
    - Rows that were below the fold keep a ZERO accessibility frame after they are scrolled into view. In walk run
      45178578142 even the always-drawn bottom bar read 0/0 once the page had scrolled.
    - The labels are present on Bienvenue, the four tabs, Rythme, Prévision, Simulation and the comparison
      (IosAccessibilityLabelsIosTest). The address and code screens, onboarding, Licences, the sheets and the dialogs
      were NOT covered by that test, so check them here too.
    *Checks:*
    - With VoiceOver ON: swipe through each tab to its last row (the onboarding cantons, the Relevé's "Exporter en
      PDF", Paramètres' "Licences"). Then touch-explore those rows after scrolling: does VoiceOver land on the row
      under the finger?
    - With VoiceOver OFF, and Voice Control on, then Switch Control on: are the app's controls reachable at all? This
      is F1, a SHIP QUESTION in REPORT-IOS-AUDIT.txt.
    - Largest Dynamic Type: every screen readable. Bienvenue scales and scrolls (ios-app's launch-AX5.png).
11. **The native date picker** (R1389). Open it from Paramètres, then "Début d'activité". It must be French, opaque,
    fully drawn and reachable by VoiceOver. On the simulator the walk saw it French, opaque and in the tree. Its day
    buttons are spoken in the SYSTEM language: on the runner, "Sunday, November 1".
12. **A second sign-in that stalls on "Connexion impossible"** (F9, R1391). If it is ever seen, note the time. That
    message means no HTTP answer reached the app, or a token refresh the server could not answer. A refusal by the
    server shows a different message.

### For Android's S9 list (iOS Ruling 16)

- **Back from the employer comparison.** The system back closes the comparison onto the Relevé first, before anything
  beneath it. This is argued from composition order and not tested (no Paparazzi or JVM test composes MainShell).
