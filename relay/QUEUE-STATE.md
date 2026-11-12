# QUEUE-STATE - the no-phone queue (relay/ORCH-NO-PHONE-QUEUE.txt)

The queue's memory. After any compaction, or when unsure where the queue is: read this file and
`relay/RULINGS-2026-11-11.txt` first, re-verify the last DONE step (V1-V2), then continue.

**THE QUEUE ENDED on 2026-11-12 (Queue Ruling 27).** Every step C0-C11 is DONE, MERGED or
PARKED (STEPS). main was a0c1cb4 when this closing record was written; it is pushed by this
record's own commit. **Nothing this queue merged is live:** production is 52caca8, and every
promotion is parked on the Coolify token (BLOCKED 1, PARKED PROMOTIONS).
- **Re-read at 17:55:36-17:55:41 UTC on 2026-11-12, not recalled:**
  - the server serves `pkptabevr1nhtyygrq0mc8qx:52caca8cf6388cb596c9a074175756d16a867858`, "Up 10
    days (healthy)" (`ssh monreleve-vps docker ps`, filtered by this app's uuid);
  - https://monreleve.ch/api/health returns `"service":"monreleve","status":"ok"`, and
    /api/ready returns 200;
  - `git ls-remote origin` names production 52caca8.
- **No after-deploy check ran, because nothing was deployed.**

## SECURITY INCIDENTS

none

Known condition, not a new incident (Queue Ruling 5): REPORT-FW-CHROMIUM.txt section 4 read
RESEND_API_KEY and FCM_PRIVATE_KEY marked build-time in Coolify on 2026-10-21, and a build
argument is recorded in the image history WITH ITS VALUE (C2 measured the mechanism locally).
Exposure in the serving image is PRESUMED and UNMEASURED until P2 item 1's baseline count. The
containment is P2 item 5d, revoking the old keys after A5's rotation; C2 (merged) and A5 exist
for it.

## BLOCKED ON THE OPERATOR

1. **THE COOLIFY API TOKEN IS GONE.** `C:/Users/KAMXKAM/AppData/Local/Temp/cf/` exists and is empty;
   its mtime is 2026-11-10 20:02; the cause is unknown. A7 ("remove the Coolify API token when the
   queue is done") assumes it exists - it does not. **The operator's action:** in Coolify, create a
   new API token with the same read-write scope, save it as
   `C:/Users/KAMXKAM/AppData/Local/Temp/cf/tok`, and revoke the old one - its whereabouts are
   unknown, so treat it as lost. Until then (Queue Ruling 1): no `production` promotion, because
   Part B's rollback ("restore the previous deployment from Coolify at once") cannot be done; code
   lands on `main`, and each promotion is PARKED below with its exact command and after-deploy
   checks, to run in order (C1 first) when the token is back. C2's Coolify setting ("Build time" =
   "Not available during build", P2 item 1) parks the same way. **C1's is not a parked action: Coolify's deploy health check is
   DO NOT ENABLE** until QUESTION 1 below is ruled (Queue Ruling 2).

2. **C3, THE DATABASE PASSWORD ROTATION** - prepared in `relay/DB-ROTATION-PLAN.md`, never executed. **The operator's action:** authorise it with a time (it also needs Coolify - the UI, or a new token).

3. **C1's QUESTION 1 - where Coolify's deploy health check may point** (REPORT-FW-READY-GATE.txt,
   R844). Coolify 4.5.0's check, once in effect, replaces the image HEALTHCHECK for the container's
   life, and Traefik stops routing to a container that is not healthy - so `/api/ready` there
   would make readiness into liveness (R375/R357 forbid it). **In force: A, the check stays off;
   releases are gated on the image's `/api/health` only.** The operator's choice among: B, the
   image HEALTHCHECK strict on `/api/ready` until it first passes, then `/api/health` (amends
   R375); C, a start-window route; D, the entrypoint refuses an unmigrated database (crash-loop
   risk); E (remove the HEALTHCHECK, enable Coolify's) is forbidden.

4. **C1's QUESTION 4 - the 60 s start period** (the operator's own figure in the queue's C1).
   Coolify sleeps the image's start period before checking, and Traefik serves the old and the new
   container side by side meanwhile, so the window in which a page from one build can ask the
   other for a hashed chunk grows from about 20 s to about 60 s per deploy. Reasoned, not
   measured. **The operator's action:** keep 60 s, or allow a shorter start period (the
   2 s start interval makes the container healthy on its first passing probe either way).

5. **C1b's QUESTION 2 - the Chromium pin cadence.** The pin has broken twice in nine days (.47 -> .73 on 2026-11-02, .73 -> .79 on 2026-11-11): Debian keeps only the newest point release. **In force: option (a)**, an exact pin bumped by a one-line commit on each release, with a same-day madison read before every promotion (docs/deploy.md 10.1 step 2). The other options are in REPORT-FW-CHROMIUM-PIN-2.txt's NOTICED section: (b) a scheduled read-only drift check; (c) the .deb from snapshot.debian.org; (d) a prebuilt base image by digest; (e) pin the major only; (f) Playwright's Chromium. Options (c)-(f) change R249 or add infrastructure. **The operator's action:** keep (a), or choose another.

