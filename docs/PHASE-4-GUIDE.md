# How this project is built — the protocol, as practised

Written at the close of Phase 4 (FW21–FW29), September 2026, before the Android series begins.

This is not the specification and not the plan. `SPEC-frontalier-web.md` says what the product is; `tasks/plan.md` says what order it gets built in; `CLAUDE.md` says what the rules are. **This document says how the work actually goes, and why the rules ended up the shape they are.** It exists so the next phase — and anyone who picks this up in six months — starts from what was learned rather than rediscovering it.

Everything here is drawn from what happened. Where a rule has a number, the number is its entry in the ruling register; where a rule has a story, the story is the reason it survives.

---

## 1. The relay

One person operating two Claudes. A **chat session** that rules, and a **Claude Code session** that builds. They never talk directly. The channel between them is two artefacts:

**A prompt** — `relay/FW<n>.txt` — written by the chat side, committed to the repository, pasted as the first message of a fresh Claude Code session. It carries the task, the increments, the acceptance criteria, and every ruling the task must apply, **verbatim**. Pure ASCII, because a prompt is transport and an accented quotation passing through it becomes transliterated copy (R155, R168).

**A report** — `REPORT-FW<n>.txt` — written by the building side, committed at the end of the session. It carries what was built, what was proven and how, every deviation, every parked decision, every defect found, and every question. The chat side reads it, rules, and writes the next prompt.

Two properties make this work, and both were learned the hard way.

**Rulings are carried verbatim, not summarised.** A prompt that paraphrases a ruling has created a second source for it (R206). The pre-step of every prompt is a list of rulings copied exactly.

**Prompts and reports are both committed.** For most of the project the prompts were untracked, and a report citing a ruling from a file nobody could open is unverifiable six months later. They live in `relay/` now.

### The consigne

Mid-task conversation was the default until late in Phase 4 and then stopped. **R241**: the only thing that ends a session is the report, committed and pushed. Not an increment finishing, not a gate running, not a good finding, not a question that could be parked.

The cost is real and accepted: decisions get taken conservatively and parked, and one may be reversed in the morning. **R156** is what makes that survivable — take the option that claims less, ships less, and can be changed tomorrow without a migration, a 301, or a correction to something published; write the parking entry; continue.

Four things still end a session early, each with the report written and everything pushed: a permanent decision (a slug, a URL parameter, a column needing a migration), anything that would publish a false or unsourced claim, a gate change or a new runtime dependency, a red gate that can't be fixed in the increment, or a degraded context. **A session that stops for one of those succeeded. One that stops to talk did not.**

---

## 2. The increment

Work happens in increments. Each is: implement → test → verify → **commit only on green** → push. The project builds and the existing suites pass after every increment; never more than about a hundred lines uncommitted.

**Commit only on green is not negotiable.** One red commit reached `main` in this project, amended within a minute, and it produced a rule: chains use `&&`, never `;`, so a failing check cannot be followed by a commit (R15).

**Which suites constitute "green" is selected by changed paths, not by judgement** (R132, R140, R144, R247, R251). A script reads `git diff --name-only` and requires the browser suites when `app/**`, `lib/ui/**`, `lib/fr/**` or the token layer changed, the database suites when anything reaching Prisma changed, and so on. The selection is printed and recorded in the commit.

That selector has been wrong four times and each fix generalised it: a directory list became an import closure (R218), the closure missed entry points because a framework calls them and no module imports them (R246), `find` returned only the first matching rule's suites instead of the union (R234), and configuration files that decide what a suite *does* were not selecting it (R247). **A file that determines what runs, or whether it runs, belongs to a suite. If no suite covers it, that is the finding, and the answer is a suite rather than an exemption.**

**Don't work ahead of a running gate.** Writing the next increment's files into the tree while the current gate runs caused a defect to surface two attempts late.

---

## 3. Tests

### Test-first, and RED means something

New behaviour gets its failing test before the code. The report carries a **RED/GREEN ledger**: one row per function, the failing run with the reason it failed, then the passing run. **A test that passed on its first run is evidence of nothing** and is redone.

For a property test, RED means the property run against a deliberately broken variant, failing and naming its falsifying case. Those broken variants are kept as permanent tests, not deleted after they've served — a property that has never failed might be vacuous, and the generator might never reach the region where it could break.

### The ordering rule

