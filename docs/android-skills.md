# Android skills - installed, pinned, and vetted (AN0)

This file is the authoritative record for the Android skills this project
depends on: what each is for, the exact commit it is pinned to, every conflict
it has with this project's rulings, the notes later tasks inherit, and how to
update the vendored copy deliberately.

It is written by AN0 (relay/AN0.txt). AN0 writes NO app code; it installs and
vets the skills so that a conflict is found here, before any component exists,
rather than at AN9 in something already shipped.

> **R258 - skills are advisory.** SPEC-frontalier-web.md, DESIGN-SYSTEM.md and
> the ruling register WIN ON CONFLICT, always. A skill is Google's generic best
> practice; this project has deliberate departures from several of them. Where a
> skill and a ruling disagree, the ruling is followed and the conflict is
> recorded below - the skill's text is never edited to agree with us.

---

## 1. Source, method, and where the files landed

- **Source:** https://github.com/android/skills - official, Google LLC,
  Apache-2.0. It ships a `.claude-plugin/marketplace.json`, so it installs as a
  Claude Code plugin; the Android CLI's `android skills add --project=.` is the
  documented alternative.
- **Method used:** neither the plugin marketplace nor the `android` CLI. The
  `android` CLI is not installed on this machine (`command -v android` -> not
  found), and a marketplace/plugin install lands the skills in a user-global
  location (`~/.claude/plugins/...`) that is outside the repository and would
  make the build depend on a per-machine fetch. Instead the repo was cloned at a
  pinned commit and the eight skills were **vendored** into the tree (see 3).
- **Pinned commit:** `b1f707d90904129b5972b3cc6436b568583effe5`
  (`Enhance README with skill update instructions`, 2026-09-18). Resolved two
  ways that agree: `git ls-remote https://github.com/android/skills.git HEAD`
  before cloning, and `git rev-parse HEAD` in the clone after.
- **Where the files landed:** `.claude/skills/android/<category>/<skill>/`,
  mirroring the upstream category path so the provenance is exact. The
  Apache-2.0 `LICENSE.txt` is vendored beside them at
  `.claude/skills/android/LICENSE.txt`, and a short `PROVENANCE.md` points back
  to this file.
- **Windows note (R252 - suspect the new way first):** the first
  `git clone` left an INCOMPLETE working tree - only categories alphabetically
  up to `jetpack-compose` checked out, and `git status` reported the rest as
  deleted. The cause was Windows `MAX_PATH` (260): the deepest upstream paths
  (~150 chars, under `jetpack-compose/migration/.../references/android/develop/`
  and `xr/`) plus the temp-clone prefix exceed the limit and abort the checkout.
  Fixed with `git config core.longpaths true` + `git reset --hard HEAD`. None of
  the eight vendored skills is one of those deep trees; the deepest vendored
  path is ~184 chars absolute, well under 260, so the main repo (which does not
  set `core.longpaths`) handles them without special configuration.

## 2. The eight, and why each

`R260` - install eight, not all. The repo ships 24 skills; carrying instructions
for cameras, TV, Wear, XR, billing, and ML would spend context on things this
app will never do. Anything else is installed later, by name, when a task needs
it (R260).

| # | Prompt name | Vendored skill (name) | For |
|---|---|---|---|
| 1 | jetpack-compose | `jetpack-compose/theming/styles` (styles) | the UI theming - Styles API |
| 2 | navigation | `navigation/navigation-3` (navigation-3) | one activity, four destinations |
| 3 | testing/testing-setup | `testing/testing-setup` (testing-setup) | the test protocol lives or dies here |
| 4 | system/edge-to-edge | `system/edge-to-edge` (edge-to-edge) | FD4/FD5 safe-area behaviour |
| 5 | performance/r8-analyzer | `performance/r8-analyzer` (r8-analyzer) | the 12 MB APK budget, R8 at AN14 |
| 6 | security/android-intent-security | `security/android-intent-security` | the App Link callback (R195) intent surface |
| 7 | play | `play/play-policy-insights` (play-policy-insights) | AN14: data safety, background-location |
| 8 | profilers/android-profiler | `profilers/android-profiler` | AN6/AN7 battery budget |

### 2.1 Three of the eight names are CATEGORIES, not skills (finding)

The prompt's eight names were written against an older/flatter layout. At
`b1f707d`, three are directories containing several sub-skills, so a choice had
to be made and is recorded here (this is the R259 "actively developed" hazard,
observed on the first task that touches it):