6. **REMINDERS NEED `FRONTALIER_SCHEDULER`, NOT ONLY A KEY** (C2's NOTICED, Queue Ruling 5).
   Production's startup log in October said `[scheduler] not started (non_local_database)`
   (REPORT-FW-CHROMIUM.txt, from #444's dump). Without `FRONTALIER_SCHEDULER=1` the reminder job
   never runs, whatever the FCM key. It is not the orchestrator's to set: it turns on a job that
   sends to real devices. P2 item 7's claim and C10 (FW-DELAI-RAPPEL) depend on it. **The
   operator's action:** decide whether production runs the scheduler. If yes, in the same Coolify
   visit as P2 item 1, add `FRONTALIER_SCHEDULER` = `1`, runtime only ("Build time" = "Not
   available during build"), then restart, and read the `[scheduler]` line (P2 item 6).

7. **C2's Q1, NON-BLOCKING - a quoted `FCM_PRIVATE_KEY`** (Queue Ruling 5). In force: REFUSED
   with `malformed_private_key: quoted`, and the startup line names the fix. The alternative,
   unwrapping one pair of outer quotes, widens what counts as a credential. **The operator's
   action:** none needed. Say so only if the quoted form should be accepted.

8. **C5's SEAM - the seven Parametres sheets and the start-date dialog have NO baseline**
   (PARK-PB1, PARK-PB2; Queue Rulings 7-8). The queue's C5 text says "no product change", and
   the sheets are `internal` in `:shared` and open only on a tap, so C5 could not reach them.
   There are two routes:
   - (a) a visibility-only change in `:shared`, `internal` -> `public` for the seven names, in
     R832's shape (RateRow / CalendarEditSheetContent). It needs the R573 iOS run on the branch
     and on the merge result.
   - (b) a Paparazzi test inside `:shared`'s own test set, where `internal` is visible. It needs
     a build change (Paparazzi on `:shared`).

   **Two caveats, before buying an iOS run:**
   - **Either route reaches the sheets only if Paparazzi 1.3.5 draws a modal bottom sheet
     whole.** That is NOT ESTABLISHED. C5's probes drew an AlertDialog whole but never a
     ModalBottomSheet.
   - **Neither route delivers the date picker.** Probe 2 measured Material 3's DatePickerDialog
     clipped in a fixed 320 dp window at a 392.7 dp and a 523.6 dp screen alike. A baseline of
     it needs a device capture (the S9) or a renderer answer.

   **The operator's action:** choose (a), (b), or leave PB1/PB2 parked. Whichever is chosen, its
   first increment is a throwaway probe that a ModalBottomSheet draws whole.

9. **AFTER A ROLLBACK, `production` STILL NAMES THE FAILED COMMIT** (C7's Q1, Queue Ruling 10;
   docs/deploy.md 10.1 "After a rollback").
   - Neither Coolify's Rollback nor its own "rolling back to the old container" moves the branch.
   - A deployment queued without a commit takes the "Commit SHA" setting, which defaults to
     `HEAD` and is resolved to the branch head (Coolify v4.5.0 applications.php 21;
     ApplicationDeploymentJob.php 3171-3193, 3227-3231; read by the orchestrator at the tag). A
     dockerfile app's Restart is such a deployment (job 255).
   - So the next Restart, or the next push, puts the failed commit back, with no build.

   **In force:** no restart and no variable change unless 10.1 step 0's two reads agree (the
   serving image's SHA and `production`'s head). They agreed at C0 (52caca8). This is now a
   precondition of the rotation plan and of P2 item 5b.

   **The operator's action:** decide how `production` is realigned after a rollback:
   - (a) force-push PREVIOUS to `production`. This is not a fast-forward, so it is the
     operator's alone, and its auto-deploy is another swap.
   - (b) fix forward with a new promotion from 10.1 step 0, with no restart before it.
   - (c) another rule.

10. **A ROLLBACK UNDER AN APPLIED MIGRATION** (C7's Q2, Queue Ruling 10). A rollback restores an
    image, never a schema. The previous code then runs on the migrated schema, and `/api/ready`
    cannot tell (docs/deploy.md 10.2). Nothing in the repository establishes old code against a
    new schema, and nothing reverses a migration. Not live for P1: there is no migration between
    52caca8 and the tip (read 2026-11-12). **The operator's action:** choose a rule before the
    first promotion that carries a migration:
    - roll back by image anyway;
    - fix forward only;
    - or require additive, backward-compatible migrations.

11. **THE CALCULATOR PAGE CANNOT CARRY THE HEADER'S SIGN-IN LINK UNDER GATE A** (C9, Queue
    Rulings 21-22). Every figure is gzip-9 bytes from a fresh build, as check-budgets measures it.
    - `/calculateur-teletravail-frontalier` reads **127 946 B against 128 000 B on db68601**: 54 B
      spare.
    - **The link costs about 97 B on every shell page, even rendered on the server**: the class
      map, the copy, the product-state read and lucide's client reference.
    - With the server link the calculator reads **128 042 B, 42 B over**.
    - C9's leanest candidate (no class, a wrapper element, the copy split out) reads 128 002 B,
      still 2 B over, with the header's HTML changed.
    - **Every registered route ships to this page** (orchestrator's read of db68601's saved
      chunks, Queue Ruling 23). `/guides/geneve` and `/guides/attestation-employeur-teletravail`
      are in its first-load JS, though neither the shell nor the calculator links them. The
      registry in `lib/content/routes.ts` ships whole, so ANY new route entry costs bytes here.
      Paths under `/api/` do not ship.
    - **C9 is PARKED on this alone.** **The operator's action, one of:**
      - free bytes on that route (42 B lets the server link pass) - a refactor of the calculator's
        client code, as its own gated task;
      - or set GATE A to a STATED value, for that route or for all (R2; Ask-first).
    - C9's report carries the per-route byte table and the calculator's route-only chunks
      (bytes/db68601-all-routes.txt).
      - The calculator's one route-only chunk is its page chunk, 13 827 B. In it, module 1856,
        the CalculatorForm code with the canton list, is 11 709 B.
      - Chunk 5224 (3 553 B) is loaded only by `/` and the calculator.
      - `/calculateur-lamal-cmu` has 2 402 B spare, `/` 11 270 B.
    - **C9's questions for the operator, if C9 resumes:**
      - keep or revert R898's SPEC amendment (on the branch only, not on main);
      - should a web sign-in create an account;
      - how many years the area shows.
12. **C10 FW-DELAI-RAPPEL IS PARKED ON THE MEMORY FLOOR** (Queue Rulings 25-26). From about
    15:40 UTC on 2026-11-12, commit free read 2 000-4 835 MB, with nothing of this project
    running. The holders were the Docker VM (7.66 GiB, with tizicorp's containers in it), VS Code
    and the browser, none of which a session may touch. C10's 84 reads from 16:46 to 17:13 UTC
    peaked at 4 835 MB. Each C10 commit owes a gate:changed selecting e2e and visual, which needs
    5 045 MB (Queue Ruling 25's test), so the step parked at the 17:12 deadline.
    - **The operator's action:** bring commit free to >= 5 000 MB, read by
      `[math]::Round((Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory/1024)`, then resume
      C10 from relay/FW-DELAI-RAPPEL-HANDOFF.txt in its worktree. Which apps to close is theirs.
    - **C10's questions (REPORT-FW-DELAI-RAPPEL.txt, uncommitted in C:/wt/fw-delai-rappel):**
      - Q1 (R916): a date fewer than 14 days away. Taken: no form; the server refuses it with
        nothing stored or sent, and a confirmation after the due day deletes the row ("trop-tard").
        Alternative: accept it and send at once on confirmation.
      - Q2: a confirmed address submitted again with another date is left alone (no mail, the same
        answer, so the answer reveals nothing). The alternative lets anyone cancel a confirmed
        reminder.
      - Q3: the delete link is a GET that deletes at once; a mail client that scans links can
        delete a reminder unseen.
      - Q4: after a successful send the row is gone, so the reminder's own delete link finds
        nothing. It matters only when a send reported failed but went out.
      - Q5: no upper bound on the date, so none on retention.
      - Q6: the privacy page's legal-basis paragraph (CONFIDENTIALITE_COPY.basis[1]) does not name
        the reminder.
      - Q7: R921 asks for one real sign-up with a @monreleve.test address, and .test is a reserved
        domain that cannot receive mail. Which inbox?
      - For the promotion: R921 needs FRONTALIER_SCHEDULER=1 and RESEND_API_KEY at runtime (see 6).
        Without them nothing is sent or deleted, and the new privacy sentence would describe
        deletions nothing performs.

## PARKED TASKS (outside this queue - Queue Ruling 4)

- **e2e/home.spec.ts:197 against the image.** test:container:e2e stops there (`database?.ok` expected null, received true), so it never reaches its PDF step. It was REPORT-FW-CHROMIUM-PIN.txt's QUESTION 1 and never ruled. The task first establishes which side is wrong. If the image's `/api/health` touches the database, that is an R375 question to hand back, not a test edit. Until then, the PDF proof for a Dockerfile change is C1b's fallback (REPORT-FW-CHROMIUM-PIN-2.txt R854).
- **gate:clone keeps a 14-line tail per step**, so a short unit count is invisible in its log. The step still fails on a red suite, but a run with fewer tests than before reads the same. Found by C1b (its deviation 6).
- **The annual PDF went from 9 to 10 pages between C1b and C2, cause NOT ESTABLISHED** (Queue Ruling 5). C1b: "image: 162997 bytes, 9 pages; here: 197462 bytes, 9 pages"; C2: "image: 163847 bytes, 10 pages; here: 199305 bytes, 10 pages". Both sides moved, and "here" renders the HTML served by the same container, so the change is in the served page, not in a renderer. C2's diff touches no renderer or dossier path. The baked-origin explanation is refuted by reading: the print page's only origin input is `MONRELEVE_VERIFICATION_ORIGIN`, which neither fallback set. **Until this is closed, every PDF proof records:** its page count, the image's baked origin, whether `MONRELEVE_VERIFICATION_ORIGIN` was set, and the render's UTC time.
- **`android/scripts/*.test.mjs` are run by no gate** (C4's Q3, Queue Ruling 6): apk-diff and upper-bound. The task is a suite selected on `android/scripts/**` that runs `node --test`, added through its own gated task, not in a record commit. Until then, V1 runs them by hand (apk-diff: 4/4 on 2732d39).
- **A RELEASE PREREQUISITE: worktree builds carry no commit id** (C4's NOTICED, Queue Ruling 6). All five release APKs carry `META-INF/version-control-info.textproto` = `NO_SUPPORTED_VCS_FOUND`. The likely reason, a hypothesis, is that a worktree's `.git` is a file. Every session builds in a worktree, so no release APK would carry its commit. This must be resolved, or the release built outside a worktree, before an APK is built for distribution.
- **RELEASE-RELEVANT: at 200 % font, the sign-out dialog hides the days it is about to lose**
  (C5's N2, Queue Ruling 8). `signOutPendingDialogLarge` stops at "2 journees n'ont pas pu etre
  envoyees :", and the dates and the loss sentence are cut, while the dialog still offers "Se
  deconnecter quand meme".
  - Cause read in source: `SignOutStillPendingDialog` (`:shared`,
    ParametresAccountSection.kt:99) has no `verticalScroll`, while `DeleteDialog`
    (ParametresDeleteSection.kt:46) has one. Shown in the renderer; the device was not
    consulted.
  - The fix is a product change in `:shared`, so it needs the R573 iOS run. It must move exactly
    one baseline: `ParametresScreenScreenshotTest_signOutPendingDialogLarge`, and that one is
    named now.
  - It is not a queue step, because C5 said no product change. It is a task of its own, before
    a release.
- **Paparazzi's dialog window is a fixed 320 dp** (C5's N1/N3, R872 probe 2: 319.5-320.0 dp at
  every screen width). Every recorded dialog baseline certifies the renderer's dialog width, not
  the phone's. **Waits on the S9:** is the DatePickerDialog whole on the device, and how wide is
  the AlertDialog?
- **gate:clone administers its scratch database through whatever `DATABASE_URL` names** (C6's
  Q1, Queue Ruling 9). From a checkout whose `web/.env` names `frontalier`, it opens a session
  there, but only to CREATE and DROP its own `monreleve_gate_clone_<sha8>`; no table is touched.
  The task is a fixed `postgres` admin connection. Until then, behaviour is unchanged.
- **`web/scripts/_wt-setup.mjs` and `_mint-readback.mjs` are tracked despite their "NOT
  committed" header**, and they write to whatever `DATABASE_URL` names, outside test:db's
  guard (C6's NOTICED, Queue Ruling 9). The task is to remove them or guard them. **Sessions do
  not run them.**
- Recorded, no task (Queue Ruling 9):
  - `monreleve_fw30` (the FW30 fixture) matches the pattern, so test:db pointed at it would
    empty it. It rebuilds deterministically. Accepted (C6's Q2).
  - The shared `frontalier` dev database is at 14 of the repository's 15 migrations. That is
    the operator's; no session migrates it.
  - PARK-TG2: `pnpm test:clean-tree` is red on main 4a65f42, identically before and after C6.
- **Docs still naming `EMAIL_FROM` as a setting, or the disputed 2026-10-14 date** (C7's
  NOTICED 1-4, Queue Ruling 10, R267):
  - docs/domain-checklist.md 130-132 ("deploy.md section 8 N2 lists EMAIL_FROM", stale since C7);
  - the comment at web/scripts/container-check.mjs 657 ("deleted on 2026-10-14", now marked
    disputed in docs/deploy.md section 1; the assertion does not depend on it);
  - SPEC-frontalier-web.md 1009 and tasks/todo.md 693 (EMAIL_FROM as an env setting).

  The task is one docs session. Its gate selection will include the container suite, because of
  container-check.mjs.
- **The export file's name is the server's, joined unchecked** (C8's N1, Queue Ruling 11).
  - Android `android/app/src/main/kotlin/ch/monreleve/app/MainActivity.kt:1172`
    (`java.io.File(dir, event.filename)`) and iOS
    `android/shared/src/iosMain/kotlin/ch/monreleve/app/ios/IosExportFiles.kt:44` both take the
    Content-Disposition name exactly as `filenameOf` returns it
    (`android/shared/src/commonMain/kotlin/ch/monreleve/app/data/remote/AuthApi.kt:473`).
  - A name holding a path separator or `..` would write outside `exports/`, and would then also
    escape the sign-out's export clear.
  - The name comes from our own server, so this is not an incident.
  - The task is a check in `filenameOf`, which covers both platforms. It changes `:shared`, so it
    owes the R573 iOS run.
- **`web/scripts/visual.mjs` cannot run one spec, and reinstalls node_modules on every run**
  (C9, Queue Ruling 16).
  - Its container command is fixed (line 171), and `--update` is its only argument.
  - The install into an anonymous volume takes 10.5 of the run's ~25 minutes.
  - The task is a filter pass-through and/or a cached install, as a gated change of its own with
    a test. Until then, a visual proof runs the full suite.
- **The calculator's error-state capture did not repeat; FIXED ON C9's BRANCH ONLY by R912
  (db68601). R912 is NOT on main, because C9 is parked** (Queue Rulings 15-22).
  - **Any task that regenerates `calculateur-erreur-desktop.png` takes db68601's two files first**
    (`web/e2e/calculateur.visual.spec.ts`, its blur hunk, and the baseline); otherwise its gate
    meets the drift.
  - The avis substitution (Ruling 20) was SAVED in refactor-tree and never gated.
  - **R912 is still NOT on main** (Queue Ruling 26). db68601 is pushed on C9's branch only, and
    C10's cherry-pick 764ef54 is local and unpushed. It reaches main with whichever of C9 or C10
    merges first.
  - **The frequent drift's trigger: a FOCUSED INVALID FIELD under FULL-PAGE capture.** Whether
    the fractional geometry contributes is NOT established (see "Still open").
    - Measured on Windows (r18-diagnosis-windows.txt): the vide and rempli states give one hash;
      a viewport clip of the error state gives one hash; a blurred invalid field gives one; focus
      on a valid field gives one. Only focus in the invalid field, with full-page capture, drifts.
    - No DOM mutation occurs; after 10 s of idle the first capture is unchanged, so it is a
      capture artefact.
    - Why main passed: the comparison accepts a first capture equal to the baseline, and main's
      baseline (2622489) is the usual first capture. A regeneration writes the settled image,
      which under the gate's load never settled (gate-changed-inc23-2.log: 167 passed, 1 failed).
  - **The fix (R912, e2e/calculateur.visual.spec.ts, the erreur state only):** blur
    `#taux-activite` after the fill, then assert `aria-invalid="true"`.
    - Focus draws nothing on that field: outline, box-shadow and border are computed identical
      focused and blurred, and the field crop differs by 0 of 21 744 px.
    - The page-wide bytes do change: 158 251 px, largest channel difference 127, box x 151-1285
      y 501-3470. C9 reads it as rasterisation, not visible. **The orchestrator crops and looks at
      V1 (R135).**
    - Proof (container, real visual.mjs): fixed arm 5/5 contexts with first = settled = e02bff;
      unfixed arm 3 settled hashes.
    - The gate on db68601: test:visual 168 passed, 0 failed, 0 flaky, both erreur tests on
      attempt 1. Regenerated: calculateur-erreur-desktop.png only; mobile was unchanged.
  - **Still open (Queue Ruling 20): a rarer, fainter variant remains.**
    - In ONE of three regenerations of the same code (visual-update-3.log),
      calculateur-panneau-avis-provisoire-desktop.png differed by 28 px, every channel within 1-4,
      at x 1285-1287 y 1819-2007: the result column's right edge. The first erreur compare reached
      the same edge.
    - That state ends with focus in a VALID field (#total-jours). Its cause is not established.
    - C9 commits the image update-1 and update-2 wrote identically; the gate must reproduce it.
    - The comparator's erreur test clicks submit, so its focus is on a button, and its baselines
      were stable (R267 checked).
  - Evidence: C:/wt/fw-web-account/.webaccount-evidence/ (r16-evidence-run/, r18-diagnosis*,
    r19-item1-*, r910-avis/).
- **The calculator page has 54 B of GATE A headroom** (Queue Rulings 21-22; BLOCKED 11).
  - `/calculateur-teletravail-frontalier` reads 127 946 B against 128 000 B on db68601, measured
    by C9 from a fresh build. The figure is not in gate:clone's log, whose 14-line tail cuts it
    off.
  - Any client code that the route loads, including a string in a shared copy or routes module,
    can breach GATE A.
  - `gate:changed` does not run `size`; gate:clone does. So a session touching `app/**`,
    `lib/ui/**`, `lib/fr/**` or `lib/content/**` runs build and size, from a fresh `.next`, before
    committing.
- **Two retries behind the zero tolerance** (Queue Ruling 17). `scripts/visual.mjs` passes
  `CI=true` into the container (line 318). The comment beside it is about pnpm and the
  node_modules mount, not about retries. playwright.config.ts line 26 gives `retries: 2` when CI is
  set, so a visual baseline may pass on its third attempt: R345's zero tolerance currently means
  zero tolerance over up to three captures.
  - The retries did NOT keep the drift green on main (Queue Ruling 18). In C9's flag-off run the
    error page passed on attempt 1 with no retry; the first-capture comparison is what passes it.
    The retries question stands on its own.
  - Whether the retries stay is the operator's call (R345). It is not changed in this queue.
- **C1b's `r854-fallback.sh` polls health with an unbounded `curl`**, which hung C2's first PDF run when the entrypoint refused. Later PDF proofs use C2's bounded pattern (`C:/wt/fw-secrets/.secrets-evidence/pdf-fallback.sh`: the origin read from the image's `/etc/frontalier-site-origin`, `--max-time` on curl, and a stop if the container exits).

## HOLDS (until lifted)

- **No `docker builder prune` / `system prune` / image prune on this machine** (Queue Ruling 4).
  The pin moved to `156.0.8078.79-1~deb12u1` (C1b), and the archive installed it on 2026-11-11
  (`#12 DONE 132.0s`), so a cold build passes today. The hold stays for a new reason: Debian
  keeps only the newest point release, so this cache is what keeps gates green between a Debian
  release and the next one-line bump. Cadence option (a) is in force; options (c)-(f) are the
  operator's. On the server, C2's image removal (P2 item 4) keeps the serving image and ONE previous image (C7, docs/deploy.md 10.2), and never 52caca8's while it is PREVIOUS, because it cannot be rebuilt.
- **No privileged containers**, and nothing written to the shared Docker VM's kernel tunables:
  C1 dropped the page cache twice that way (Queue Ruling 2, deviation 5). No Docker Desktop / WSL
  restart either (it can start other projects' stopped containers through their restart
  policies - the operator's, A1).
  - **A1, read on 2026-11-12 at 17:55:41 UTC:** all five containers are stopped.
    - counterworthy-postgres, mustapha-postgres and zagora-postgres-1: "Exited (0) 44 hours ago",
      from the orchestrator's one stop on 2026-11-10 at 21:44 UTC, on the operator's words that day.
    - tizicorp-app-1 and tizicorp-postgres-1 ran today, started outside this queue. Both exited
      0 at 16:55:51 UTC, not out-of-memory killed (`docker inspect`). **No session of this queue
      stopped them:** C10's transcript, parsed as JSON, holds 5 docker commands (4 exec, 1 ps)
      and no stop; the orchestrator's holds only the 2026-11-10 stop.
    - Restarting them stays the operator's.
- **THE MEMORY FLOOR (Queue Rulings 3-4) - the one home of the figure; prompts point here.** The
  old 1.5 GB free-physical floor was the orchestrator's convention, never the operator's number.
  Commit free is what decides dead workers on Windows. Read it in its own step:
  `(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory/1024`.
  - **Web heavy steps** (test:e2e, test:visual, test:container:e2e, gate:clone): commit free
    **>= 5 000 MB** before the step. Measured by C1b: gate:clone bottomed at 4 589 MB commit
    free and 261 MB free physical, with no deaths.
  - **Gradle heavy steps** (`:app:gate`, recordPaparazzi, assembleRelease): **>= 8 000 MB** after
    `./gradlew --stop`. Measured by C5 (Queue Ruling 8), one run: `:app:gate --rerun-tasks` went
    from 8 195 MB down to 3 115 MB commit free (free physical 228 MB), about 5 080 MB used, with no
    deaths. From the old provisional 7 000 MB it would have bottomed near 1 920 MB, under the
    sampler's kill line. On this machine the read after `--stop` was 8 195-8 376 MB that day.
    **A lower read means wait, never run.**
  - **Measured drops (Queue Rulings 25-26): the worst SOLO sampler run per selection, first sample
    minus minimum, over every *.samples.txt under C:/wt and the orchestrator's scratchpad, to
    2026-11-12.** A run overlapping another sampled run is excluded. The drops: gate:changed
    selecting e2e and visual 3 045 MB, test:visual:update 2 385, test:visual 2 109, gate:clone
    1 958 (gate-clone-handoff-2), base gate:changed 1 954.
    - Under 5 000, a selection runs only when the reading, taken in its own step, is >= D + 2 000
      MB; the 2 000 is the swing a neighbour's e2e made that day.
    - A sampler abort, or a red shaped like dead workers, under 5 000 is NO RESULT and is not
      retried under 5 000.
    - **ERRATUM (Queue Ruling 26):** Ruling 25 gave gate:clone 3 155 from clone-dd5231a. That
      run (13:52-14:08) overlapped C9's gate:changed (13:55) and gate:clone (14:05), so
      **dd5231a's gate:clone did not run alone.** It PASSED, and main's tip 17270f3 was then
      vouched by a solo gate:clone (14:32-14:41).
    - **The first runs under 5 000, under Queue Ruling 26** (orchestrator's record a0c1cb4):
      gate:changed (base chain) from 4 014 to 2 733 MB; gate:clone from a 4 200 MB read to
      2 311 MB, with 322 MB free physical. Both passed with no abort, but the clone came within
      311 MB of the sampler's 2 000 MB abort line. Visual runs load the Docker VM: read
    `MemAvailable` from frontalier-postgres's `/proc/meminfo` first, because an out-of-memory kill
    there can land on another project's container.
  - **Every heavy step** runs under `C:/wt/queue-evidence/run-sampled.ps1 -Label <name> -WorkDir
    <dir> -Command "<cmd>" -EvidenceDir <your evidence dir>`. It samples every 10 s and, below
    2 000 MB commit free, kills ONLY the tree it started; that is NO RESULT. The step's minimum
    commit free and free physical go in the report.
- **THE GATE OF RECORD AND CREDENTIALS (Queue Ruling 6).** A fresh worktree has no `web/.env`,
  and gate:clone then prints PASSED with the database suites SKIPPED. The gate of record is the
  run whose "ran" line names `db:deploy`, `test:db` and `test:container:write`, and V1 reads that
  line. The sampler writes its `-Command` string into the samples file, so **a credential never
  goes in `-Command`**.
  - **Since C6 (Queue Ruling 9), test:db refuses any database not named `monreleve_*`**
    (R877; the pattern's one home is `web/lib/db/scratch-database.mjs`). A verbatim copy of
    `web/.env.example` names `frontalier`, so it is refused. And its `AUTH_SECRET` placeholder
    fails 23 print tests (PARK-TG1).
  - So a session's gitignored `web/.env` is `web/.env.example` with two changes:
    - **DATABASE_URL names the session's OWN `monreleve_<task>` database** on
      frontalier-postgres (:5436). The session creates it and runs `pnpm db:deploy` on it
      (README.md has the recipe).
    - **AUTH_SECRET is generated inside a script**, never echoed and never in `-Command`. It is a
      throwaway for a scratch database, so it is within the no-secret rule.
  - **At cleanup:** `web/.env` is removed and the database dropped, shown by a read-only
    `pg_database` listing in the report.
  - The guard reads the database NAME only, on any host.
- **THE iOS TWINS (Queue Ruling 11, until PARK-IF4).** Three `:app` files have byte-identical
  copies at the same relative path under `android/shared/src/iosMain/kotlin/ch/monreleve/app/`:
  `account/DeviceLocalStore.kt`, `detection/EveningNotificationDecision.kt` and
  `detection/ThresholdAlertDecision.kt` (the `:app` originals are under
  `android/app/src/main/kotlin/ch/monreleve/app/`).
  - An edit to either copy is mirrored in the other in the same commit. `IosAndroidTwinsTest`
    fails on one byte of drift and is run by fastCheck and `:app:gate`.
  - Because such an edit changes `:shared`, it owes the R573 iOS run.
  - **Every Android session prompt includes this rule.**
- **Next ruling number: R924** (C9 holds R898-R913, C10 R914-R923).

## PARKED PROMOTIONS (run in this order once the token is back)

### P1 - ONE PROMOTION OF MAIN'S TIP, carrying C1 FW-READY-GATE and P2 item 2 (Queue Ruling 10)

**Run docs/deploy.md section 10.1 (R883) top to bottom.** It is the one home of the steps:
PREVIOUS recorded, gate:clone, the madison read, the migration check, the fast-forward push, the
deploy followed by reading, the after-deploy checks, and the rollback. This list holds only what
is specific to this promotion.

- [ ] **Order.** P2 item 1 (the Coolify settings visit) comes FIRST, so this promotion's build
      absorbs it (docs/deploy.md 10.3). After the push, change no variable until step 6's checks
      pass (10.1 step 4).
- [ ] **NEW is main's tip on the day, never b4df928 itself.** b4df928 and 52caca8 pin Chromium
      `.73`, which the archive no longer offers. The pin is `.79` from 7065b1b, so any SHA at or
      after d036e67 carries C1, C1b and C2 together. 10.1 step 2's madison read still runs the same
      day.
- [ ] **PREVIOUS is expected to be 52caca8** (C0). If step 0 reads otherwise, stop.
      **52caca8's image cannot be rebuilt** (its `.73` pin), so a rollback is possible only while
      that image is on the server. Its row must appear under Rollback images before the push.
- [ ] **Step 3, migrations:** `git diff --name-only 52caca8 <tip> -- web/prisma/migrations` was
      EMPTY on 2026-11-12 (read on fw-deploy-doc's tip 0903701). Re-run it on NEW.
- [ ] **QUESTION 1 stays open** (BLOCKED 3): Coolify's deploy check stays OFF.
- [ ] **Step 6.6, the PDF, applies:** `web/Dockerfile` changed between 52caca8 and the tip. Record
      the page count, the image's baked origin, `MONRELEVE_VERIFICATION_ORIGIN` set or not (by
      name), and the UTC time (PARKED TASKS, 9 -> 10 pages).
- [ ] **The rollback call.** It is the UI's Rollback page (10.1 step 7), or the API's own endpoint
      `POST /api/v1/applications/pkptabevr1nhtyygrq0mc8qx/rollback` with `{"commit": "<PREVIOUS>"}`
      (Coolify v4.5.0 routes/api.php 289; ApplicationsController.php 6243-6310). That endpoint
      queues the same `rollback: true, force_rebuild: false` deployment as the button. It is not
      the deploy endpoint the standing rule forbids. **The operator says which of the two may be
      used BEFORE the promotion**, not during a failed one (Queue Ruling 10).
- [ ] **After any rollback: BLOCKED 9.** `production` still names NEW, so no restart and no
      variable change until it is realigned.

### P2 - C2 FW-SECRETS (item 1 BEFORE P1's promotion, item 2 IS that promotion, items 3-7 after it; needs the token back, and A5's keys for item 5)

From REPORT-FW-SECRETS.txt's R862, amended by Queue Ruling 5. Every server command names this
app's uuid. Counts only: never print a history line or a value.

- [ ] 1. **THE BUILD-TIME SETTING (R860), one Coolify visit.** Re-read the variables in Coolify
      first (names and settings only). Then take the BASELINE: item 3's command, run on the image
      serving NOW. If RESEND_API_KEY or FCM_PRIVATE_KEY counts above 0, the exposure is measured
      (SECURITY INCIDENTS' known condition) and item 5d becomes urgent. Then, for each of the
      first six rows of docs/deploy.md section 2's table ("Build time or runtime"): Environment
      Variables -> the row's gear "Edit environment variable" -> "Build time" = "Not available
      during build" (Runtime stays "Available in the container") -> "Update variable".
      In the same visit: **EMAIL_FROM** is read by nothing (Queue Ruling 5's grep), so delete it
      or keep it, the operator's call (C2's Q4). **FRONTALIER_SCHEDULER** is BLOCKED 6.
      **Also read in this visit, by name and setting (Queue Ruling 10):**
      - the application's "Commit SHA" setting (default `HEAD`; BLOCKED 9 rests on it);
      - its "Images to keep" setting, and the server's Docker cleanup settings;
      - `DATABASE_URL`'s "Build time" (the rotation plan's precondition).

      Deleting `EMAIL_FROM` or a leftover `CHROMIUM_VERSION` (both build-time) makes the next
      deployment of any kind a build (docs/deploy.md 10.3). So this visit comes immediately before
      P1's promotion, whose build absorbs it, and never between a push and its checks.
- [ ] 2. **THE DEPLOY IS P1's PROMOTION** (Queue Ruling 10): docs/deploy.md 10.1 on main's tip,
      which carries d036e67. Item 2 comes before item 5, so R861's detail is live when the new key
      is pasted.
- [ ] 3. **THE NEW IMAGE'S HISTORY, counted per name**, on the server:
      `ssh monreleve-vps 'C=$(docker ps -q --filter name=pkptabevr1nhtyygrq0mc8qx | head -1); I=$(docker inspect --format "{{.Image}}" "$C"); echo "image $I"; for n in NEXT_PUBLIC_SITE_URL DATABASE_URL AUTH_SECRET RESEND_API_KEY FCM_PRIVATE_KEY FCM_CLIENT_EMAIL FCM_PROJECT_ID EMAIL_FROM ANDROID_PACKAGE_NAME; do printf "%s %s\n" "$n" "$(docker history --no-trunc --format "{{.CreatedBy}}" "$I" | grep -cw "$n")"; done'`
      Expected: NEXT_PUBLIC_SITE_URL above 0 (the presence control, R169), every other name 0.
      The secret names are the `secret: true` entries of web/lib/deploy/placeholders.mjs.
- [ ] 4. **THIS APP'S OLD IMAGES (hygiene, not containment).** Only after P1 has put the .79 pin
      in production. **KEEP the serving image and ONE previous image, PREVIOUS** (docs/deploy.md
      10.2, R884: Coolify rolls back only to an image still on the server; each further step back
      needs one more image). **52caca8's image is never removed while it is PREVIOUS**: it cannot
      be rebuilt (its `.73` pin). Coolify's own cleanup keeps 2 by default, which for this app's
      naming is read as serving plus one, so the list may already show only those. List
      first: `ssh monreleve-vps "docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}
      {{.CreatedAt}}' pkptabevr1nhtyygrq0mc8qx"` and the serving image's id. Then remove, one tag
      per command, each tag that is neither serving nor a rollback image: `ssh monreleve-vps
      "docker image rm pkptabevr1nhtyygrq0mc8qx:<tag>"`. **No build-cache prune** (Queue Ruling 5,
      Q3 (a)): no filter names one app's cache, and a server-wide prune needs the operator's own
      words.
- [ ] 5. **THE ROTATION, with A5's keys.**
      a. Coolify -> Environment Variables -> RESEND_API_KEY -> gear -> the new key, "Build time" =
         "Not available during build" -> "Update variable". The same for FCM_PRIVATE_KEY, and for
         FCM_CLIENT_EMAIL / FCM_PROJECT_ID if the new key belongs to another service account.
         FCM_PRIVATE_KEY is the JSON file's "private_key" value without its surrounding quotation
         marks, on one line, with its newlines left as the two characters \n.
      b. Restart the application from Coolify (a restart applies changed env, measured
         2026-10-28). **Precondition, for this restart and item 6's** (Queue Ruling 10, BLOCKED
         9): docs/deploy.md 10.1 step 0's two reads agree, the serving image's SHA and
         `production`'s head. Otherwise the restart redeploys `production`'s head.
      c. Item 6 must pass before item d.
      d. **MANDATORY - THIS IS THE CONTAINMENT** (Queue Ruling 5): revoke the old keys. Resend ->
         API Keys -> the old key -> delete. Google Cloud console -> IAM & Admin -> Service
         Accounts -> the account -> Keys -> the old key id -> delete. Whatever is left in old
         images or the build cache becomes revoked keys.
- [ ] 6. **THE STARTUP LOG:** `ssh monreleve-vps "docker logs \$(docker ps -q --filter
      name=pkptabevr1nhtyygrq0mc8qx | head -1) 2>&1 | grep -E '^\[(push|scheduler)'"`. Expected:
      "[push] Firebase credentials found: reminders will be delivered." If it still refuses, it
      now reads "[push] no push sender (malformed_private_key: <shape>): <one sentence>"; fix the
      paste as the sentence says, then restart. The `[scheduler]` line says whether the job can
      run at all (BLOCKED 6).
- [ ] 7. **THE PROOF AVAILABLE:** "the sender initialises" (item 6's line), and no more. A test
      reminder needs a test device registered in production by a signed-in app (the operator's,
      with the S9), the scheduler running (BLOCKED 6), and a reminder due.

## WAITS ON THE APPLE ACCOUNT (IOS-1b-B)

IOS-1b-B needs an app host: a bundle identifier, entitlements and a window scene, and so the
Apple account. Its input is REPORT-IOS-2f.txt R894 (R839's list, updated by C8) and parking.md
PARK-IF1..IF4:
- **PARK-IF1:** the sync scheduler (BGTaskScheduler).
- **PARK-IF2:** the share sheet.
- **PARK-IF3:** posting the evening reminder and the threshold alert, and asking for
  notification permission.
- **PARK-IF4:** the move that ends the three copies. It is an `android/app` task, with
  `:app:gate` and the R573 run.

**To settle before any host calls them** (Queue Ruling 11):
- **C8's deviation 2:** on iOS, `KeychainAccountStore.setCurrent` THROWS when a Keychain write is
  refused; Android ignores a failed write.
- **C8's Q1:** how far ahead the evening reminder is scheduled, and how "already notified" is
  learnt for a reminder that fired while the app was closed. Android never schedules ahead, so
  "the same as Android" does not settle either.
- **C8's Q2:** on iOS the Keychain items (the token pair, the pending address, the account tag)
  survive a reinstall, unlike everything else. Whether the first launch clears them is open.

## macOS MINUTES (cap: 60 per step, 200 for the queue)

| step | run | billed min | running total |
|---|---|---|---|
| (start) | - | 0 | 0 |
| C8 IOS-2f | 43174150607 on 2567ceb (the planned RED: 375 tests, 20 failures, all in new classes) | 10 | 10 |
| C8 IOS-2f | 43177226628 on 39a384e (SUCCESS: 375 tests, 0 failures) | 4 | 14 |
| C8 IOS-2f | the orchestrator: none. R573 was met by 43177226628 (Queue Ruling 11) | 0 | 14 |

Billed minutes are the job's wall time rounded up to the minute. For every iOS run, the timing
API reads MACOS `total_ms` 0, so its figure is not taken as the cost (C8's N2).

The 27 minutes of IOS-2d / IOS-2e / IOS-2e-FIX on 2026-11-11 predate the queue.

**Final, read at the queue's end:** `gh run list --workflow ios-shared.yml` shows no run after
43177226628, so the queue spent **14 billed minutes** of its 200.

## EVIDENCE OUTSIDE THE REPO

`C:/wt/queue-evidence/run-sampled.ps1` is the memory sampler every heavy step runs under (Queue Ruling 4; copied from C1b, with only the evidence directory made a parameter). `C:/wt/fw-chromium-pin-2/.pin2-evidence/` holds C1b's logs. `C:/wt/fw-secrets/.secrets-evidence/` holds C2's (gate logs with sampler files, the R858 plant, the R861 RED and leak plant, and the bounded `pdf-fallback.sh`).

`C:/wt/queue-evidence/` - the release APKs and gate logs copied out of the IOS-2d/2e/2e-FIX
worktrees before A6 removes them, with `SHA256SUMS.txt`: 52da740 `e1cf60f7`, 0616b4e = 19ce23f
`463dc949`, 9a6dd55 `cc77402f`, cf485c4 `355afca5`. C4 reads these.

**Beside A6 (Queue Ruling 6):** the four release builds' R8 `mapping.txt`, their only
deobfuscation key, are now saved in `C:/wt/queue-evidence/mappings/<sha>.mapping.txt`. They were
copied from the original worktrees (52da740 from ios2c-fix, 0616b4e from ios2d, 9a6dd55 from
ios2e, cf485c4 from ios2e-fix), each equal to C4's copy and in SHA256SUMS. U1's two `next()`
listings are in `C:/wt/queue-evidence/u1/`. SHA256SUMS has 22 entries, all OK. A6's removal of
ios2d, ios2e and ios2e-fix loses nothing that is recorded. `C:/wt/an-apk-diff` (clean, pushed,
about 431 MB of evidence plus web/node_modules) stays until the operator's cleanup; nothing in it
is needed by a later step.

`C:/wt/an-param-baselines` (clean, pushed) holds C5's evidence in `.param-evidence/`: gate logs
with sampler files, both R872 probes' images and crops, `expected.txt` / `produced.txt`, and
`r874-diffstat.txt`. It also holds web/node_modules and the Gradle build directories. It stays
until the operator's cleanup.

`C:/wt/fw-testdb-guard` (clean, pushed) holds C6's `.testdb-evidence/`: gate logs, the sentinel
and `frontalier` snapshots, and the R878 refusal logs. `C:/wt/fw-deploy-doc` (clean, pushed) holds
C7's `.deploydoc-evidence/`, six gate logs with their sampler files. Both also hold
web/node_modules and stay until the operator's cleanup.

`C:/wt/ios2f` (clean, pushed, lock removed) holds C8's `.ios2f-evidence/`:
- gate logs with their sampler files;
- both iOS runs' job logs and JUnit XML (`run1/`, `run2/`);
- `run1-expected.txt`, written before run 1 was dispatched;
- the RED logs of the two twins plants;
- `park-id-regex.txt`.

It also holds web/node_modules and the Gradle build directories, and stays until the operator's
cleanup.

**The orchestrator's scratchpad is copied to `C:/wt/queue-evidence/orchestrator/`** (Queue Ruling
27). The rows' V2 logs and samples (`clone-<sha>`, `changed-*`), qr1..qr26, the edit and read
scripts (`floor-drops.cjs`, `route-in-chunks.cjs`, `docker-cmds.cjs`), and the Coolify source
read for C7 are all copied out of Temp. That makes 2 536 files, checked against
`C:/wt/queue-evidence/orchestrator.SHA256SUMS` taken from the source: 2 536 OK, 0 failed. The
secret scan matched only templates, generators, the local development URL committed in
`web/.env.example`, and the Coolify source's own key-format strings.

**`C:/wt/fw-delai-rappel` MUST NOT BE REMOVED** (Queue Ruling 26).
- C10's increment 1 is uncommitted there, its scratch copy (increments 2-6) is in
  `.rappel-evidence/base-src/web`, and its report and handoff are uncommitted.
- Copied to `C:/wt/queue-evidence/fw-delai-rappel/`: 9 dirs, 187 OK against their SHA256SUMS.
- The scratch database `monreleve_fw_delai_rappel` on frontalier-postgres is C10's, migrated to
  16 migrations and kept for the resume.

**`C:/wt/fw-web-account` MUST NOT BE REMOVED** (Queue Ruling 22).
- C9's increment exists only in its gitignored `.webaccount-evidence/`, so `git status` there
  reads clean and nothing else protects it. It holds:
  - `gated-tree-1/` (164 files, MANIFEST.txt);
  - `refactor-tree/` (diff sha 7cd5727e33d4d125);
  - `inc4-tree-2/`;
  - the regenerated 109 baselines, with their provenance.
- It also holds every diagnosis and gate log of Rulings 12-22.
- **COPIED 2026-11-12:** the whole `.webaccount-evidence/` (1 340 files, 727 MB) to
  `C:/wt/queue-evidence/fw-web-account/`. Every file was checked against
  `C:/wt/queue-evidence/fw-web-account.SHA256SUMS`, taken from the source before the copy
  ("COPY VERIFIED"). The saved trees' own `saved-trees-sha.txt` checks 239 OK and 0 FAILED. Its
  12 indented section lines match the report: refactor-tree tracked.diff 7cd5727e, pre-gate-tree
  30e0d295, gated-tree-1 MANIFEST 43ab21c8, inc4-tree-2 ceafd862. `switch-tree.sh` restores any
  of them onto its base commit and checks the sha.
- **Resume cost:** if C10 lands first, C9's privacy files and baselines need a rebase and a fresh
  regeneration.

## SERVER ACCESS

SSH `monreleve-vps` (root on the shared VPS 164.132.85.231, key `id_ed25519_monreleve_vps`). Within
authority for what the queue asks (Queue Ruling 1). Every docker command names this app's uuids:
app `pkptabevr1nhtyygrq0mc8qx`, database `poxl2l4x0p0fxd85or0itnxo`. First contact 2026-11-11,
read-only: `hostname; whoami; docker ps | grep <uuids>` and one `docker inspect` of the app
container.

## C11 - THE GUIDE AND THE HUB (PARKED FOR THE OPERATOR'S DECISION)

**The trigger did not fire.** The queue runs C11 "when FW-CALCS-A2's report lists the overlap"
between /guides/droit-option-lamal-cmu and the comparator page. REPORT-FW-CALCS-A2.txt does not
list it: a grep for overlap, droit-option-lamal-cmu, Search Console and redirect returns nothing,
and none of the FW-CALCS-A2 prompts asked for it. Nothing in the repository measures the overlap.

**What the repository does show (main bf2b77b, read 2026-11-11):**
- The guide's frontmatter `title` (content/guides/droit-option-lamal-cmu.mdx) and the comparator's
  `LAMAL_COPY.metaTitle` (lib/fr, set by R675) both open on the droit d'option. The two pages
  compete for that query.
- Their roles already differ in the copy:
  - The guide explains the deadline, the four situations that open it and why the choice is
    irrevocable, and gives no amount. Its last FAQ answer says so and points to the comparator.
  - The comparator computes the two annual costs, and its DeadlineHelper gives the indicative
    date (PARK-CA11).

**The options, without figures** (this machine has no Search Console access; the figures are the
operator's):
1. **Keep both, with distinct roles.**
   - The guide keeps the droit d'option query.
   - The comparator's `metaTitle` moves to the cost question and stops opening on the droit
     d'option.
   - Each page links the other where its role ends (the guide's FAQ link exists already).
   - Cost: one copy change that reopens R675's title, and the comparator's baselines move. No
     redirect.
   - Risk: the page currently ranked for the query may lose position while the titles settle.
2. **Redirect the guide to the comparator (308)**, folding the guide's content into the
   comparator page as its explanatory section.
   - Cost: a published URL is retired, which SPEC section 14 treats as permanent, so this needs
     an explicit ruling. The guide's FAQ structured data moves or is lost, and the cluster and
     related links are rewired.
   - Risk: the most-shown page changes URL.
3. **Do nothing:** keep both as they are and re-read the figures after a quarter.

**The operator's action:** export from Search Console, for both URLs over the last 3 months: clicks,
impressions, average position and the top queries. Then choose among options 1-3. A session then
writes the chosen option as a task, with its baselines named (R207).

## STEPS

| step | status | SHAs | verified how | rulings |
|---|---|---|---|---|
| C0 is the new design live | DONE | production 52caca8 | deployed image read on the server: `pkptabevr1nhtyygrq0mc8qx:52caca8cf6388cb596c9a074175756d16a867858`; /api/health 200 naming monreleve; /api/ready 200 (database ok); /calculateur-lamal-cmu serves R743's "Individuelle"/"Commune", copy that exists only from the fw-calcs-a2 merge. ADDENDUM 1 was never delivered (FW-CALCS-A2.txt's orchestrator note), so "both addenda" = addendum 2 under the exception it restates. ORCH-A2-LIVE (named, nonexistent) not needed. | Queue Ruling 1 |
| C1 FW-READY-GATE | MERGED, readiness gate NOT delivered - releases still gated on liveness only; promotion PARKED (P1) | branch b339a88 (code ef88fa3); merge b4df928 | V1: tips, 5-file diff, merge tree == branch tip on web/docs/report; gate:clone PASSED on ef88fa3 (session log); r847.log both directions (unmigrated exit=1 + 503 `unmigrated`, migrated exit=0 + 200); R846 value tests. V2: gate:clone PASSED on bf2b77b, the commit carrying this row (scratchpad clone-bf2b77b.log, EXIT 0), before its push. At that time the Chromium layer came from cache; C1b has since installed .79 from the archive (Queue Ruling 4). V3: Queue Ruling 2. QUESTIONS 1 and 4 -> BLOCKED 3-4; Q2 -> step C1b; Q3 curl confirmed. | Queue Ruling 2 |
| C1b FW-CHROMIUM-PIN-2 (Queue Ruling 2, before C2) | MERGED - the pin is 156.0.8078.79-1~deb12u1; no promotion of its own (it rides P1, item 0) | branch 0df4463 (code 8559d89); merge 7065b1b | V1 checks: diff bf2b77b..8559d89 = web/Dockerfile 1+/1-. R852: madison 18:06:22Z offered .79 and 150.0.7871.100; the R249 refusal on bf2b77b is "#14 6.960 R249: ... .73 ... not installable". gate:changed on 8559d89: 3622 passed, test:container 22, chromium "#12 DONE 132.0s" from the archive, live binary 156.0.8078.79. gate:clone PASSED on 8559d89 (STEP_EXIT=0, ABORTED=False); its normalized log has every step tail identical to clone-bf2b77b.log. R854: container:e2e 352 passed, 1 failed at home.spec.ts:197 (parked task); the fallback container-auth + container-pdf on the .79 image gave 9 passed, "[pdf] image: 162997 bytes, 9 pages". R855: visual 168 passed, none moved; three warm starts 2.31 / 2.29 / 2.33 s, not comparable with C1's. Memory minimums: commit free 4 589 MB, free physical 219 MB, no deaths. Merge tree == branch on web/docs/report. V2: gate:clone PASSED on f0ff349, the commit carrying this row (scratchpad clone-f0ff349.log: GATE:CLONE PASSED, STEP_EXIT=0, ABORTED=False; minimum commit free 6 932 MB, free physical 243 MB). main was pushed bf2b77b..f0ff349. | Queue Rulings 3-4 |
| C2 FW-SECRETS | MERGED - R858-R862 in; the Coolify setting, deploy, image count, image hygiene and key rotation PARKED as P2 | branch 82bdc17 (code 8c27bb9); merge d036e67 | V1: merge-base f0ff349; 12 files +1193/-18; web/Dockerfile comment only, ARG set NODE_IMAGE / CHROMIUM_VERSION / NEXT_PUBLIC_SITE_URL. Logs read from C:/wt/fw-secrets/.secrets-evidence/: gate:clone PASSED on 8c27bb9 ("tree clean", STEP_EXIT=0, ABORTED=False, min commit free 6 775 MB); gate:changed GATE PASSED before each commit (3624 / 3626 / 3641; test:container 28; test:db 714); session minimum commit free 4 945 MB, no deaths. PDF fallback 9 passed, "image ... 10 pages; here ... 10 pages" (the 9 -> 10 move is a parked task). Secret-shape scan of the diff: 0. V3 (Queue Ruling 5): three reads PASSED - history printed as names and counts only; the refusal detail reaches no route; the twice-escaped key throws ERR_OSSL_UNSUPPORTED at signing while the control signs, so deviation 1 stands. Merge tree == branch tip (b104a05). V2: gate:changed on the record (base chain, 3641 passed, STEP_EXIT=0); gate:clone PASSED on ab1a583, the commit carrying this row (scratchpad clone-ab1a583.log: GATE:CLONE PASSED, STEP_EXIT=0, ABORTED=False; minimum commit free 6 698 MB, free physical 926 MB). main was pushed f0ff349..ab1a583. | Queue Ruling 5 |
| C3 DB password rotation (prepare) | PARKED FOR THE OPERATOR (prepared, never executed) | - | relay/DB-ROTATION-PLAN.md: inventory, backup, stage env, ALTER ROLE, restart, align Coolify record, verify both directions (old password refused, new accepted), backups, rollback. Option B struck by C1's R844 (Queue Ruling 2): the release gate is the image's `/api/health`, which a container with a wrong password passes. Basis: relay/QUEUE-2026-10-28.txt "A Coolify restart applies env (measured)" - not re-run (no token). **Operator action:** authorise the rotation with a time; then the plan runs as written. | - |
| C4 AN-APK-DIFF | MERGED - the size explained (16 KiB alignment padding before the first .so); every dex difference tied to a commit; UNEXPLAINED U1 closed as layout-only by reading; NO release hold | branch d9192e8 (code f171564); merge 2732d39 | V1: merge-base ab1a583; 3 files (report, apk-diff.mjs, its test), no Android source. Logs in C:/wt/an-apk-diff/.apk-diff-evidence/gates/: gate:clone PASSED on f171564 with db:deploy, test:db, test:container:write in its "ran" line (run 2; run 1 skipped the database suites and is not of record), STEP_EXIT=0, ABORTED=False, min commit free 6 511 MB; gate:changed base chain 3641 passed on the script and on the report. :app:gate not run (no Android source or build change). V3 (Queue Ruling 6): the mappings saved and hash-verified; apk-diff.mjs only reads; `node --test` 4/4 on the merge tree; U1 read in both dex listings: two v32 = 0 paths share block 0035, the store to v10 is dead at 00aa, the exit is one return-void, and the try range moved with its code. Merge tree == branch tip (6cf4e51). V2: gate:changed on the record (base chain, 3641 passed, STEP_EXIT=0); gate:clone PASSED on 12e0e27, the commit carrying this row, its "ran" line naming db:deploy, test:db and test:container:write (scratchpad clone-12e0e27.log: STEP_EXIT=0, ABORTED=False; minimum commit free 6 760 MB, free physical 1 419 MB). main was pushed ab1a583..12e0e27. | Queue Ruling 6 |
| C5 AN-PARAM-BASELINES | MERGED - **the seven Parametres sheets and the start-date dialog NOT delivered** (PARK-PB1, PB2; and PB3, the delete dialog with its word typed; the seam is BLOCKED 8). Delivered: 17 baselines (the list x5 states, its 11 state-driven dialogs, licences) through :app's public ParametresScreen and LicencesScreen | branch c2ff34d (code f5d39c9); merge 7a5c5a8 | V1: merge-base 12e0e27; 22 files, 17 PNGs all "A", nothing under android/app/src/main, android/shared or web. The list re-issued at d9853f6 (01:40:23Z) precedes record-1 (01:40:42Z) and is mechanically equal to the 17 that landed. Logs in C:/wt/an-param-baselines/.param-evidence/: **`:app:gate --rerun-tasks` ran on f5d39c9**, "test floor OK: 1416", "BUILD SUCCESSFUL in 8m 47s", STEP_EXIT=0. `git diff --quiet f5d39c9 7a5c5a8 -- android` exit 0. gate:clone PASSED on f5d39c9 and c2ff34d, "ran" naming db:deploy, test:db and test:container:write. register-coverage OK (224). Secret scan 0; sampler cmd= lines 0. Deviation 4: web/.env pointed at the maintenance database `postgres`, handed to C6 as live state. V3 (Queue Ruling 8): four reads PASSED. ParametresHost calls the public overload MainActivity calls; maxPercentDifference = 0.0 is read in both classes; the 100 % dates are numeric; N2's missing verticalScroll was read in source. N2 parked as release-relevant, N1/N3 on the S9, Gradle floor 8 000 MB. Merge tree == branch tip (f626a13). V2: gate:changed on the record (base chain, 3641 passed, STEP_EXIT=0). gate:clone PASSED on 4a65f42, the commit carrying this row, its "ran" line naming db:deploy, test:db and test:container:write (scratchpad clone-4a65f42.log: STEP_EXIT=0, ABORTED=False; minimum commit free 7 153 MB, free physical 2 341 MB; "DIRTY" = the 79 untracked operator files, 0 tracked changes). main was pushed 12e0e27..4a65f42. | Queue Rulings 7-8 |
| C6 FW-TESTDB-GUARD | MERGED - test:db refuses any database not named `monreleve_*` before a test file loads; CI on `monreleve_ci`; every later session's web/.env changes (HOLDS) | branch 4e0f008 (code d34a007); merge 074680b | V1: merge-base 4a65f42; 13 files +1499/-10. The guard runs while the config is evaluated, after `--env-file` loaded web/.env; every tests/db connection reads DATABASE_URL. Logs in C:/wt/fw-testdb-guard/.testdb-evidence/: R878 refusal on frontalier_guard_sentinel exit 1, its table counts and tup_inserted / tup_deleted unchanged; `frontalier` refusal exit 1, counts before == final. gate:changed passed before each commit (test:db 714; unit 3641 -> 3724). gate:clone PASSED on 4e0f008, "ran" naming db:deploy, test:db and test:container:write. No URL in any sampler cmd=. R879 is shown by the census test only; **CI NO RESULT (off)**. V3 (Queue Ruling 9): three reads PASSED. The guard test's spawns use db.invalid; the census is a scan, not a list (it does not walk tests/unit or android/scripts); production's database "postgres" (docs/deploy.md, 2026-10-14) is refused. **LIMIT: the guard reads the name only, on any host.** Merge tree == branch tip (2814fbb). V2: gate:changed on the record (base chain, 3724 passed, STEP_EXIT=0). gate:clone PASSED on 2accbac, the commit carrying this row, its "ran" line naming db:deploy, test:db and test:container:write (scratchpad clone-2accbac.log: STEP_EXIT=0, ABORTED=False; minimum commit free 7 102 MB, free physical 1 068 MB). That run was the first from a checkout whose web/.env names `frontalier`: the guard admitted gate:clone's own monreleve_gate_clone_2accbac6, and pg_database afterwards lists only frontalier, postgres, template0 and template1. main was pushed 4a65f42..2accbac. | Queue Ruling 9 |
| C7 FW-DEPLOY-DOC | MERGED - docs/deploy.md section 10 (promote, check, roll back) from Coolify v4.5.0's source. **Section 10 has never been run, and no rollback of this app has ever run.** Keep ONE previous image (P2 item 4). Q1 / Q2 -> BLOCKED 9-10; P1 now points at 10.1 | branch 0903701 (code 165cc7b); merge c3638db | V1: merge-base 2accbac; 2 files (docs/deploy.md +471/-13, the report). Logs in C:/wt/fw-deploy-doc/.deploydoc-evidence/: gate:changed passed before each commit (base chain, 3724); gate:clone PASSED on b2ea738, 165cc7b and 0903701, "ran" naming db:deploy, test:db and test:container:write, STEP_EXIT=0. No URL in any sampler cmd=; secret scan 0; report ASCII; R886-R887 unused. V3 (Queue Ruling 10): eleven citations re-read by the orchestrator at 5ca69705 and all match: Rollback.php 59-65, job 255, 1182/1189, 1459, 1530, 3171-3193, 3227-3231, 5276-5284, 5337-5345, applications.php 21, CleanupDocker 335-338, and the API's rollback route (api.php 289, ApplicationsController 6243+). 10.3 matches the orchestrator's 2026-10-28 record. The runbook's paths all exist and its commands select: 52caca8..tip has NO migration, and the PDF check applies. The 13 removed lines are only the curl passage and corrections (a)-(c). Merge tree == branch tip (8cf1e6b). V2: gate:changed on the record (base chain, 3724 passed, STEP_EXIT=0). gate:clone PASSED on 108af5c, the commit carrying this row, its "ran" line naming db:deploy, test:db and test:container:write (scratchpad clone-108af5c.log: STEP_EXIT=0, ABORTED=False; minimum commit free 7 284 MB, free physical 950 MB). main was pushed 2accbac..108af5c. | Queue Ruling 10 |
| C8 IOS-2f | MERGED - the four iOS pieces that need no app host, green on the CI simulator: KeychainAccountStore and Android's own DeviceLocalStore over the iOS stores (R889); iosSyncDrain, syncFollowUp and IosSyncTrigger.cancel (R890); IosExportFiles (R891); IosNotificationPlan over Android's two decision files (R892). **Their host halves are NOT delivered:** BGTaskScheduler, the share sheet and posting notifications are PARK-IF1..IF3 (WAITS ON THE APPLE ACCOUNT). Three :app files are byte-identical copies in iosMain (PARK-IF4; HOLDS) | branch 7d7edf7 (code 39a384e); merge 5fe042d | V1: merge-base 108af5c; 25 files, +2549/-0. Name-status shows no path under android/app, commonMain or androidMain. The three twins' blobs equal :app's (61a8e7a, b29ec2f, bd51bf8). Both runs were read from their own JUnit XML in C:/wt/ios2f/.ios2f-evidence/: 43174150607 on 2567ceb, 375 tests and 20 failures, every one in a new class that run1-expected.txt (written before dispatch) named; 43177226628 on 39a384e, 375 tests and 0 failures. 14 billed min (job wall time; the timing API reads 0). `:app:gate` on 39a384e: "test floor OK: 1416", "BUILD SUCCESSFUL in 6m 22s", STEP_EXIT=0; it started at 8 443 MB after --stop and bottomed at 3 547 MB commit free and 382 MB free physical. The twins guard is in the gate's graph: `:shared:testDebugUnitTest` UP-TO-DATE, with IosAndroidTwinsTest at 3 tests and 0 failures. gate:clone PASSED on 2567ceb, 39a384e and 7d7edf7: "tree clean", "ran" naming db:deploy, test:db and test:container:write. fastCheck r892 and r892b were NO RESULT (the `&&` pair's log held no output); r892c is green. Secret scan 0; no URL in any sampler cmd=; the report is ASCII; R888-R895 are cited only on ios2f, and R896-R897 are unused; pg_database lists frontalier, postgres, template0 and template1. Deviation 10: every fastCheck started below the Gradle floor (5 483-7 171 MB). Recorded as run: no abort and no worker death. The floor stays. V3 (Queue Ruling 11): R573 is met by 43177226628 with no fresh run. Main had not moved (merge-base == main == 108af5c); the android/ tree is 77aff97 at 39a384e, at 7d7edf7 and at the merge; and 39a384e..7d7edf7 changes only REPORT-IOS-2f.txt and parking.md, both in the workflow's paths-ignore. Merge tree == branch tip (6a224d6). V2: gate:changed on the record (base chain, 3724 passed, STEP_EXIT=0). gate:clone PASSED on 863edb0, the commit carrying this row, its "ran" line naming db:deploy, test:db and test:container:write (scratchpad clone-863edb0.log: STEP_EXIT=0, ABORTED=False; minimum commit free 6 711 MB, free physical 2 200 MB; "DIRTY" = the 79 untracked operator files, 0 tracked changes). main was pushed 108af5c..863edb0. | Queue Ruling 11 |
| C9 FW-WEB-ACCOUNT | **PARKED WHOLE (Queue Ruling 22), on BLOCKED 11 alone.** The header link costs about 97 B on every page, and the calculator page has 54 B. FULL GATE NOT RUN on the increment (refactor-tree, diff sha 7cd5727e). Branch tip 00e2d17 (R898 7af6a06, handoffs c2f5cd3 and 18882cf, R912 db68601, the PARKED report 00e2d17); NOT to be merged: R898 amends SPEC for an area main would not have. The increment is saved unpushed and copied out (EVIDENCE). V1 (parked): ls-remote fw-web-account 00e2d17; 5 files +599/-2 from 863edb0; the report says PARKED and FULL GATE NOT RUN, 0 non-ASCII; secret scan 0; gate:clone PASSED on 00e2d17, tree clean, ran naming db:deploy, test:db, test:container:write; the worktree clean, lock and web/.env gone, pg_database frontalier/postgres/template0/template1; no PDF proof owed (the PDF paths print nothing). ERRATUM to the pushed report: the GATE B floor is 103 014 B (round(100.6 x 1024), as check-budgets computes it), not 103 028; no other figure moves. The R907 security table reads NOT PROVEN on the branch; R909 and R911 were not run. Ran from 863edb0 (worktree C:/wt/fw-web-account, branch fw-web-account); deploy PARKED (R911). Queue Ruling 12: the privacy notice changes for R899 (WEB_STATEMENTS.noCookies names the account area's one cookie; a webSession disclosure line), and page-confidentialite-desktop.png and page-confidentialite-mobile.png move. Queue Ruling 13: those two and the header link land in ONE regeneration of 109 baselines, which are not committed until (1) an independent shell-derived expectation equals them, (2) 168 - 109 is reconciled, and (3) every diff's bounding box except the two privacy files sits in the header band. **The promotion gains one item: the operator reads the new notice sentences (the account cookie, the webSession disclosure, the neutral sign-in purpose) and the sign-in mail's code sentence before it ships** (it does not block the merge). **Owed at C9's RESUME (not done; C9 parked):** rerun Ruling 12's condition 2 grep (cookie, no-account and app-only claims in lib/fr and content/guides); crop the header at the narrowest phone width (R135); check the privacy claim is tied to R900's cookie tests; open erreur-diff-crop.png (Queue Ruling 14). Queue Ruling 14: calculateur-erreur-desktop.png changes about 20 anti-aliased pixels outside the header. It stays in the regeneration, which waits on a cmp of all 109 files against the compare run, the branch's style changes, and one render with the flag off against the old baseline. Queue Ruling 15: the cmp found that capture does NOT repeat (47 px at the stepper groups' corners, between two runs of one tree); 108 of 109 are byte-identical. Ruling 14's flag-off render is withdrawn for this file (NO RESULT). **Authorised deviation from C9's scope:** C9 makes the error-state capture repeat, with no threshold, mask, retry or sleep (R345), proven by at least two distinct hashes unfixed and five identical fixed; at most two fix attempts, then a STOP. Queue Ruling 16: the proof runs through the real visual.mjs, unchanged, with a temporary spec of two arms (current and fixed steps, five fresh contexts each), removed before the clean-tree regeneration. Queue Ruling 17 (withdrawn by 18): park the drift and ship the regenerated baseline. Queue Ruling 18: the gate failed that file after both retries (the page never settles under load), so the baseline cannot ship. C9 has one diagnosis, one fix (its own commit, R912) and one container run; otherwise C9 is PARKED whole at c2f5cd3 and C10 starts. Queue Ruling 19: the cause is a FOCUSED INVALID FIELD under full-page capture (other states, viewport clips and a blurred field each give one hash). The fix blurs the field in the erreur spec (R912, its own commit on 18882cf), blocked on two reads (focus draws nothing visible, or a clipped baseline keeps it; the field stays invalid after the blur). The proof counts every capture, first included; any later container failure on this file is the fallback, not a rerun. R912 landed as db68601 (gate: test:visual 168 passed, 0 flaky). Queue Ruling 20, the last on its baselines: calculateur-panneau-avis-provisoire-desktop.png comes from the twice-written regeneration (update-1 = update-2), not update-3; the increment ships on ONE gate or C9 parks. **At V1 also open r910-avis/.** Queue Ruling 21: the header link breached GATE A on the calculator (125.3 KiB against 125.0), so the link moves to a SERVER component passed into PublicShell. The budget stays. Before the gate: the route table unchanged, the header byte-identical per call site, a calibrated size reading, the prop required. **At V1, open the new image's whole body**, not only the crop. **Moves to whichever of C9 or C10 merges first (Queue Ruling 26; neither has merged, so no migration is on main):** P1's "main's tip" and "empty migration list" become false once that branch merges, so either pin P1's NEW to 863edb0 with C9 as its own promotion after it, or restate P1 with the migration and R911's checks - the operator's choice. **V2 of its records:** dd5231a's gate:clone PASSED but did NOT run alone: it ran 13:52-14:08 while C9's own gate:changed (13:55) and gate:clone (14:05) ran (Queue Ruling 26). 17270f3's gate:clone PASSED solo (14:32-14:41) and vouches for that tip. main was pushed 863edb0..dd5231a, then dd5231a..17270f3 | 00e2d17 (not merged) | see V1 above | Queue Rulings 12-23, 26 |
| C10 FW-DELAI-RAPPEL | **PARKED WHOLE (Queue Rulings 25-26), on the memory floor alone (BLOCKED 12).** FULL GATE NOT RUN; nothing gated; nothing pushed (ls-remote of fw-delai-rappel is empty). Local commit 764ef54 only (R912, cherry-picked from db68601; `git diff --quiet db68601 HEAD -- web` exit 0). Increment 1 is uncommitted in the worktree (10 modified, 5 untracked web paths); increments 2-6 are in the scratch copy. The report REPORT-FW-DELAI-RAPPEL.txt is uncommitted (status line "PARKED. FULL GATE NOT RUN; nothing committed"). Ran from 17270f3 (worktree C:/wt/fw-delai-rappel, branch fw-delai-rappel); deploy PARKED (R921). Increment 0 is a BYTE PROBE (Queue Ruling 23): the calculator page has 54 B and every registered route ships to it; the comparator has 2 402 B. The P1 item (main's tip, the empty migration list) blocks C10's record commit. Queue Ruling 24: increment 1 carries the table, the disclosure sentence and the twoCases fix, with page-confidentialite-desktop/-mobile named before the run (the order rule withdrawn as worded). R912 (db68601) is cherry-picked FIRST. **The branch merges WHOLE or not at all**: increment 1 alone states a retention nothing performs yet. **At V1:** run the shift comparison on the two privacy files. Queue Ruling 25: from about 15:40 UTC on 2026-11-12, commit free read 2 000-4 000 MB with nothing of this project running; the holders are the Docker VM (7.66 GiB, tizicorp's containers in it), VS Code and the browser. Increment 1 is ready and ungated, and increments 2-6 are green in a scratch copy; durability means checksummed trees under C:/wt/queue-evidence/fw-delai-rappel/ plus a relay/ handoff, with no commit. Measured floor (worst sampler drop + 2 000): gate:changed+e2e+visual 5 045, visual:update 4 385, visual 4 109, base gate:changed 3 954; gate:clone 5 155 as Ruling 25 read it, corrected by Queue Ruling 26 to 3 958 (solo runs only). Nothing cleared at 3 856 MB, so the 5 000 stood. As it happened: the message to C10 said a flat 5 000; C10 read up to 4 835, above visual:update's 4 385, which does not reopen the park, since each C10 commit owes the 5 045 gate. Deadline 17:12 UTC, then PARK whole. Durability DONE (16:44 UTC), with nothing committed beyond 764ef54 (R912) and nothing pushed. The evidence is C:/wt/queue-evidence/fw-delai-rappel/: 8 dirs, each with a SHA256SUMS from the source; the orchestrator re-ran sha256sum -c and got 183 OK and 0 failed. The scratch copy is C:/wt/fw-delai-rappel/.rappel-evidence/base-src/web (increments 2-6). The scratch DB is monreleve_fw_delai_rappel on frontalier-postgres, with 16 migrations including 20261112120000_deadline_reminder. The handoff is relay/FW-DELAI-RAPPEL-HANDOFF.txt in the worktree. **V1 (parked, the orchestrator's reads):** at the park the evidence is 9 dirs (park/ added: the report, the current handoff, the floor samples), 196 files, and sha256sum -c gives 187 OK and 0 failed. inc1-R914's 15 code files equal the worktree today, and park/'s report and handoff equal the worktree's. The secret scan of all 196 files is 0 (positive control: 2 of 2 planted lines found), with no .env anywhere. The lock, web/.env and the scratch .env are gone; pg_database lists frontalier, monreleve_fw_delai_rappel, postgres, template0 and template1. The report and handoff have 0 non-ASCII. No PDF proof is owed (the PDF paths print nothing). The byte probe is in the report: calculator 127 945 B (55 spare, identical files), comparator 126 622 B with the stub (1 378 spare), routes.ts and product-state.ts diff empty. The migration 20261112120000_deadline_reminder is additive: one table, its indexes and three check constraints. **Owed at C10's RESUME:** D1, the scratch database suites never run together; D2, the R917 and R920 REDs and the rendered privacy test are verified plants, not tests first; D3, scratch-final's confidentialite.test.tsx is stale, so never restore scratch-final over the worktree wholesale. The later edits (the privacy copy fix, the census numbers, the rendered privacy tests) were never typechecked, linted or run in a full suite. Then the shift comparison on the two privacy files at V1 (Queue Ruling 24). R914-R923 stay C10's. **Resume note:** C9 and C10 both change the privacy notice, its censuses and page-confidentialite-desktop/-mobile.png; the second to merge rebases and regenerates. **V2 of its record a0c1cb4:** gate:changed base chain, 3 724 passed, STEP_EXIT=0, from 4 014 down to 2 733 MB commit free. gate:clone PASSED on a0c1cb4, "ran" naming db:deploy, test:db and test:container:write, STEP_EXIT=0 and ABORTED=False, from a 4 200 MB read down to 2 311 MB (322 MB free physical); "DIRTY" = the 79 untracked operator files, 0 tracked changes. Afterwards pg_database listed frontalier, monreleve_fw_delai_rappel, postgres, template0 and template1. main was pushed 17270f3..a0c1cb4 | 764ef54 (local only; not pushed, not merged) | see V1 in this row | Queue Rulings 23-27 |
| C11 the guide and the hub | PARKED FOR THE OPERATOR - trigger not fired (REPORT-FW-CALCS-A2 lists no overlap) | - | the options and the operator's action in the C11 section above; no Search Console access here | - |