FW4 is the pattern. **The Geneva fixtures were written and shown failing before any waterfall code existed.** Six failures captured, then the implementation until green. A snapshot of whatever the code happened to do would have blessed a wrong reading of the 40 % rule and defended it against correction — which is why snapshots are forbidden in the engine entirely.

This creates a real conflict with "green after every increment", and the ordering rule wins. **R20**: a task may carry a knowingly-red test across increments provided the commit body names which test is red and why, lint/typecheck/build stay green, and the redness is that increment's stated deliverable.

### Assert what the environment can observe

**R61**: jsdom sees markup, attributes, roles and stylesheet text; only a real browser sees computed style. A jsdom assertion about a rendered colour is wrong by construction. Three tests in one session asserted things their layer could not see.

**R66 / R102**: formatted numbers are asserted on `textContent`, never through a text query. Testing Library's normaliser collapses U+202F and U+00A0 as whitespace — the exact codepoints the assertion exists to check. Playwright's `toHaveText` normalises *both* sides, so an NBSP matcher and an ASCII one match the same DOM. Blind by construction, and the worst of the four because it looks strictest.

**R96**: regulatory figures are asserted against literal strings by codepoint — `"39,16\u00A0%"` — never against a formatter call. A test that asked the same function with the same wrong default could only ever agree, and `39,1 %` shipped for a declarable rate of `39,16` through a hundred-percent-covered component.

**R119**: a specified-once element is asserted by count, not presence. The standing legal disclaimer rendered twice, 60 px apart, through 1 633 green tests, because every assertion asked whether it was present and it was — twice.

**R137**: adjacency is asserted as sequence or not at all. A share row shipped above the notice explaining it; every element present, correct and individually tested, and the order wrong. Order is a property of the page, not of anything on it.

**R148**: alignment and measure are asserted geometrically. A template's head sat 100 px out of alignment with its own prose at a 616 px measure instead of 680, because nothing compared two elements' left edges.

### Fixtures

**R197**: a fixture is internally consistent as a *scenario*, not merely as rows, and **its meaning does not change with the date**. A demo year had `AUTO_DETECT` with consent in January and 259 of 261 days written `MANUAL` — every constraint held, every test passed, and the contradiction lived only between the settings and the entries. A fixture that cannot happen is worse than no fixture, because everything downstream is verified against an impossible world.

**R120**: a fixture set includes a case where two derivations of the same figure *disagree*. Agreement across all fixtures means the test cannot see which derivation the code used — which is how a panel recomputing an engine value passed.

A fixture must also be **admissible under the rules it is not testing**: a batch-limit fixture built from duplicate pairs measured the limit against input the contract refuses.

### The plant

Guards are proven by planting violations. Three rules came out of doing it badly.

**R180**: verify the plant landed before reading its result. A `String.replace` hit the first match — inside the FAQ rather than the prose — and "planted" was logged without checking the file changed. A plant that didn't land, producing a passing test, is indistinguishable from a working guard.

**R7**: proofs are adversarial. The straight violation *and* at least one evasion — a path trick, an alternate extension, a re-export, a dynamic import. An engine fence was defeated by prefixing `./` to a relative escape, and both import fences globbed `**/*.ts` while `.tsx` is exactly what an accidental React component would be.

**R178**: where a guard's first run finds live instances, those are the proof and the planted violation is redundant. Fifty unstyled anchors across seven guides are better evidence than any anchor written to be caught.

---

## 4. The guards that earn their keep

A test asserts that known behaviour still holds. A **standing guard** catches what nobody predicted — and by the close of Phase 4 the guards were finding more than the tests were.

The pattern worth noticing: **not one of them was written for the thing it caught.**

| Guard | What it caught, unprompted |
|---|---|
| `var()` census (R134) | six invented token names in freshly written styles; an invalid declaration the browser silently dropped |
| no-typed-threshold (R147, R161) | `240` in a method label; `10 ** 6` renamed to `1e6` rather than exempted |
| French typography (R91) | a question mark orphaned on its own line in the home page `h1` at 360 px |
| apostrophes (R126) | retyped French in a test; an attempted `\u` escape that would have hidden the duplication rather than removed it |
| accents (R155) | `Derniere verification` in the first chip of every article, beside fully accented prose |
| copy reachability (R238) | three orphans on its first run — one was the product's headline answer, computed and never printed |
| singleton census (R119) | a disclaimer rendered twice |
| the island harness (R122) | 207 KiB of icon library shipped into a client island |
| origin guard (R169) | fired on its own author six times |

