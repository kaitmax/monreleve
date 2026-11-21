# Release audit - Mon Releve (Android)

**AN15 (AN15-AUDIT, ORCH-ANDROID step A6; relay/AN15-AUDIT.txt R1130-R1136).** One question per criterion: *is this
true today, and what proves it?* The web half's shape (`docs/release-audit-web.md`) is followed, and so is its
standard: a criterion is CLOSED only on evidence produced or re-run in THIS session on the audited tip; a report from
an earlier task is a POINTER, and a criterion resting on a pointer alone says so. An emulator result never closes a
criterion that names the real phone or real people (R1130).

| | |
|---|---|
| Audited tip (code) | `f1dfac150638a2462487486bc88ec3aed918f7dc` (branch `an15-audit`, base main `60d82632`) |
| `:app:gate` | **BUILD SUCCESSFUL in 7m 13s, GATE_EXIT=0**, test floor 1562, on f1dfac15 (emulator shut down, heavy lock held) |
| `gate:changed` | GATE PASSED (base chain: typecheck, lint, test 4 274, build), GATE_CHANGED_EXIT=0, on f1dfac15 |
| `gate:clone` | see REPORT-AN15-AUDIT.txt STATUS (run before the push, R199) |
| R573 | not owed: `android/shared` unchanged since 60d82632 (`git diff --stat 60d82632..HEAD -- android/shared` empty). Last iOS run: 44834975248, success, on 9c194aeb |
| Audited | 2026-11-21 |
| Evidence (not in the repository) | `C:/wt/queue-evidence/an15-audit/` (logs, screenshots, drivers, the pulled database, both APKs) |

Provenance labels used below: **unit test** (JVM / vitest, run by a gate on the tip), **renderer** (Paparazzi
baselines), **emulator API 36** (AVD MonReleve_API36, x86_64, Google Play image), **S9** (the real Galaxy S9,
SM-G960F, API 29), **person** (a human gate). Nothing in this audit ran on the S9.

> This audit fixed nothing in product code. It added two TESTS (the identical-dossier check, R1131) and changed two
> DOCUMENTS (the Data safety row, R1135). Every other gap is a finding or a launch blocker.

---

## 1. Re-run on the audited tip (R1131)

| What | Result | How |
|---|---|---|
| Full `:app:gate` | BUILD SUCCESSFUL in 7m 13s, 270 tasks (153 executed), GATE_EXIT=0 | `./gradlew :app:gate`, log `gate-f1dfac15.log` |
| JVM unit tests | test floor OK: **1 562** observed (A5's 1 561 + this audit's ModeParityTest) | `:app:testDebugUnitTest` in the gate; `:shared:testDebugUnitTest` up to date on the same inputs (green in this session's fastCheck) |
| Screenshot baselines | `verifyPaparazziDebug` green over **163** baselines, zero tolerance (`PaparazziZeroToleranceTest`) | in the gate; none regenerated, none added |
| Release artefacts | `checkReleaseBundle OK` (the built .aab names HEAD f1dfac15, location set exactly {BACKGROUND, FINE} + INTERNET, R8 mapping inside); `checkReleaseVcsInfo`, `checkReleaseLocationPermissions`, `checkReleaseNoDevComponent`, `checkReleasePushManifest`, `checkReleaseCleartext`, `checkReleaseNoDebugInjection`, `checkMinifiedWireContract`, `checkLicences`, `lintDebug` (NewApi), `lintVitalRelease` - all executed | in the gate |
| Engine conformance (Kotlin) | `GenevaConformanceTest` 2/2 (`readsAllSixPublishedCasesSoItCannotPassVacuously`, `everyPublishedCaseProducesTheAfcResult`); `RateConformanceTest` 73/73; `DenominatorConformanceTest` 7/7; `AggregationConformanceTest` green | gate / fastCheck on the tip |
| Engine conformance (TypeScript), same fixture | `tests/unit/calc-engine/fixtures.test.ts` green (with `no-coordinates.test.ts`: 40 passed) | `pnpm exec vitest run ...`, isolated |
| One-digit divergence fails BOTH | `fixtures/geneva-cases.json` case (c) `declarableRate` 39.16 -> 39.17 (plant verified landed by `git diff`, 1 line): TS RED ("expected 39.16 to be 39.17"), Kotlin RED (`GenevaConformanceTest > everyPublishedCaseProducesTheAfcResult FAILED`); file restored byte for byte from a copy, `git status` clean | this session |
| Coordinate absence | see criterion 10 below: fences + API guard + on-device database read | gate, vitest, emulator |
| Identical dossier | see section 3 | gate (Kotlin), gate:changed (web) |

---

## 2. SPEC section 21, the Android criteria, one row each (R1130)

The web half closed its rows in `docs/release-audit-web.md` (FW29). The rows below are the ones whose subject is the
Android app, plus the re-runs AN15's own description lists (200 % text, TalkBack, baselines, the full Gradle suite,
instrumentation). A row that is the web's is not repeated.

