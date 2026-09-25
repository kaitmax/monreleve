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
| styles | `.claude/skills/android/jetpack-compose/theming/styles/SKILL.md` | yes (227 lines) |
| navigation-3 | `.claude/skills/android/navigation/navigation-3/SKILL.md` | yes (120 lines) |
| testing-setup | `.claude/skills/android/testing/testing-setup/SKILL.md` | yes (199 lines) |
| edge-to-edge | `.claude/skills/android/system/edge-to-edge/SKILL.md` | yes (427 lines) |
| r8-analyzer | `.claude/skills/android/performance/r8-analyzer/SKILL.md` | yes (70 lines) |
| android-intent-security | `.claude/skills/android/security/android-intent-security/SKILL.md` | yes (548 lines) |
| play-policy-insights | `.claude/skills/android/play/play-policy-insights/SKILL.md` | yes (170 lines) |
| android-profiler | `.claude/skills/android/profilers/android-profiler/SKILL.md` | yes (57 lines) |

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

<!-- Section 6 (conflicts) added in AN0 increment 2. -->
<!-- Section 7 (what AN6/AN8/AN14 inherit) added in AN0 increment 3. -->
<!-- Section 8 (NEEDS) added in AN0 increment 4. -->