**The lesson**: a test written for a known defect catches that defect. A cheap invariant catches the ones nobody predicted, which by this stage are the only ones left.

---

## 5. Signals that lie

This is the project's central theme, and the catalogue is worth reading in one place because the shape repeats.

**Absence read as success.**
- A suite passed **91 tests against a different application**. A 404 page has no horizontal overflow, so every narrow-viewport assertion held — *all of nothing is inside the viewport*. (R169)
- A test file walked a directory that didn't exist on a clean checkout, threw during module evaluation, reported "0 tests", and CI went red for five commits nobody read. (R63, R133)
- A `.test.tsx` glob matched nothing while the suite exited 0. Every React test invisible. (R63)
- An analytics spec requested a route that had 404'd since it was written and passed every time — an error page loads no analytics, sets no cookie, calls no third party. **The route was certified clean by never being loaded.**
- A `gate:clone` run reported PASSED having skipped every database suite, on the run whose purpose was settling database commits. Caught only because the script names what it skipped.

**A measurement that measured nothing.**
- A memory sampler reported **0 MB across 340 samples** because it matched `chrome` and the process is `headless_shell`. Zero reads exactly like a result. (R233)
- `pnpm size` reported every route 15× over budget from a stale dev build. A confident wrong number from the tool whose entire output is a number. (R192)
- A regeneration reported "2 baselines regenerated" for a run that died with `ENOMEM` and took no screenshot — the count came from `git status`. (R208)

**A mechanism that never delivered.**
- MDX silently deleted every expression: `Le plafond est de  du temps de travail annuel.` The build succeeded, claims resolved, the typed-number scan found no typed figure *because there was none*. (R154)
- A scheduled job computed every count R244 requires and **discarded them**, in a file whose header says *nobody is watching when this runs*.
- A hand-written type declaration was missing an export; its own header argued the drift was safe — an argument covering a declaration being *wrong*, not one being *incomplete*. (R185)

**Correct in isolation, wrong in composition.**
- Three pages each said something plausible about what existed; the contradiction lived only between them. (R172)
- A sign-in email pointed at a route nobody had written. Every module test passed, because each part worked alone. (R204)
- Two tests bounded a property from opposite sides and the gap between them held *linked from every page and broken* for eleven tasks. (R175)
- `/sources` opened by miscounting itself by six, after the source list grew and the sentence didn't.

**The generalisation, and it is the most useful sentence in this document:**

> A check must assert a **positive signal specific enough that only the right thing can produce it**. Not "did it respond" but "did it respond *as us*" — the foreign app answered `/api/health` with 200 and valid JSON. Not "did the command exit 0" but "did it report N tests and is N above the floor". Not "is the file there" but "does it contain the token we need". Not "did the regeneration run" but "which files did *it* say it wrote".

---

## 6. The two instruments no gate replaces

Six tasks running, both found something every time.

### The walkthrough (R176, R177)

**Run the thing and drive it.** Open the pages the task touched, use what it built, follow the links out. Against `pnpm dev` — and from FW28, against the running container (R249), because *"the Dockerfile builds" is not the claim; "this image, on this host, serves this product correctly" is.*

What it found: a page serving with no CSS at all; `/sources` contradicting its own table; the calculator's dead contextual link, closed end to end four tasks after it broke; `/api/alertes` redirecting every no-JS subscriber to `http://0.0.0.0:3000`; **Chromium unable to start in the production image**, so the product's output of record answered 503.

### The read-through and the crop

**Read the copy across pages; crop the baseline and look at it.** A baseline suite certifies that nothing changed, never that what exists is right.

What it found: a CTA sentence lifted from the pillar and false everywhere else; a default-blue link, three times, then fifty unstyled anchors below the fold of every crop taken; a regeneration that never ran; **eight defects in the PDF**, two visible only in greyscale; a privacy claim no possible code could have made true; an export shipping `"kind": "HOME"` to a French reader with every row count correct.

**And the instruction matters.** R176's second clause exists because naming two pages to scrutinise granted the other three a pass — and the page that was miscounting itself by six was one of the three. **Direct attention; never restrict it.**