| # | Criterion | Verdict | Evidence (this session unless marked POINTER) | Provenance |
|---|---|---|---|---|
| 1 | Six Geneva fixtures reproduce exactly, incl. 39,16 % and 4,16 % (the Kotlin engine) | **CLOSED** | `GenevaConformanceTest` 2/2 on f1dfac15, reading the SAME `fixtures/geneva-cases.json` as the web (generated FixtureJson, R206); `RateConformanceTest` 73/73 | unit test |
| 2 | Zero raw hex, radius or spacing literal outside the tokens in Android `ui/`; lint-enforced | **CLOSED** | `FencesTest` 11/11 (each fence asserts a non-empty scan, F7's vacuity guard), ktlint + detekt in the gate | unit test |
| 3 | Rail parity: the Compose rail and the web SVG rail match **pixel-for-pixel** at the same width in screenshot tests | **OPEN-DEFECT (evidence gap)** | What exists is GEOMETRY parity: `RailGeometryTest` 28/28 ports the web's `rail-geometry.test.ts` literals case for case, and `ThresholdRailScreenshotTest` holds the Compose rail's own baselines. No test renders both rails and compares pixels. Finding F2 | unit test + renderer |
| 4 | Every `ValidationError` and `Status` has French copy, exhaustiveness-tested (Android half) | **OPEN-DEFECT (evidence gap)** | `Status`: `StatusesTest` 12/12 (four statuses, codepoint-exact, census non-vacuous). `ValidationError`: the Kotlin engine defines it (`calc/Types.kt`), and no Android French copy map for it exists; whether any Android surface can display one was NOT traced in this session. Finding F3 | unit test |
| 5 | Offline log queued and synced with both timestamps (Android half; `EntryEvent` append-only is the web's, FW29) | **NOT RE-RUN** (the on-device drain; the queue CLOSED on device, the drain CLOSED on JVM only) | On the MINIFIED audit build (emulator API 36), airplane mode on: a day saved from Calendrier showed "en attente de synchronisation" and the server held nothing for it (oracle: `on 2026-11-14: []`). Its drain was NOT observed on device this session: the F4 drive ended that session server-side on purpose (section 4). The pulled database (debug build) carries both `clientClaimedAt` and the server's `firstRecordedAt` on every synced row; the drain is the gate's `SyncEngineTest` 14/14 ("aDrainMarksRowsSyncedFromTheServerRow", "aServerErrorIsNotIsolatedButRetried", ...), `EntriesWireTest` 4/4, `OrderingEvidenceTest` 2/2, `SyncWorkerResultMappingTest` 3/3. SPEC asks "proven in E2E": the on-device drain was not. POINTER for an on-device drain: docs/audit-android.md RESILIENCE | emulator API 36 + unit test |
| 6 | PDF renders A4 with the same rail and formatters (the app delivers the server's PDF) | **CLOSED** (the Android half) | Emulator API 36, audit build: Releve -> Exporter en PDF -> share sheet "releve-2026.pdf" for Camille (3 598 ms warm) and for Alex; the server's `IssuanceRecord` counts one PDF per export, per user. The PDF's A4/rail itself is the web's (FW29 criterion 12). First export on `pnpm dev` timed out at 15 017 ms (cold compile; Android Ruling 13 measured a BUILT server at 2.5-2.8 s) | emulator API 36 |
| 7 | Account export and deletion work end to end (from the app) | **NOT RE-RUN** | Not driven this session (deleting a seeded account mid-audit would have removed the F4 oracle). POINTERS: `SessionEndSeamTest`, `ErasureCensusTest` (in the gate, green), web `account-delete` / `account-export` (FW29), REPORT-AN-SESSION-END.txt | unit test (pointer for the drive) |
| 8 | Expert reviewer signed off on the reviewer cases (residence-1983 canton, part-time mid-year start) | **OPEN-HUMAN** | Nobody has reviewed anything; the app and the site say "Relecture experte : en attente". Launch blocker B9 | person |
| 9 | Both engines pass `fixtures/geneva-cases.json` identically; a one-digit divergence fails both | **CLOSED** | Section 1: both green on the fixture; both RED on the one-digit plant; restored. "Fails CI" here means fails the gates that stand in for CI while `CI_FULL` is unset (`:app:gate` runs the Kotlin suite, `gate:changed`/`gate:clone` the TS one) | unit test |
| 10 | No coordinate anywhere outside `detection/` - lint rule, API rejection test, full-database inspection after a simulated month of auto-mode use | **OPEN-DEFECT (the simulated month)**; the three legs otherwise CLOSED | LINT: `FencesTest` (2b) 11/11, `CoordinateConfinementTest` 2/2, `RoomSchemaContractTest` 6/6. API: `tests/unit/entries/no-coordinates.test.ts` green, isolated. DATABASE (emulator API 36, DEBUG build of f1dfac15 - the audit build is not debuggable, `run-as` refuses it): signed in as Camille, year synced, the mock-provider replay run with airplane mode ON; the pulled `monreleve.db` + `-wal`: 5 tables, `entry` 488 rows (437 MANUAL, 49 DETECTED_CONFIRMED, 2 DETECTED_CORRECTED), 4 576 non-null cells scanned, **zero** coordinate-shaped column, **zero** of the replay's coordinate values in any cell; logcat during the replay (67 784 bytes): **zero** coordinate values, **zero** coordinate tokens. NOT A SIMULATED MONTH: the replay computes its proposals in memory and writes no `daily_tally` row (0 rows read), and no harness produces a month of auto-mode use. Finding F4 | unit test + emulator API 36 |
| 11 | Detection battery cost <= 3 % per working day, measured on a real device | **OPEN-HUMAN** | Not measured. The S9's. Launch blocker B7 | S9 |
| 12 | Sampling-to-proposal cycle completes with the network unavailable | **OPEN-DEFECT (evidence gap)** - the replay half CLOSED offline on the emulator | Emulator API 36, debug build, airplane mode ON (`airplane_mode_on` = 1): `dev.DetectionMockReplayActivity` fed the synthetic tracks through the OS test provider and the real classify/vote path and showed per track « Proposé CH » (commute), « Proposé HOME » (telework), « Pas sûr » (strip-home, border crossing, split day, no-fix day) - `d18-replay-screen-2.txt`, `d18-replay-offline-2.png`. CAVEAT: the replay is not the scheduled `SamplingWorker` writing `daily_tally`; that half is `DetectionSamplerTest` / `AujourdhuiAutoControllerTest` (gate). The first replay attempt was VACUOUS (mock provider denied, every track « Pas sûr ») and is not counted | emulator API 36 + unit test |
| 13 | Manual mode reaches an identical dossier to auto mode from the same days - asserted by a test running both paths | **CLOSED** | Section 3 | unit test |
| 14 | Play data safety form matches section 13 line by line; background-location justification ACCEPTED | **OPEN-HUMAN** (acceptance) | The form's answers are traced to code (`docs/play-release.md` section 2, with R1135's change, section 5 here). Acceptance is Play's; the background-location verdict stands at LIKELY REFUSED (`docs/play-background-location.md`), with the manual-only fallback one property away (`-PmanualOnly=true`). Launch blockers B2, B3 | person (Play) |
| 15 | Geneva fixtures unchanged after the `RuleSet` refactor, byte for byte | **CLOSED** | `git log -- fixtures/geneva-cases.json`: last change 952c2904 (2026-09-09, "Checkpoint A recorded"), none since; the tip's blob 7546b918... equals main 60d82632's (`git rev-parse 60d82632:fixtures/geneva-cases.json`), so this session's plant left nothing; both engines reproduce it on the tip | unit test + git |
| 16 | Engine output identical with and without absence rows; a replayed `clientMutationId` produces no new event | **CLOSED** (Android half) | `AggregationConformanceTest` 9/9 ("absences change no engine figure (D28): dropping them leaves the input identical") in the gate; the replay half is server-side (FW29 criterion 22) | unit test |
| 17 | Hysteresis and buffer tests pass; the proposal card shows the tier in words and never auto-confirms | **CLOSED** | `VoteTest` 19/19, `NearBorderTest` 7/7, `ClassificationTest` 5/5, `DetectionOutcomeTest` 5/5, `AujourdhuiAutoControllerTest` 16/16 (only HIGH proposes; confirm/correct record provenance; nothing is recorded before the tap); `AujourdhuiScreenScreenshotTest` baselines hold the card's words | unit test + renderer |
| 18 | (AN15) 200 % text scale on the main screens | **CLOSED** with findings | Emulator API 36, audit build, `font_scale` 2.0: Aujourd'hui, Calendrier (switches to its list form), Releve and Parametres reflow, nothing clipped in the content (`montage-font200.png`). Two cosmetic breaks: the bottom-bar labels break mid-word (A3's N6, already post-launch) and, NEW, the Releve identity row « Méthode de calcul » breaks mid-word. Finding F6 | emulator API 36 |
| 19 | (AN15) TalkBack pass over sign-in, Aujourd'hui and the export | **OPEN-HUMAN** (the spoken pass) | Emulator API 36, audit build, Google TalkBack 16.0 ON: initial focus lands on the "Bonjour Camille" heading; the export works with TalkBack on (share sheet reached); the accessibility tree read UNDER TalkBack has **0 unlabelled actionable nodes** on six screens - welcome (1 action), sign-in address (3), sign-in code (10; the six digit fields are labelled per field, values never read, R574), Aujourd'hui (4), Releve export area (7), sign-out dialog (2) (`a11y-*.txt`). NOT DONE: what TalkBack SPEAKS. Injected navigation never reached TalkBack on this AVD by four mechanisms (`input keycombination` Alt+Right, `input swipe`, a uhid virtual keyboard as AN-TALKBACK used on the S9, the emulator console's keyboard), and Google TalkBack logs no utterance text by default. AN-TALKBACK captured Aujourd'hui's speech on the S9 (POINTER). Finding F7 | emulator API 36 (tree); person/S9 (speech) |
| 20 | (AN15) Screenshot baselines | **CLOSED** | Section 1: 163 baselines, zero tolerance, none regenerated | renderer |
| 21 | (AN15) Full Gradle suite and `bundleRelease` | **CLOSED** | Section 1 (`:app:gate` builds and checks the .aab) | unit test + build |
| 22 | (AN15) Instrumentation runs (`connectedDebugAndroidTest`) | **NOT RE-RUN** | Compiled by the gate (`compileDebugAndroidTestKotlin`); not run: it uninstalls the app and its data, and the emulator had to come back to the orchestrator's state. Android Ruling 5 already records that `SignOutPendingLargeFontInstrumentedTest` is run by no gate (post-launch) | - |

**Count: 22 criteria - 11 CLOSED, 4 OPEN-HUMAN, 4 OPEN-DEFECT (evidence gaps - none is a product defect), 3 NOT RE-RUN.** One standard throughout: a row whose SPEC wording names an end-to-end or scheduled path is not CLOSED on its unit tests plus a partial drive (rows 5 and 12).

### Product gates

All seven need real users on a published app. None is measurable before the first release: **NOT YET MEASURABLE**,
as the web audit says, not "not met".

---

## 3. The identical-dossier check (R1131; AN15 AC2; SPEC 21 row 13)

No test asserted it before this session (searched: no test compared a manual year with an automatic one). Written in
two halves because the dossier is the server's and the phone only renders it (`DossierDocument.kt`, FW12):

- **The phone's half** - `android/app/src/test/kotlin/ch/monreleve/app/aujourdhui/ModeParityTest.kt`. Ten taps over a
  fortnight (both sides confirmed, both corrected, a mission and an absence by correction, two halves, a mission and
  an absence by hand) recorded once through `AujourdhuiController.record` (manual) and once through
  `confirmDetected` / `correctDetected` (automatic), each by a controller whose clock stands on that day's evening.
  It reads the rows that REACHED the DAO and encodes them with the sync engine's own `entriesRequestBody`. Asserted:
  10 rows each (presence first), the bodies differ, the automatic body carries exactly the expected MANUAL /
  DETECTED_CONFIRMED / DETECTED_CORRECTED counts, and with `provenance`, `detectedKind` and `detectedAt` removed the
  two request bodies are **byte-identical**.
- **The server's half** - `web/tests/unit/dossier/mode-parity.test.tsx`. A full year (120 entries: every kind, both
  halves, absences, confirmed and corrected proposals of each side, hand-recorded days, one late recording) built
  twice with the same server stamps. From each: the `/api/v1/dossier` body (serialised from `DOSSIER_RESPONSE_FIELDS`
  as the route does), the CSV (`toCsv`), and the print document the PDF is rendered from (`app/releve/print/page.tsx`,
  rendered as the server renders it, its database and token reads replaced by the built dossier). Asserted: each
  pair differs, and is **byte-identical** once the provenance strings are masked (the JSON's `provenance` /
  `detectedKind` values, the CSV's two columns, the print document's "Origine" labels read from `DOSSIER_COPY` by
  key).

**Both passed on their first run** - the property already held, so there was no honest RED (CLAUDE.md: a test that
passed first is evidence of nothing until it is made to fail). Each was then made to fail by a verified,
fixture-side plant in a throwaway copy of the test (a production-code plant was refused by this session's permission
classifier and was not retried another way):

| Plant (landing verified by `diff`) | Result |
|---|---|
| web: one automatic day carries a note the manual one does not | 3 of 4 RED (dossier JSON, CSV, print document) |
| web: one automatic day's kind MISSION_FR -> CH (moves the figures) | 3 of 4 RED |
| phone: the automatic path records 2026-03-11 as SUISSE instead of MISSION_THIRD | RED at the byte comparison |

Each throwaway copy was deleted; `git status` clean after. The PDF's bytes themselves are compared through their
source document only: identical print HTML gives an identical render, apart from the PDF's own creation metadata.

**What "apart from provenance strings" covers, stated:** on the wire, `provenance`, `detectedKind`, `detectedAt`; in
the document, the provenance value and `detectedKind` (the server keeps no `detectedAt` in the dossier). Nothing
else may differ, and nothing else does.

---

## 4. The minified audit build on the emulator (R1132)

Emulator API 36 (MonReleve_API36), the MINIFIED `audit` build of f1dfac15 (release configuration, R8 on, not
debuggable: `pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ALLOW_BACKUP ]`), built with `-PfrontalierPort=3974` against
this session's `pnpm dev` on 3974 (`/api/health` named `monreleve`, R169) and its scratch database
`monreleve_an15_audit` (seeded). Sign-in codes were read from the dev log by the driver and typed one key per digit
(A3's N12: the minified build drops a burst); no code was printed, no capture taken while one was on screen, digit
fields are reported as "[digit field, not shown]" (R574). The Postgres oracle `q.cjs` is read-only.

### F4 - two accounts on one phone (the cross-account check)

| Step | What was seen | Oracle |
|---|---|---|
| A = Camille signs in | "Bonjour Camille" | - |
| A records today (Domicile) | « Enregistré »; Calendrier « Aujourd’hui, Jour 21, Domicile, enregistré à temps, saisie manuelle » | Camille 487 -> 488 entries; 2026-11-21 owned by camille only |
| A exports the PDF | share sheet, releve-2026.pdf | IssuanceRecord: camille 2 |
| A records 14 Nov OFFLINE | Calendrier "Jour 14, Suisse, en attente de synchronisation" | server: nothing on 2026-11-14 |
| A's session ended SERVER-SIDE (DeviceSession revoked in the scratch DB), network back | the app ends the session itself: sign-in screen, « Votre session a été fermée. 1 journée … attend d’être envoyée : reconnectez-vous avec la même adresse » (SET ASIDE, not drained) | camille: 0 live sessions |
| B = Alex signs in on the same phone | "Bonjour Alex"; today « Où travaillez-vous aujourd’hui ? » (A's Domicile NOT shown) | - |
| B's Calendrier | Jour 14 and Jour 21 « Non renseigné » - neither of A's days | after the sync window: Alex still 489 entries; nothing of A's under Alex |
| B's Releve | Nom "Alex Dupont" | - |
| B exports the PDF | share sheet, releve-2026.pdf | IssuanceRecord: alex 1 (the PDF was issued for Alex's account) |
| B's Parametres | Alex's settings (start date 08.01.2024; Camille's is 02.09.2024) | - |

**F4 RESULT: PASS, non-vacuous.** Nothing of the first account was visible to the second on Aujourd'hui, Calendrier,
Releve, Parametres or in the exported PDF, and the first account's queued day did not drain into the second account
(CROSS_ACCOUNT_LEAK = false, with A's rows proven present first). This closes AN14a's open "F4 on the MINIFIED build"
(blocked then by PARKAN-34).

**The other half (SET_ASIDE_RELEASED) did NOT hold, and that is ruled behaviour, not a regression:** when B signed
OUT, the phone was wiped, A's set-aside day included (R303: "R295's sign-out still clears everything - set-aside rows
included", `account/DeviceLocalStore.kt`). WHICH STEP erased it was attributed by reading the code, not isolated on the device (A never returned without B in between): a server-ended session KEEPS the record and its tag (R521, `DeviceLocalStore.clearForSessionEnd`, and the notice counted the day after it), a sign-in sets a different account's rows aside without clearing them (R303), and a voluntary sign-out runs `clearForSignOut`, the whole-record wipe. When A signed back in, 14 Nov was gone (server: nothing on 2026-11-14;
Calendrier « Non renseigné »). The message A was given (« reconnectez-vous avec la même adresse pour l’envoyer ») is
then untrue, and B's sign-out dialog did not mention a stranger's unsent day. Finding F1.

### 200 % text, TalkBack, one recorded day and a PDF

Criteria 18 and 19 above. One recorded day (Domicile, 21 Nov) and two PDF exports (Camille, Alex) were driven on the
audit build; a third PDF with TalkBack on.

### The on-device database read and the offline cycle

Criteria 10 and 12 above (debug build, emulator API 36).

---

## 5. Data safety - one change (R1135; Android Ruling 18 Q-DS1)

`docs/play-release.md` section 2 now declares **Approximate location: collected, OPTIONAL (automatic detection only),
not shared, App functionality**, traced to code like every other row (phone: `confirmDetected` / `correctDetected`,
the evening notification's buttons, `EntriesMapping.toEntryWrite`; tests `AujourdhuiAutoControllerTest`,
`EveningTapTest`, `ModeParityTest`; optional: the disclosure + opt-in, the server's `consent_required`, the
manual-only build; server: `web/lib/entries/schema.ts`, `Entry.provenance/detectedKind/detectedAt`). Precise
location stays NOT collected. Q-DS1 is marked answered; section 2.3 names what the row supersedes; section 4 (the
manual-only fallback) says when the row would read "not collected".

**Superseded statements (R267):**
- `docs/play-background-location.md` item 1 ("The Data Safety form declares location NOT collected / NOT shared") -
  CORRECTED in this branch, pointing to `docs/play-release.md` 2.3.
- `parking.md` PARKAN-32 NEEDS ("declaring location as accessed-on-device / not-collected / not-transmitted") -
  superseded by Android Ruling 18 Q-DS1; parking.md is not this session's to write.
- `docs/android-skills.md` 7.2 ("Case 1, not collected") - true of the coordinate only; not edited.
- `docs/play-background-location.md` SOURCES AND DATES still quotes 7.2's "Case 1 local-only EXEMPT" as a source
  line; left (it reports what the source says).

**Do the public statements still agree with the form?** (the orchestrator's check; no public copy was rewritten)

| Surface | Sentence (by key / line) | Verdict |
|---|---|---|
| In-app disclosure | `android/shared/src/commonMain/kotlin/ch/monreleve/app/fr/DisclosureCopy.kt` `NEVER_SHARED` (line 51-52), opening « Rien n’est transmis » | **CONTRADICTS** "Approximate location: collected". The confirmed day (Suisse / domicile) IS transmitted to our server. The rest of the sentence (never shared with the employer or the administration) is true. Finding F5a - **CLOSED by cca11959 (A13, R1220); see section 11** |
| In-app disclosure | `DisclosureCopy.NETWORK_LOCATION` (« ne conserve ni n’envoie jamais votre position »), `ON_DEVICE`, `WHAT_IS_KEPT` | consistent if "position" means the coordinate; `WHAT_IS_KEPT` says one conclusion a day is kept but not that it is sent once confirmed |
| Welcome screen | the « Confidentialité » line, « Aucune position n’est conservée » (seen on the emulator) | consistent read as "coordinate"; tension, not a contradiction |
| /confidentialite | `web/lib/fr/confidentialite.ts` `never[1]` (« L’application, elle, ne conservera ni n’enverra jamais votre position ») under the heading « Ce qui n’est jamais enregistré »; the collected list (`day`, `provenance`) does name each day's nature and its detected origin | **TENSION**: the page lists what is collected without calling the confirmed day a location, and a reviewer comparing it with "Approximate location: collected" meets "never sends your position". Finding F5b - **CLOSED by cca11959 (A13, R1222); detectedAt named by A14 (R1231); see section 11** |
| /confidentialite | `appThirdParty` (« L’application Android n’existe pas encore ») and the rights section’s « lorsqu’elle sera disponible » | stale at launch; launch blocker B12 (Q-DS2) |
| Store listing | `docs/play-store-listing.md` `listing:detection` (« … ne conserve ni n’envoie jamais votre position, seulement la journée que vous confirmez ») | **AGREES** - it says the confirmed day is sent |
| Store listing | `listing:full`, VOS DONNEES (« Aucune coordonnée géographique n’est enregistrée ni transmise ») | **TRUE** (no coordinate; a confirmed CH/HOME day is not a coordinate) |
| Store listing | `listing:detection`, last sentence (« La saisie manuelle produit exactement le même relevé ») | true of every figure (section 3) but not of the provenance column the releve prints; « exactement » is stronger than section 3's "identical apart from provenance". Finding F5c - **CLOSED by cca11959 (A13, R1223); its three siblings by A14 (R1230); see section 11** |

The operator approves the form and the listing together; the copy calls are theirs.

---

## 6. Launch blockers, each with its owner (R1133; AN15 AC3)

None of these is closable by a session. "Owner" is who acts; the operator decides.

| # | Blocker | Owner |
|---|---|---|
| B1 | The release (upload) key and the Play Console account; Play App Signing (R250: no session creates a key) | operator |
| B2 | Play's acceptance of the release: review, the Data safety form (section 5), App access, content rating | operator (Play) |
| B3 | The background-location declaration - verdict LIKELY REFUSED (`docs/play-background-location.md`); if refused, R1124's fallback: `-PmanualOnly=true`, versionCode + 1, no declaration, the listing minus `listing:detection`, screenshot 06 retaken (Android Ruling 18 Q4); Q3: if Play asks for more than the emulator video (retaken by A14 on the corrected disclosure, 27.49 s, section 11), a real detected day is recorded on the S9 | operator (Play) |
| B4 | "Play's acceptance of compileSdk 35 with targetSdk 36 is unproven until the first upload" (Android Ruling 8 Q4; the built APK reads compileSdkVersion 35, targetSdkVersion 36 - aapt2 on this tip) | operator (first upload) |
| B5 | The Firebase app config (the four FCM_ANDROID_* values, on the release command only) and the FCM_PRIVATE_KEY rotation that turns the server's daily push on; without them the release is valid with push unavailable (the 19:00 fallback stands in) | operator |
| B6 | assetlinks fingerprints: Play's APP-SIGNING key SHA-256 (and the upload key) in ANDROID_SHA256_CERT_FINGERPRINTS (PARK4-2), after B1 | operator |
| B7 | The S9 checks: cold start within 1,2 s on a mid-range device (emulator median 1 699.5 ms is not that measurement; before PRODUCTION, not closed testing - Ruling 18 Q5), detection battery <= 3 %/working day, PARKAN-46 (the notification walkthrough on the phone), PARKAN-47 (dumpsys on API 31+ and the lock-screen PIN check - needs a 31+ device) | operator (S9) |
| B8 | The first REAL push on the S9, including a battery-restricted / force-stopped app (Android Ruling 14 Q1: data-only envelope, high priority with nothing shown, android.priority never checked against the real API) | operator (S9) |
| B9 | The Checkpoint E expert reviewer (SPEC 21 row 8; also rules on how provenance is worded in the document) | operator |
| B10 | The S9 Doze / standby-bucket drift of the 19:00 fallback reminder (Android Ruling 15 Q5) | operator (S9) |
| B11 | The operator's approval of the listing texts (A5 Q1, `docs/play-store-listing.md`, and the title question) and of T1-T3 (A4, `UpdateCopy.TITLE/BODY/BUTTON`) - ship as written unless refused; plus the corrected strings that close F1 and F5a-F5c (REPORT-AN-COPY-TRUTH.txt Q1, REPORT-AN-COPY-TRUTH-2.txt QUESTIONS; section 11) | operator |
| B12 | Play's account-deletion WEB link: /confidentialite still says the app is coming; the LAUNCH-DAY web change flips `PRODUCT_STATE.appExists` and carries the deletion steps (Ruling 18 Q-DS2) | operator rules, a web session builds it on launch day |
| B13 | Whether the hosting keeps client IP addresses (Play counts IP-inferred location) - blocks the Data safety form (Ruling 18 Q-DS3) | operator |
| B14 | Setting ANDROID_MINIMUM_VERSION_CODE only once a LATER release exists to require (Android Ruling 13); it ships unset | operator (after a second release) |
| - | Checkpoint G (two-stage field accuracy test) gates **LEAVING BETA**, not this release (Android Ruling 1) - listed so its absence here is read as that decision | operator (after release) |
| - | Closed testing with at least one external tester completing sign-in, a week of logging and a PDF export (AN14 AC3; Play may require a minimum closed test for a new personal account) | operator |

---

## 7. Post-launch, by name (R1134) - so absence reads as a decision

From Android Rulings 5, 8-15, 18 and ORCH-ANDROID's DEFERRED list:

- **Ruling 5:** the 200 % sign-out dialog proof is an instrumented test run by no gate (option b: a taller-DeviceConfig
  baseline, :app only); a bare "." in `filenameOf` (Q2) together with the four unscrolled dialog bodies
  (SignOutClearDialog first, DeleteOutcomeDialog, RateChangeDialog, SignOutSendingDialog).
- **Ruling 8:** N4 (approximate location or a permanent denial: no feedback, nothing points to Settings) - with the
  binding condition that the listing never implies detection works with approximate location (`StoreListingCopyTest`
  holds it); Q5/N5 system Back from Licences leaves the app; N6 the bottom-bar labels at 200 % and N10 the export toast
  cut at two lines (with A1's large-font items); N7/N11/N12 emulator artefacts, no action.
- **Ruling 9:** Q2 a sign-out exit on RESOLVING during an outage; Q4 a server AUTO_DETECT on a phone without the
  permission shown as manual without a word (with N4).
- **Ruling 10:** Q1 the canvas strip under the gesture handle (cosmetic); Q2 the keyboard (IME) inset in AppRoot.
- **Ruling 12:** Q1 a 5xx sentence for the onboarding save and Parametres (operator copy); Q2 one home for the 2xx test
  (five files, two spellings).
- **Ruling 13:** Q5 the stale destination after a RELEASE within one activity instance; N2 a slow export reported as a
  connection problem (closed as measured: 2.5-2.8 s on a built server; the timeout stays).
- **Ruling 14:** Q3 the devices route refusing its documented `platform` key (the coordinate guard matches substrings;
  fix it to match key NAMES, tests both ways; the app omits the key meanwhile).
- **Ruling 15:** Q1 the device zone vs Paris "today" for travellers; Q4 sign out and in on one evening can remind twice
  (accepted).
- **Ruling 18:** Q3 a real detected day in the video only if Play asks; Q4 screenshot 06 retaken only for the
  manual-only release.
- **DEFERRED (ORCH-ANDROID):** PARKAN-35 (the API-26 matrix: cmdline-tools + an android-26 image); PARK-IE1 (S9 signed
  out, R823); the S9 dialog width / DatePicker and PB1-PB3 baselines; `android/scripts/*.test.mjs` run by no gate;
  PARK-J2/IB10 and days before the activity start date; PARK-E4/E7/E8, PARK-T3/T4/T5/T7, PARK-Q1, PARK-IF4 and the
  cosmetic/tooling parks (Web Ruling 36's logic) unless the operator promotes one. PARKAN-47 is a launch blocker (B7),
  not post-launch.
- **This audit adds (proposed post-launch, the operator's to rule):** F1 (a set-aside day erased by another account's
  sign-out; its NOTICE was corrected by A13, section 11 - the erasure itself stays ruled design, R303), F2 (a pixel rail-parity test), F3 (ValidationError copy on Android, traced), F4 (a simulated-month
  harness), F6 (Releve identity label at 200 %), F7 (a TalkBack speech capture on an AVD), F8 (the R248 bullet).

---

## 8. The iOS state (R1136), plainly

The repository is PUBLIC since 2026-11-20 (Android Ruling 17; `gh repo view` reads PUBLIC today), so R573 holds as
CLAUDE.md states it and GitHub's macOS minutes are free. The last iOS cloud run is **44834975248, success, on
9c194aeb** (A5); this audit changed nothing in `android/shared`, so it owed no run. **No iOS app host exists yet**; the
iOS phase (iOS Ruling 1) follows this audit, on the GitHub macOS runner, every claim labelled "iOS simulator". This
audit claims nothing about iOS beyond that.

---

## 9. Findings

**F1 - a forced sign-out promises a set-aside day that another account's sign-out then erases (LOW-MEDIUM, data
loss, ruled design).** Seen on the minified build (section 4). The forced-sign-out notice tells A the day « attend
d’être envoyée : reconnectez-vous avec la même adresse », but R303 makes every sign-out clear the whole device,
set-aside rows included, so B's sign-out erases A's day without B being told it exists. Not a privacy leak (nothing of
A reached B). Options for the operator: keep R303 and soften A's notice; or warn in B's sign-out dialog; or keep
set-aside rows across a foreign sign-out. Not fixed (product rule + copy).
**CLOSED (the copy option) by cca11959 - section 11.** The notice no longer promises the day will wait; R303 is
unchanged, so B's sign-out still erases it.

**F2 - rail parity is geometric, not pixel (evidence gap).** SPEC 21 asks pixel-for-pixel at the same width; the
codebase proves the same geometry by ported literals (and, by docs/audit-android.md F5, ported literals are
hand-copied, not read-tied).

**F3 - no Android French copy for `ValidationError`; reachability not traced.** If no Android surface can show an
engine validation error, the criterion's Android half is vacuous and should say so in a test (an asserted-empty
surface, R206's corollary); if one can, it needs copy.

**F4 - no simulated-month harness.** The coordinate criterion's database leg was re-run on a populated database (488
entries, 51 detected) but the replay writes no `daily_tally`; a month of automatic use was never simulated.

**F5 - public copy vs "Approximate location: collected" (section 5).** F5a `DisclosureCopy.NEVER_SHARED` « Rien n’est
transmis » contradicts the form; F5b /confidentialite's "never" list says the position is never sent without calling
the confirmed day a location; F5c the listing’s « exactement le même relevé » is stronger than "identical apart from
provenance". The operator's copy (approved with the form and the listing).
**CLOSED - F5a-F5c by cca11959, F5c's siblings and detectedAt by A14 (section 11).**

**F6 - Releve's identity row « Méthode de calcul » breaks mid-word at 200 %** (emulator API 36), the same family as the
bottom-bar labels (Ruling 8 N6).

**F7 - TalkBack speech cannot be captured on this AVD.** Four injection mechanisms never reached TalkBack; Google
TalkBack logs no utterance by default. A spoken pass needs a person (or the S9's Voice Assistant log, as AN-TALKBACK).

**F8 - CLAUDE.md's R248 bullet is stale.** It reads "CI is OFF: the repository is private"; the repository is PUBLIC
(Android Ruling 17; `gh repo view` today) and `CI_FULL` is still unset (`gh variable list` empty). Not edited here (the
operator's, Ruling 17).

**F9 - docs/audit-android.md is partly superseded and reads as current.** Its F2/F6 closure ("the RELEASE build
declares no location permission ... R8 removed the whole detection pipeline") was reversed by R316 / Android Ruling 1:
the release declares FINE + BACKGROUND (checkReleaseBundle on this tip) and ships detection. Its UNEXAMINED "F4 on the
minified build, blocked by PARKAN-34" is closed by section 4 here; PARKAN-34 itself is closed (`ApiLevelFenceTest`,
`lintDebug` NewApi in the gate). Nothing there was edited; this audit is the newer record.

---

## 10. Would you sign it?

**Yes - for the CLOSED TESTING track, not for production.** Every criterion this code can own is either closed on
this tip, an evidence gap that is not a product defect (F2-F4, rows 5 and 12), or not re-run with its unit evidence green, and the one HIGH-severity defect the earlier audit
found (F4, one account's days reaching another) is now shown closed on the minified build. Production waits on the
human list in section 6 - the key, Play's verdict on background location, the S9 measurements, the real push and the
expert reviewer - and on the operator's answers to F1 and F5 (since answered in copy: section 11; the strings ship as
written unless the operator refuses them).

---

## 11. Maintenance after the audit: F1 and F5 closed in copy (2026-11-21, A14 AN-COPY-TRUTH-2, R1232)

The audited tip, the criteria and their counts above are unchanged: this section records what LATER commits did
about two findings, as the audit's own maintenance (Android Ruling 20). What closed is the WORDS: each surface now
says no more than the app does. Behaviour is unchanged - no product code, no rule (R303 included) moved. Every new
string ships as written unless the operator refuses it (Android Ruling 20 Q1); the list is in the two reports named.

| Finding | Closed by | What changed | Evidence |
|---|---|---|---|
| F1 | cca11959 (A13, R1221) | `SignInCopy.sessionClosed(1)` / `(n)`: the notice no longer says the day will wait; it advises the condition the wait holds under - the same address, « avant d’y connecter un autre compte » (the zero sentence unchanged). R303 stands: another account's sign-out still erases a set-aside day; the notice no longer promises otherwise | `ForcedSignOutTest` (the ONE-day and TWO-day cases assert the clause on the sentence the real forced sign-out renders, R225; RED first); 3 `connexionSessionClosed*` baselines; emulator API 36: the notice after a server-ended session, then the advice followed and the day sent (REPORT-AN-COPY-TRUTH.txt R1221); `:app:gate` BUILD SUCCESSFUL on 6a83392c |
| F5a | cca11959 (A13, R1220) | `DisclosureCopy.NEVER_SHARED` no longer opens « Rien n’est transmis »: the position is never transmitted, to anybody; only the day the person validates is sent, with what detection had proposed | `DisclosureCopyTest.theSharingSentenceSaysTheValidatedDayIsSentAndThePositionNever` (RED first); `disclosure.png` baseline; emulator API 36 dump of the disclosure |
| F5b | cca11959 (A13, R1222); A14 (R1231) | /confidentialite: `NEVER_STATEMENTS.automaticMode` ends with what IS sent and stored; `DISCLOSED_RECORDS.provenance` names « la détection automatique » and, since A14, the time the phone showed when the person validated a proposed day (`Entry.detectedAt`, which `lib/content/personal-data.ts` maps to that record) | `web/tests/unit/pages/confidentialite.test.tsx` "R1222" (the record renders ABOVE the statement that says « plus haut ») and "R1231" (the record found through `PERSONAL_DATA['Entry.detectedAt']`, rendered, naming the hour, the phone and the validation); both `page-confidentialite-*` baselines, regenerated twice (A13, A14) |
| F5c | cca11959 (A13, R1223) | `docs/play-store-listing.md` `listing:detection`: the same releve, the same figures, only the origin shown for each day differs | `StoreListingCopyTest.theModeParityClaimNamesTheOriginAsTheOneDifference` (RED first) |
| F5c's siblings | A14 (R1230): 58f3dec4, 5bd9ad75, e0b9198e | the same claim, in each surface's own register: `OnboardingCopy.MODE_INFO` (step 7), `ParametresCopy.AUTO_DESCRIPTION` (« En savoir plus », keeps « les deux se valent », D19), `web/lib/fr/application.ts` `modesIntro` (both product states), `docs/play-release.md` section 3 (the English declaration) | `ModeParityCopyTest` (both strings + a census of every fr/ file, matcher shown to fire), `PlayDeclarationCopyTest` (plant verified), `web/tests/unit/fr/mode-parity-copy.test.ts` (both states + a census of `web/lib/fr` and `content/guides`); baselines `OnboardingScreenScreenshotTest_mode`/`_modeAuto`, `page-application-*`; REPORT-AN-COPY-TRUTH-2.txt (the census table) |

The Play assets that filmed the OLD disclosure (screenshot 04 and the demo video, A5) were retaken by A14 from its
code tip, under new names beside A5's (R1233; paths and sha256 in REPORT-AN-COPY-TRUTH-2.txt and
`docs/play-release.md` section 3). B11 now lists these strings among the operator's approvals.