- **jetpack-compose** -> chose **theming/styles**. The three sub-skills are
  `adaptive`, `migration/migrate-xml-views-to-jetpack-compose`, and
  `theming/styles`. `adaptive` explicitly targets "phones, tablets, foldables,
  laptops, desktop, TV, Auto and XR" - dragging in the form factors R260
  excludes. `migration` is for porting legacy XML views - irrelevant to a
  greenfield app. `theming/styles` is about the Compose Styles API ("replace
  hard coded parameters with Style attributes," making components styleable),
  which is the sub-skill that actually intersects D37/R8/R62 - the theming
  rulings this task vets against. `adaptive` remains available by name if a
  later task needs responsive layout (subject to the R260 caution).
- **navigation** -> chose **navigation-3**. Sub-skills are `navigation-3`
  (general nav: deep links, backstacks, conditional/auth navigation, scenes) and
  `navigation-event` (predictive-back gestures only). "One activity, four
  destinations" is `navigation-3`; it also owns the deep-link recipes the App
  Link callback (R195) needs.
- **play** -> chose **play-policy-insights**. Sub-skills are
  `engage-sdk-integration`, `play-billing-library-version-upgrade`, and
  `play-policy-insights`. Only the last covers "data safety, location access,
  prominent disclosure, background location" - exactly what AN14 needs. The
  other two (engagement feed, in-app billing) are features this app does not
  have.

## 3. Vendored, not fetched (the decision, and why)

**Decision: commit the skill files into the repo.** They are third-party
instructions the build depends on for behaviour; vendoring makes the project
reproducible on a machine that is not this one, and not vendoring makes every
build depend on a live fetch of a moving `HEAD`. R229's reasoning for pinned
Chromium applies directly: a rule (here, a skill's instructions) that changes
under the project between sessions without a commit is the hazard R229 closed.
Pinning the SHA is necessary but not sufficient - the files themselves are
committed so a fresh clone has them without reaching the network.

Total vendored: 90 files, ~1.0 MB, all text. `.claude/` is not gitignored for
these paths; the files are tracked.

## 4. Loadability proof (AC1 - R133: "installed" is not "present and loadable")

"The directory exists" is not the signal. Each of the eight `SKILL.md` files was
read in full during AN0 (this is both the vetting input and the AC1 proof). The
exact file read, per skill:

| Skill | File read | Read? |
|---|---|---|
| styles | `.claude/skills/android/jetpack-compose/theming/styles/SKILL.md` | yes (226 lines) |
| navigation-3 | `.claude/skills/android/navigation/navigation-3/SKILL.md` | yes (119 lines) |
| testing-setup | `.claude/skills/android/testing/testing-setup/SKILL.md` | yes (198 lines) |
| edge-to-edge | `.claude/skills/android/system/edge-to-edge/SKILL.md` | yes (426 lines) |
| r8-analyzer | `.claude/skills/android/performance/r8-analyzer/SKILL.md` | yes (69 lines) |
| android-intent-security | `.claude/skills/android/security/android-intent-security/SKILL.md` | yes (547 lines) |
| play-policy-insights | `.claude/skills/android/play/play-policy-insights/SKILL.md` | yes (169 lines) |
| android-profiler | `.claude/skills/android/profilers/android-profiler/SKILL.md` | yes (56 lines) |

Each `SKILL.md` carries valid YAML frontmatter (`name`, `description`,
`license`, `metadata`) and readable Markdown body. Whether a Claude Code session
whose working directory is `MonReleve/` auto-discovers skills placed at the
repository-root `.claude/skills/` is NOT claimed here - it is unverified from
this task and recorded as an open question. AC1's own standard - the agent can
read each `SKILL.md` and say which file - is met literally by the table above.

## 5. How to update this vendored copy deliberately (R259)

`android/skills` is actively developed. Updating is a deliberate act with its
own commit - never an incidental fetch, and never a silent drift.

1. `git clone https://github.com/android/skills` (on Windows, first
   `git config core.longpaths true`).
2. Record the new `HEAD` SHA and diff the eight vendored skills against it.
3. Re-run the vet in section 6 against the changed skills - a new sentence in a
   skill can introduce a new conflict with a ruling.
4. Copy the changed files into `.claude/skills/android/...`, update the pinned
   SHA in section 1 and in `PROVENANCE.md`, and record what changed and why in a
   commit whose message names the new SHA.

A skill must never be edited in place to agree with this project (R258); the
divergence lives in section 6, not in the skill's text.

## 6. Conflicts with this project's rulings (AC2)

Each skill was read in full and checked against the dimensions the prompt names:
D37/R8/R62 (Material themed, every radius/colour/spacing a token, no shadow on a
card), R155/R206 (French only, from one module), the ordering rule and the
RED/GREEN ledger, R176/R177 (a person looks at a rendered thing), SPEC 13/D18
(no coordinate stored, logged or transmitted), and R136's spirit (no dependency
where the platform suffices). A skill with no conflict is recorded as **examined,
none found** - a different statement from silence.

Quotes below are verbatim from the vendored `SKILL.md` at the pinned SHA.

### 6.1 jetpack-compose/theming/styles

- **CONFLICT - R176/R177 (walkthrough) + R135 (baselines).** Skill: Step 3.7 -
  *"Compare the baseline screenshot image taken at the start with the rendered
  Compose Preview of the new composable... Iterate on the Compose code until
  visual parity is achieved"*, and Step 4.2 *"Run your module's screenshot
  tests."* This treats a Preview + screenshot test as sufficient evidence of a
  screen. R176/R177 require a **person to drive and look at the rendered thing**;
  R135 says a baseline certifies *nothing changed*, never *this is right*.
  **RULING WINS** - screenshot/baseline tests are permitted as a regression
  guard, never as the evidence that a screen is correct.
- **CONFLICT - R8/R62 (tokens only).** Skill: the migrated `Style` example uses
  raw dimension literals - `minWidth(58.dp)`, `minHeight(40.dp)` (lines
  185-194). R8/R62: every radius, colour and spacing is a token; no raw value
  outside the token set. **RULING WINS.** (The skill's *centralisation* of
  styling into one `Style` object aligns with the project in spirit - it is the
  raw `.dp` literals, not the centralisation, that conflict.)
- **CAUTION - R156 conservatism / R136 spirit.** Skill: line 22 *"this skill is
  EXPERIMENTAL and requires updating to alpha version of Compose"*; prerequisites
  demand `compileSdk 37` and `foundation 1.12.0-alpha01` (lines 30-32). The
  project's token theming (D37/R8/R62) does **not** require the alpha Styles API;
  a plain custom design system over `CompositionLocal`s achieves it on stable
  Compose. Adopting this skill = an alpha dependency on a compliance product.
  **Recorded for the UI task to rule on**; the conservative default is stable
  Compose without the Styles API.
- Line 67 recommends migrating to Material 3 - compatible with D37 (Material
  *themed* is permitted), subject to the shadow cross-cut (6.9 X1).

### 6.2 system/edge-to-edge

- **CONFLICT - DESIGN-SYSTEM §12 + §117 (light ships first, no dark app bar).**
  Skill: line 321 *"controller.isAppearanceLightStatusBars = !darkTheme"*,
  inverting system-bar icon appearance by `isSystemInDarkTheme()`, "for apps
  that support light and dark theme" (line 300). §12: *"Tokens adopted; light
  ships first, dark after launch."* §117: *"No dark app bar... Android app bar:
  canvas colour, title #111827."* The launch build is light-only, so the
  appearance is fixed light, not inverted. **RULING WINS** - apply the light
  appearance; the dark inversion arrives with dark mode, after launch.
- **CONFLICT - R82 + FD never-draw list (no gradient).** Skill: `StatusBarProtection`
  draws `Brush.verticalGradient(...)` (line 380). R82 forbids gradients and
  *"Never draw ... a gradient"* is on the never-draw list in every FD brief.
  **RULING WINS** - use a solid or flat-translucent scrim, not a gradient.
- **CONFLICT - R155/R206 (no inline strings).** Skill example: `Text("Login")`
  (line 91), a hardcoded English literal in a composable. The project forbids
  inline strings (strings live in one module / string resources), which AN1's
  lint fences enforce. **RULING WINS** - illustrative code is re-authored to the
  copy discipline, never copied verbatim.
- Line 23 assumes `targetSdk 35` (AN1's decision). Otherwise this skill is
  **strongly aligned** with FD4/FD5 - see Section 7.

### 6.3 testing/testing-setup

- **CONFLICT - the ordering rule (RED before GREEN).** Skill: Step 1 *"analyze
  the current testing setup"* and Step 5 *"add or review unit tests in every file
  that contains business logic"* - a test-after posture (tests retrofitted onto
  existing code). The project requires the **failing test first**, with the RED
  run and its reason in the report. **RULING WINS.**
- **CONFLICT - R176/R177 + R135 (screenshots are not sufficient evidence).**
  Skill: Step 8 makes screenshot tests a core pillar - *"each screen is tested in
  9 different sizes"*, plus Roborazzi/Paparazzi/Dropshots. Permitted here as a
  regression guard, but a person must still drive the app (walkthrough) and a
  baseline never certifies correctness. **RULING WINS.**
- **CONFLICT - project conventions (no AGENTS.md).** Skill: lines 191-198 -
  *"If there is no AGENTS.md file, create a new file (docs/testing.md)... Also
  create a new AGENTS.md file in the root and create a link to docs/testing.md."*
  This project's instructions live in CLAUDE.md + relay/ + tasks/, not AGENTS.md.
  **CONVENTION WINS** - do not create AGENTS.md. (Also out of AN0's scope.)
- **CONFLICT - simplicity-first (PHASE-4 item 5) + R136 spirit.** Skill: Step 2
  *"If it's not multiplatform, install Hilt"* and Step 3's default install list
  (JUnit4, Jacoco, Robolectric, Compose test, Dropshots) plus UI Automator. Each
  dependency must be justified by a need, not installed by default; a small app
  does not warrant a DI framework by default. **ETHOS/RULING WINS.** (The skill
  is partly restrained: *"Do not install [Mockk] unless it is clearly
  necessary"*, and *"respect the current stack"*.)
- Alignment: line 142 *"access resources such as strings"* via `ComposeTestRule`
  supports R155/R206 (strings from resources).

### 6.4 security/android-intent-security (the prompt's highest-value check)

- **EXAMINED against R195's frozen App Link contract - NO CONTRADICTION, and this
  is the finding worth stating.** R195 froze the *server* callback:
  `GET /api/v1/auth/callback?token=...&email=...`, single-use, 15-minute token,
  *"the exposure is bounded by the token rather than by the verb"*
  (docs/api-v1.md 1.2). This skill governs the *client* intent handling and is
  **complementary and reinforcing**: *"validate all incoming intent extras"*
  (line 539), never process an intent in `onNewIntent` without the same controls
  as `onCreate` (antipattern, line 530), never launch a nested intent from an
  untrusted source without verifying target package and export status (line 526).
  These are exactly what the Activity that receives the App Link must do on top
  of R195, not instead of it. The prompt flagged a contradiction here as *"worth
  more than the rest of this task"*; there is none - recorded explicitly so the
  absence is a decision, not a silence.
- **FINDING - minSdk assumption (verify at AN1).** Skill: line 372 *"always
  available since minSdk is 36"* and line 427 *"Since minSdk is 36"*. Several
  patterns (`SQLiteQueryBuilder.setStrict*`, `hasSigningCertificate`) are stated
  as unconditionally available. If MonReleve's minSdk is below 36 (AN1 sets it),
  these claims are false and the code needs API-level guards. Not a ruling
  conflict; an assumption to check.
- **FINDING - R136 spirit (mild).** Skill: line 58 *"androidx.core:core:1.9.0 or
  higher is mandatory"* for `IntentSanitizer`. Already present transitively in any
  Compose app, and the skill provides a no-library manual fallback (section 1),
  so no conflict in practice. Recorded.
- No coordinates anywhere (SPEC 13/D18 clean).

### 6.5 navigation/navigation-3

- **EXAMINED, no ruling conflict.** The `SKILL.md` is an index of recipe
  references. Cautions rather than conflicts:
  - Deep-link recipes (lines 64-69) are the mechanism for the R195 App Link
    callback but parse URI arguments with no security step - they **must** be
    composed with android-intent-security (treat the incoming URI as untrusted).
  - DI (Hilt/Koin) is leaned on for modularisation (lines 107-108) - the R136 /
    simplicity note in 6.3 applies; plain Compose navigation suffices for four
    destinations.
  - Navigation 3 vs the stable Navigation 2: verify Nav3's maturity at the
    navigation task; Nav2 / plain Compose navigation is the conservative
    alternative (same shape as the Styles-API caution in 6.1).
  - Adaptive / two-pane / supporting-pane recipes (lines 83-87) target larger
    form factors a four-destination phone app will not use (R260 spirit).
  - One reference, *"URI with Arguments"* (line 67), is an external
    `developer.android.com` URL, not vendored - it depends on a fetch.

### 6.6 performance/r8-analyzer

- **FINDING - installed is not usable (R133 / R187 shape).** Skill: line 40
  *"python3 .agents/skills/r8-analyzer/scripts/convert_pb_to_json.py"* and line
  41 `analyze.py`. **Those scripts do not exist anywhere in the android/skills
  repo at b1f707d** (verified with `git ls-tree -r HEAD`). Vendoring cannot
  include what upstream does not ship, so Paths A and B (the quantitative
  analysis) are not runnable from the vendored copy; only **Path C** (heuristic
  manual inspection of `proguard-rules.pro`) works - and its reference `.md`
  files are all present. This is exactly the "installed != present and loadable"
  gap AN0 exists to find before AN14 depends on it.
- **FINDING - hardcoded install path.** The same lines assume the skill lives at
  `.agents/skills/r8-analyzer/` (the Android CLI's location), not the vendored
  `.claude/skills/android/performance/r8-analyzer/`. Even if the scripts existed
  the path would need adjusting at AN14.
- Line 45: Python + `protobuf` required for Path B (dev-time tool dependency).
  Line 67 *"No code changes: Research and suggest only"* - suggests-only, so no
  budget-raising conflict; aligned with the 12 MB APK budget.

### 6.7 play/play-policy-insights

- **EXAMINED, no ruling conflict; strongly ALIGNED with SPEC 13/D18.** It is an
  auditor that *detects* undeclared data collection, location access and missing
  disclosure - the tool that would verify D18/SPEC 13 rather than breach them.
- The strings `"latitude"` / `"longitude"` in `resources/scanner_config.json`
  (lines 12-13) are **detection keywords** - the auditor's dictionary for
  *finding* location usage in an audited app - not a stored, logged or
  transmitted coordinate. This supports D18; it does not violate it.
- Notes (not conflicts): it bundles `play_store_scraper.py`, which reaches Google
  Play servers to cross-reference declarations - a deliberate third-party call
  when AN14 runs it (R241 boundary 3 territory; **not run in AN0**). It requires
  `python3`. It writes to `.scratch/` at the workspace root (line 52). It is
  interactive (*"STOP: await further instructions"*, line 169) - R156/R241
  govern in autonomous sessions. See Section 7 for what AN14 inherits.

### 6.8 profilers/android-profiler

- **EXAMINED, no ruling conflict.** A Perfetto profiling orchestrator.
- Note: line 42 *"If the user request is not clear, ask the user"* - interactive;
  in this project's autonomous sessions R156/R241 (park the question, continue)
  govern. Traces are dev-time artifacts captured on a test device, not shipped
  product data (no D18 conflict), but a captured system trace can hold extensive
  device data and must never be committed. See Section 7 for the battery method.

### 6.9 Cross-cutting

- **X1 - CONFLICT: D37 + §52/§14 (no shadow on cards).** Every M3-using skill
  (edge-to-edge's `TopAppBar`/`NavigationBar`, navigation-3's Material adaptive,
  theming's M3 migration) pulls in Material 3 components, which carry default
  tonal elevation/shadow. §52 *"SHADOWS: none on cards. Borders preferred"*, §14
  *"no heavy shadows"*, D37 *"no shadow on a card"*. **RULING WINS** - Material is
  permitted but themed to zero card elevation.
- **X2 - "ask the user" vs R156/R241.** android-profiler (line 42),
  testing-setup (line 44) and play-policy-insights (line 169) all instruct
  interactive Q&A. In autonomous sessions the project parks and continues.
- **X3 - R155/R206 (inline strings in examples).** Skill examples use hardcoded
  English literals in composables (e.g. edge-to-edge `Text("Login")`). Applied
  code is re-authored to the copy discipline; AN1's lint fences enforce it.

## 7. What AN6, AN8 and AN14 inherit

Three skills carry information later tasks depend on. Extracted here so those
tasks do not rediscover it.

### 7.1 android-profiler -> AN6/AN7 (battery and memory measurement, R233)

The 3 %-per-working-day battery budget is a NUMBER THAT MUST BE MEASURED, and
the method matters as much as the figure (R233). The skill measures with
**Perfetto system traces** (recording via `recording_orchestrator.md`, analysis
via `analysis_orchestrator.md`; the power method is in
`analysis/.../hints/subsystems/hints_power.md`).

- **Battery:** query the `power_rails` track; energy per rail =
  `power_ma * duration`; sum across rails; convert to **milliwatt-hours (mWh)**
  to compare severity. (hints_power.md)
- **Screen-off correctness:** query the `suspend_state` track - *"a lack of time
  in 'suspended' state indicates a wakefulness problem."* Root-cause a failure to
  suspend via the `kernel_wakelock` track (aggregate total duration per wake
  lock).
- **Why this is the right instrument for AN6/AN7:** MonReleve's detection wakes
  periodically to determine country on-device. The budget is dominated by whether
  the device SUSPENDS between detections and whether any wake lock is held.
  `suspend_state` + `kernel_wakelock` prove exactly that the detection wake
  pattern does not keep the device awake.
- **Hard constraint (R233 - the method's precondition):** `power_rails` needs a
  device with on-device power measurement (ODPM) - Pixel 6+ (Tensor) and similar.
  An emulator has no power rails, so **the 3 % figure cannot be measured on an
  emulator**; AN6 needs a supported physical device, or must fall back to
  `dumpsys batterystats` (a coarser method). This device requirement belongs in
  the AN6 plan now.
- Vendored recording configs of interest: `long_background.pftxt` (a long
  background trace - the shape a working-day battery measurement needs),
  `memory_counters.pftxt`, `sched_cpu.pftxt`, `app_jank.pftxt`.

### 7.2 play-policy-insights -> AN14 (data safety, background-location)

The decisive result, from the skill's Data Safety Case Matrix
(`resources/goal_data_safety.md`):

- **Play's "Collection" means OFF-DEVICE TRANSMISSION.** Case 1 - *"Not
  Transferred (Local only) -> EXEMPT"*. MonReleve determines country on-device
  against a bundled border polygon and DISCARDS the fix, transmitting no
  coordinate (SPEC 13/D18). So location is **Case 1: not collected** in Play's
  sense - the Data Safety form declares location NOT collected/shared, and
  prominent disclosure is EXEMPT.
- **This holds ONLY while D18 holds.** Heuristic 1, "The Logger Loop": *"if a
  user identifier ... or precise location is passed to a logger that uploads
  payloads off-device, this counts as transferred"* -> Case 2A *"Silent
  Background Transfer"* = **CRITICAL** violation. D18 (no coordinate logged or
  transmitted; the API rejects coordinate payloads) is exactly what keeps the
  Data Safety declaration honest as local-only. The auditor is the tool that
  would catch a regression here.
- **Background location is separately a RESTRICTED PERMISSION.**
  `ACCESS_BACKGROUND_LOCATION` triggers Play's restricted-permission review
  regardless of whether any data is transmitted - a justification (Play Console
  declaration, and typically a demo video) is required just to ship the
  permission. The skill AUDITS permission usage; it does not walk the
  justification form.
- **NOT covered by the skill (-> NEEDS, Section 8):** the Data Safety form
  fields, the background-location justification PROCESS, and HOW LONG PLAY REVIEW
  TAKES. The skill is a code-vs-declaration auditor, not a submission guide.
- Running the auditor reaches Google Play (`play_store_scraper.py`) - a
  deliberate third-party call, at AN14, not now.

### 7.3 android-intent-security -> AN8 (the App Link callback, R195)

R195's callback contract is UNCONTRADICTED (Section 6.4). What the skill adds for
the CLIENT side of that contract, which AN8 must apply on top of R195:

- The Activity receiving the `https` App Link must treat the incoming intent's
  data (the `token` and `email` in the URI) as UNTRUSTED input and validate it
  before use (*"validate all incoming intent extras"*, line 539).
- It must apply the SAME validation in `onNewIntent` as in `onCreate` - a
  `singleTop` launcher handling the App Link receives warm-boot deliveries via
  `onNewIntent` (antipattern, line 530; section 4).
- It must never forward the incoming intent to a nested/private component
  (intent redirection) - the callback is consumed in-app, never re-launched
  (lines 87-95, 526).
- The App-Link intent-filter Activity is necessarily `exported="true"`; keep
  every OTHER component `exported="false"` (line 537).
- **Composition:** navigation-3 supplies the deep-link ROUTING; this skill
  supplies the VALIDATION. AN8 uses both together.
- **assetlinks is the server's job, not this skill's.** The App Link only opens
  the app if `/.well-known/assetlinks.json` verifies (docs/api-v1.md 4, R205),
  and it must name Play's SIGNING key, not the upload key (PARK4-2). The skill
  does not cover App Links / assetlinks; that contract comes from the project,
  and the fingerprints are AN14's supply (Section 8).
<!-- Section 8 (NEEDS) added in AN0 increment 4. -->