---

## 7. Copy, and the one text one home family

Four rulings kept rediscovering the same principle, so it is stated once here:

> **The text a reader sees is derived from the thing it describes, never transcribed alongside it.**

- **R153** — copy in a format that cannot interpolate (YAML frontmatter, an Android string resource) names the rule, never its value. *« le plafond fiscal »*, not *« 40 % »*.
- **R163** — prose narrating a worked example is tied to the fixture the engine is gated on.
- **R167** — a citation names the instrument, not its current file. *« Choix du système d'assurance maladie »* is durable; the URL with `juin2019` in it is a dated convenience allowed to rot.
- **R206** — where two places must say the same thing, one holds the text and the other holds a key. Not a copy kept in sync, and never two strings a test compares — that test only proves they were equal when someone last looked.

The privacy notice is the worked example. Its enumeration of personal data is keyed to the columns that hold it, and when seven OAuth columns were dropped the notice stopped claiming something false about them — a scope decision that repaired a published claim automatically.

**And R238 closes the other end**: every exported copy string is reachable, or declared unreachable with the state it waits for. Its first run found the product's headline answer written and never rendered.

---

## 8. Honesty as an engineering property

This product's entire value is claiming no more than the record supports, so the rules about what it says are as load-bearing as the rules about what it computes.

**R146 — the source rule.** Every regulatory statement is either traceable to a verified line in `docs/regulatory-sources.md`, or written as an open question naming its uncertainty, or **not written**. There is no fourth option, which means a regulatory question can never force a session to stop — *(c) not written* is always available.

**R138 — tense matches code.** A claim about a feature that doesn't exist is written in the future. *« Le site ne mesure pas encore son audience »* is stronger than the sentence it replaced, because it states a fact and then promises a mechanism. Three tests pin the tense so the present cannot be quietly restored.

**R242 — and the fix is tense, not detail.** *« Dans l'application »* became *« Dans l'application mobile, lorsqu'elle sera disponible »* — the reader keeps every detail and loses only the false present tense. Applying it mechanically to every match would have made the alert-list bullet conditional, and that unsubscribe works today: **what is conditional is the way in, not the right.**

**The vocabulary ban.** The dossier never says *certifié, attesté, conforme, validé, approuvé* — only *déclaré, enregistré, horodaté*. Asserted in both directions so silence cannot pass, and asserted on the produced PDF rather than the template.

**Disclosure over reassurance.** `/sources` publishes the verified table, the three provisional interpretations, and a *what this site does not know* section. Three tasks refused to publish something for want of a source; those refusals were invisible outside the repository until the page named them.

**R205 — a file is served only when it can be believed.** An empty `assetlinks.json` is not "we haven't said yet"; it is a complete published statement that no application is associated with this domain. A 404 says what is true. A malformed fingerprint is worse: syntactically valid, verifies against nothing, and the symptom — *the link opens a browser sometimes* — is about as far from its cause as a symptom gets.

---

## 9. Contracts and permanence

Some decisions cannot be taken back, and they are treated differently.

**R187 — a schema is a contract with a client that cannot be redeployed.** From FW21 the Android app is a consumer: a column renamed later is a migration plus an app release plus every version in the field still sending the old shape. Every field is either in the spec or justified by name. **An unused column is a promise to a client that will eventually read it** — which is why seven OAuth columns were dropped rather than kept "just in case".

**The `/v1` freeze (FW23).** Three operations are forbidden: renaming a field, removing one, changing what an existing field *means*. **Additive response fields are permitted** — that asymmetry is written into the contract, because otherwise a future session reads FROZEN as "nothing changes" and leaves two round trips in place forever.

**Permanent by nature**: slugs, URL parameter names, heading anchors, published redirects, the domain. A heading in a frozen contract is an address — §8 was appended after the error codes rather than inserted beside §6, because renumbering to satisfy a reading order is the wrong trade.

**R32 and boundaries.** Ceilings are inclusive on the compliant side, because Geneva case (b) is exactly 40,00 % with the regime applying — and the old boundary painted a ship-blocking fixture's rail amber.

---

## 10. Numbers, and the two float rules

Both were found by measurement, both would have produced a wrong figure filed with a tax administration, and both are inherited by any port.

**R10 — float hygiene in proration.** `240 × 45/100 × 7/12` evaluates to `63.000000000000007`, and because the rule rounds *up*, the error survives into the denominator. Three live cases across employment rates and period fractions. Multiply before dividing, normalise before rounding, and **comment the site as float hygiene so nobody mistakes it for a rounding rule**.

**R16 — rates are computed on integers.** `23/125` is exactly 18,4 %; the float form truncates to **18,39**, and because truncation rounds toward zero the error is *biased downward and never cancels*. Normalising doesn't help. There are two float forms and both are wrong — multiply-first fails on 72 of 125 750 realistic pairs, divide-first on 172. **R10's hygiene rule does not extend to rates.**

Both live in shared fixture files consumed by every implementation, because `Double` behaves identically in Kotlin and a port inherits the defect unless a fixture forbids it.

**Three rounding behaviours coexist on purpose**, each commented with its own rule at its own site: the declarable rate **truncates** to 2 dp because it must match the AFC filing; advisory headroom **floors** to the half-day because a user must never be told they have more room than they do; the mission cap **ceils** because that is the regulation's own favourable rounding.

---

## 11. The environment

Four concurrency classes, each found the same way — something left running.

**R98** containers: a baseline is valid only from an isolated build, and orphans are checked for before any run. Two Playwright containers sharing baselines produced images that looked perfect and meant nothing.
**R105** processes: `TaskStop` releases the shell, not what it spawned. `next dev` held port 3000 after the session ended.
**R131** the working tree: a command that mutates it takes an exclusive lock.
**R179** the harness's own children: `spawn(..., { shell: true })` returns the shell's PID, so `kill()` took `cmd.exe` and left the server holding the port — serving a build whose CSS the *next* build had replaced, which read as a broken stylesheet and was really a stale server. **Kill the tree you spawned, and assert the port free before starting.**

**R169 — the suite asserts what it is pointed at, first.** Not "did something respond" — the foreign application answered `/api/health` with 200 and valid JSON. A field naming the product, or the run aborts before a single spec executes.

**R199 — `gate:clone` is a fresh clone**, not a scrubbed tree: clone at HEAD into a temp directory, install from the lockfile, generate what must be generated, run the chain, delete it. Scrubbing keeps `node_modules`, the generated Prisma client, and whatever else has accumulated. On its first run it reported PASSED having skipped every database suite, which is the rule justifying itself.

**R227 / R99 — a verifier cannot be starved.** Two unrelated flakes at the same stage, only in the clone, was a property of the environment rather than a coincidence: the clone runs an install and the full suite under more load than a warm run. A flaky verifier teaches people to re-run instead of read.

**R252 — when a check is run a new way and fails, suspect the new way first.** 54 failures from a direct vitest invocation that skipped an env file. A red result feels like diligence, which makes a false red cheaper to produce than a false green and just as expensive to act on.

---

## 12. Rulings about rulings

**R149 — a threshold raised twice is a defect in the threshold.** 2 → 3 → 4 → 5 in two tasks, each raise correct alone; the sequence said the number was tracking library growth, not harness health. Replaced by a proportional rule.

**R114 — a visual baseline runs at zero tolerance.** `maxDiffPixels: 600` was defended and falsified within the hour: five spinners were removed and six baselines silently declined to regenerate because every change came in under the allowance. When a diff is environmental, the *cause* is removed — never allowanced, never masked.

**Exemption lists are the enemy.** `NOT_PERSONAL` is asserted **empty**, so the first entry has to survive challenge rather than joining an established habit. A derived list proposing `votre → vôtre` and `des → dès` was rejected for the same reason: a guard that generates its own scope grows noise until someone silences it. The discriminator that worked — *prose contains a space* — separates French from identifiers with no list at all.

**A ruling that lists locations is wrong.** R189 named two places that held a literal; there were three, and the one it missed would have left every Lighthouse run refusing. **State the property; the locations are examples.**

**And rulings get tested rather than applied.** R117 was written to close the class the island harness had exposed, and measurement showed it did not: a component can be free on every server page and cost 200 KiB the first time it enters a client island. Testing a ruling against the thing it claims to close is the correct relationship to one.

---

## 13. What Phase 4 produced

`/api/v1` carries auth, entries, the dossier, settings, export and deletion. The dossier is computed server-side and rendered as an A4 PDF from the same print route a browser sees — one renderer, one layout, no drift. The scheduler runs the retention purge and holds the reminder behind an unconfigured sender. The image builds, refuses to start with a placeholder secret, and was proven against a running container.

**Two design decisions worth carrying forward.**

**The erasure path.** `EntryEvent` is append-only with database triggers refusing `UPDATE` and `DELETE`, and account deletion must remove those rows. Every obvious answer — a transaction-local setting, a role, a marker row — *is a way of teaching a guard to stand aside, and each is a door*. PostgreSQL deletes the parent before firing the cascade, so the trigger distinguishes a cascade from a direct delete by whether the person is still visible. **The guard never stands aside.** A caller needs a valid token and the result is total destruction of that account; there is no partial form.

**The scheduler with two containers.** No advisory lock, because the product doesn't need one: `ReminderSent` is keyed `(userId, sentOn)` and **the insert is the claim**. The second container loses on the constraint and reports `already-sent` by name. A dead container releases nothing because it holds nothing. And the test asserts **both replicas did some of it** — a correct total with one idle replica is exactly what a stuck lock looks like, and it reads as success.

---

## 14. What the Android series inherits

**The protocol ports unchanged.** One task per session, increments, commit only on green, test-first with a RED ledger, reports, rulings verbatim. Every ruling above applies; only the vocabulary changes — `./gradlew` for `pnpm`, JUnit and Kotest for Vitest, Paparazzi for Playwright screenshots, detekt and ktlint for ESLint and stylelint.

**Two things genuinely break.**

**The walkthrough.** There is no server to `curl` and no page to fetch; a Compose screen exists only on a device. The substitute is a headless emulator, `adb exec-out screencap -p`, and a person looking at the PNG — and it must be wired in AN1, because the instrument that has found the most defects in this project will otherwise be skipped with a plausible excuse in every later task.

**Secrets.** Nothing in an APK is private. No keys, no shared secrets; the environment variables become build config and Play Console settings.

**Three risks, in order.** Detection accuracy near a suburban border is the kill-risk, and AN6 measures it before any detection UI exists. Play review of background location is the schedule risk — the Console account itself has verification steps that take days. And the engine port is the correctness risk: `fixtures/geneva-cases.json`, `denominator-cases.json` and `rate-cases.json` are the contract, consumed by both CIs, and a deliberate one-digit change must fail both builds.

**What blocks nothing.** AN1–AN3 need no domain, no VPS, no credential. They can start while the human gates are being closed.

---

## 15. The human gates, still open

No amount of engineering closes these.

| | What it blocks |
|---|---|
| **`monreleve.ch`** — does not resolve | Everything. The origin is a *build* argument, so an image built before the domain exists must be rebuilt |
| **The VPS** | Any deployment; every other need is downstream of somewhere to deploy to |
| **A named expert reviewer** | Checkpoint E, and the three provisional interpretations (P1, P2, P3) |
| **The publication director** | A legal requirement on `/mentions-legales`; a named natural person, not a company |
| **EU and Swiss representatives** | GDPR Art. 27 and nLPD Art. 14 for a UK controller targeting French residents |
| **Firebase, Resend's production domain, the Android package and fingerprints** | Reminders, production email, App Links |
| **The `opendata.swiss` licence** | The LAMal/CMU comparator, parked since FW19 |

**And the verdict from the audit**: every technical criterion this codebase owns is met and was re-proven at a standard that refuses *covered by a suite* as evidence. The product cannot launch tomorrow, and the obstacle is not the software.

---

## One page, if you read nothing else

1. **A check asserts a positive signal specific enough that only the right thing can produce it.** Absence is not success.
2. **A test asserts only what its environment can observe**, and formatted numbers by codepoint.
3. **Verify the plant landed** before reading its result; make proofs adversarial; prefer a live instance to a planted one.
4. **A fixture is a scenario**, consistent and date-independent, containing a case where two derivations disagree.
5. **The text a reader sees is derived from the thing it describes**, never transcribed alongside it.
6. **Say only what the record supports** — and in the tense that matches the code.
7. **Run it and look at it.** The walkthrough and the crop have found what no gate could, in every task, for six tasks running.
8. **A permanent decision is treated as permanent**: schemas, slugs, parameters, anchors, the domain.
9. **Rulings get tested, not applied.** One that lists locations states a property badly.
10. **Stop only for the report** — and park what you would have asked.
