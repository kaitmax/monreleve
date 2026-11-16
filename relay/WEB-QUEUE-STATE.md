# WEB-QUEUE-STATE - the web run (relay/ORCH-WEB-COMPLETE.txt)

Started 2026-11-16 from main 1a4136f (production 52caca8). If context was
compacted or you are unsure where you are: read this file and
`relay/RULINGS-2026-11-16.txt` first, re-verify the last DONE step (V1-V2),
then continue.

The previous queue's record, `relay/QUEUE-STATE.md`, is closed. Its BLOCKED 1-12,
PARKED TASKS and PARKED PROMOTIONS still stand. A W-task that closes one of them
says so here; that file is not edited.

## SECURITY INCIDENTS

None in this run.

## MEMORY

- 2026-11-16: commit free read 3 389 MB. The operator said "close them" (A-1);
  the orchestrator closed brave, Z-Library, jetbrains-toolbox and WhatsApp.Root;
  commit free then read 10 200 MB. CCleaner (elevated) refused and was left alone.
- 2026-11-16, after W2: brave is running again (2 995 MB), and commit free read 5 358 MB. It
  is NOT closed again on the earlier answer (Web Ruling 3); the heavy gates wait on it.
- **Measured drops (start reading minus minimum, solo):**
  - W2's gate:changed selecting test:container:e2e and test:db: 7 802 -> 3 057 = **4 745**
    (vmmemWSL 7 450 MB mid-run), so its start line is **6 745**.
  - W2's gate:clone: 6 317 -> 3 641 = **2 676**, above QUEUE-STATE's 1 958, so gate:clone's
    start line is now **4 676**.
  - W1's gate:clone: minimum 5 126; W1's gate:changed: minimum 6 339.
  - W3's gate:changed selecting test:db: 6 781 -> 4 239 = **2 542**, so its start line is
    **4 542**. W3's gate:clone: 6 632 -> 5 054 = 1 578; gate:clone's line stays **4 676**.
  - W3b's gate:changed selecting test:container:e2e WITHOUT test:db: 7 419 -> 3 979 =
    **3 440**, so its start line is **5 440**. The pair (container e2e + test:db) keeps
    **6 745**. W3b's gate:clone: 7 163 -> 5 587 = 1 576.
  - W3d, in parallel mode inside the hold: gate:changed with container e2e and test:db 7 673 ->
    4 349 = 3 324; gate:clone 7 897 -> 6 062 = 1 835. Recorded, and NO line is lowered
    (Web Ruling 7).

## LIVE SESSIONS (parallel mode, Web Ruling 7)

The heavy-run lock is C:/wt/.heavy-run.lock, driven by C:/wt/.run-tools/heavy-lock.mjs (outside
the repository). Allowance: +300 MB on every start line per OTHER live session.

| Session | Worktree | Base | Ports | Lock |
|---|---|---|---|---|
| W3e FW-PERIOD-FRACTION | C:/wt/fw-period-fraction | 56b7116 | 3500-3599 | uses the lock |
| W10 FW-CALC-BYTES | C:/wt/fw-calc-bytes | 56b7116 | 3600-3699 | uses the lock |
| W6 FW-GATE-CLONE-ADMIN | C:/wt/fw-gate-clone-admin | 56b7116 | 3700-3799 | uses the lock |
| W11 FW-DELAI-RAPPEL (resume) | C:/wt/fw-delai-rappel (IN PLACE) | 17270f3 (+764ef54) | 3800-3899 | uses the lock |
| the orchestrator | C:/wt/web-orch | main | 3900-3999 | merge gates with --priority; scratch database monreleve_web_orch (created and migrated 2026-11-16, proven by schema-constraints.test.ts: 31 passed) |

Only one selector-touching task (gate-selection.mjs or its test) is live at a time: W3d is
merged, so W4 is next, then W5. W7's R962 is checked before it launches.

## FOR THE OPERATOR (added by this run)

1. **The part-year day-count basis** (Web Ruling 6). No source states how a part year is
   prorated, so the product states its own convention: calendar days from the start to
   31 December, both included, over the days in the year (W3e). It is pending the expert
   reviewer: confirm it, or name the rule.
2. **The reminder's legal basis** (Web Ruling 8, R1005). CONFIDENTIALITE_COPY.basis[1] does
   not name the droit d'option reminder. The wording is yours; it blocks the reminder's
   PROMOTION, not its merge.
3. **Which inbox receives the reminder's real test sign-up** at promotion (Web Ruling 8,
   R1006). @monreleve.test is a reserved domain that cannot receive mail.

## STEPS

| Step | Status | Branch / SHA | Verified | Rulings |
|---|---|---|---|---|
| W1 FW-HEALTH-IMAGE | **MERGED** (Web Ruling 2). It closes QUEUE-STATE PARKED TASKS' first bullet (PARK-S3): the test's PREMISE was wrong, not the route. The image sets FRONTALIER_RUNTIME=1 and readiness evaluates the database only then; /api/health reads no database, so there is no R375 question. The spec now asserts the state its launcher declares (FRONTALIER_SERVER_IS_SERVING, set only by container-e2e.mjs). FW28's title exclusion is removed: nothing is skipped in the container. test:container:e2e runs to its end: 354 passed, the auth and PDF step 9 passed, "CONTAINER E2E PASSED". PDF: 10 pages from the image, 10 here; origin https://monreleve.example; MONRELEVE_VERIFICATION_ORIGIN unset; rendered 16:10:33-16:10:44Z | fw-health-image b12f518 (code 1bacd2f) | V1: the diff (home.spec.ts, container-e2e.mjs, the report) read against the claims; test:runtime matches only *.runtime.spec.ts, so it does not run home.spec.ts. V2: the session's gate:clone ALONE on 1bacd2f passed. **The orchestrator's gate:clone ALONE on the merge tip 589d0e8 (W1 + the run's records) PASSED, STEP_EXIT=0; pushed 1a4136f..589d0e8** (Web Ruling 3 records it) | Web Ruling 2 |
| W2 FW-PDF-A4 | **MERGED** (Web Ruling 3). The PDF is A4, read from the bytes: every page of both renders measures 595.92 x 842.88 pt (210.2 x 297.3 mm). The image runs Debian Chromium 156.0.8078.79 and this machine Playwright's Chromium 153.0.8010.12, 10 pages each. The check is ISO A4 with 1 mm per side, both stated values asserted (R345); Chromium adds 0.48 pt per side. The assertion runs in test:container:e2e, the only gated suite that renders a PDF, and the harness prints each PDF's page count and size from its own run. New selector rule: lib/export/pdf.ts, container-pdf.test.ts, container-auth.test.ts and pdf-pages.ts select test:container:e2e (R251; Web Ruling 3 keeps it). Plants: page 5 rewritten to 612x792 went RED naming it; a Letter render went RED on all 10 pages. The CSV schema is already asserted (csv.test.ts:37-56, export-csv.test.ts:318-339, against SPEC:890), so it is cited only. **NOT delivered:** monochrome print is open; 17 PDF render tests (export-pdf 15, verification-qr 2) run in NO gate, which is W3b; the harness refusal when the page line is missing is written but has never fired, a plant owed in W3b. So SPEC 21 criterion 12 stays PARTIAL | fw-pdf-a4 0f69539 (code e5bc035) | V1: the diff (container-e2e.mjs, gate-selection.mjs, container-pdf.test.ts, the new tests/support/pdf-pages.ts, and their unit tests) read against the claims. gate:changed: test 3 752, test:db 714 (+26 skipped), test:container:e2e 354 + the PDF step 9, exit 0. The session's gate:clone ALONE on e5bc035: exit 0. V2 at the merge: **the orchestrator's gate:clone ALONE on fc446b5 (W2 + record) PASSED, STEP_EXIT=0; pushed 589d0e8..fc446b5** (closed by Web Ruling 4) | Web Ruling 3 |
| W3 FW-DOSSIER-ENGINE | **MERGED together with W3b** (Web Rulings 4-5). Plan Checkpoint D item 2's PAYLOAD half: through the real route handler (app/api/v1/dossier/route GET, with a real token pair), a seeded 2026 year matches a direct lib/calc-engine computation EXACTLY. The year: 59 rows for a person at 80 %, HALF_DAY, GE, with every kind, 10 missions against a cap of 8, absences, month boundaries and split days. 22 engine figures compared with toStrictEqual; the test imports nothing from lib/dossier. The annex holds exactly the seeded days, each row with its server stamp and source. R940: before this task, NONE of (a), (b), (c) was proven through the route. Nine verified plants went RED naming the figure or row; the test passed on its first run, since no code change was allowed. No DEFECT. **NOT delivered:** the rendered page / PDF half of 'annex expanded, provenance per row' (W3c); and a part-year seed, since a full year holds periodFractionOf (lib/dossier/aggregate.ts:219) at 1 (W3c establishes coverage). **Noticed, no task:** the payload serves zone.fiscalCeilingDays as 76.80000000000001, a float on the wire, unrounded; rounding is Ask-first (SPEC 20) | fw-dossier-engine 23d780b (code 846bc19) | V1: the diff is web/tests/db/dossier-engine.test.ts and the report; the test imports GET from app/api/v1/dossier/route and the engine, nothing from lib/dossier. gate:changed: test 3 752, test:db 719 (+26 skipped). The session's gate:clone ALONE on 846bc19: exit 0. V2: **the orchestrator's gate:clone ALONE on b6f3295 (W3 + W3b + record) PASSED, STEP_EXIT=0; pushed fc446b5..b6f3295** (closed by Web Ruling 6) | Web Ruling 4 |
| W3b FW-PDF-RENDER-GATE | **MERGED together with W3** (Web Ruling 5). The 17 PDF render tests (export-pdf 15, verification-qr 2) skipped in EVERY gate: test:db had no server, gate:clone's test:db had none, test:container:e2e did not collect them, and CI is off. Now 17 of 17 run and pass in the container harness's existing vitest step. Pass 1 runs on the image as started; pass 2 restarts the same image with MONRELEVE_VERIFICATION_ORIGIN=https://monreleve.example (the QR test only). A per-test verdict from vitest's JSON report replaces the blind pass count. The selector now also matches export-pdf.test.ts, verification-qr.test.ts, the verdict module and print.module.scss. Plants: a renamed `[pdf]` prefix made the harness refuse by name; a 2027 year went 1 failed; a server on port 1 gave vitest exit 0 with 17 skipped, and the verdict refused 17. **The @page rule is NOT inert**, as measured: `a4 landscape` turned every MediaBox landscape, refused by the A4 check; `letter` kept A4 paper but paginated 9 -> 10, with no red (W3d). Criterion 12's "same rail" is proven by export-pdf:425 (prints the rail, AC2), now gated. **NOT delivered:** the 17 render with THIS machine's Chromium against the image's print route; only container-pdf uses the image's own Chromium. page.tsx, the export route and tests/db/support/{live-server,pdf-text,pdf-image}.ts do not select test:container:e2e yet (W3d, R267). Nothing pins the CSS page size (W3d). Monochrome print is open. So criterion 12 stays PARTIAL | fw-pdf-render-gate 94bb8ff (code cf64929, cut from W3's 23d780b) | V1: the diff (container-e2e.mjs, the new container-render-verdict.mjs + .d.mts, gate-selection.mjs and their unit tests) read against the claims. The .d.mts is asserted by declaration-parity.test.ts, which discovers every .d.mts beside a .mjs (R185). Pass 2's origin is a reserved domain on a throwaway local container; the rule against setting it binds Coolify (RULINGS-2026-11-03 Advisor Ruling 4, R332). gate:changed: test 3 765, test:container:e2e e2e 354, vitest pass 1 32 passed + 1 skipped, pass 2 1 passed + 1 skipped, verdict 33 tests and 0 refusals, exit 0. The session's gate:clone ALONE on cf64929: exit 0. V2: **the joint gate:clone ALONE on b6f3295 PASSED; pushed fc446b5..b6f3295** (Web Ruling 6) | Web Ruling 5 |
| W3c FW-ANNEX-RENDERED | **MERGED** (Web Ruling 6). W3's seeded year moved to ONE home, tests/support/seeded-year.ts. dossier-engine.test.ts has no assertion changed, is still 5 passed, and prints 22 byte-identical figures. New tests/db/annex-rendered.test.ts renders the print page's real handler for that year and reads cells by column, each column found from its lib/fr heading. 59 recorded rows (57 days, two of them split) are each present, with their provenance words (COPY.annex constants) and their stamp (formatDateTime of the seeded firstRecordedAt). 264 rows are printed in all, the 205 unlogged weekdays included. Not in print-route.test.ts, whose beforeEach deletes every user. Plants: a missing stamp, an enum printed for words, the afternoon rows dropped, and the client's claimed time in the stamp column. Each went RED naming the day. **Checkpoint D item 2, where each half is proven:** payload = engine through the route (W3); A4 from the PDF bytes (W2); annex expanded and provenance per row on the RENDERED PAGE the PDF prints from (W3c), not read from the PDF bytes. **NOT delivered:** R988, the part-year test, and its fraction plant. SPEC states no day-count basis for periodFraction (W3e) | fw-annex-rendered 7bbdebc (code 0d2339f) | V1: the diff is the support module, the new test and dossier-engine.test.ts. Its only changed line matching 'expect' is a comment. lib, app, prisma and scripts are unchanged. gate:changed: test 3 765, test:db 722 (+26 skipped, the same 26). The session's gate:clone ALONE on 0d2339f: exit 0. V2: **the orchestrator's gate:clone ALONE on 56b7116 (W3c + record) PASSED, STEP_EXIT=0; pushed b6f3295..56b7116** (closed by Web Ruling 9) | Web Ruling 6 |
| W3e FW-PERIOD-FRACTION | RUNNING from 56b7116, parallel (added by Web Ruling 6, from REPORT-FW-ANNEX-RENDERED.txt QUESTION 1) | | | |
| W3d FW-PRINT-PAGE-PIN | **MERGED** (Web Ruling 9), by fast-forward. R267's second site is closed: the container PDF step's selector rule now reads IMPORTS (containerPdfClosure). The modules the print page and the export route ALONE render through select test:container:e2e: page.tsx, the export route, print-token, render-queue, issuance/record, verification/origin, lib/ui/react/index.ts and the tests/db/support PDF helpers. A census test pins the 18 paths. Six shared neighbours are asserted NOT to select it. R991: the image's served stylesheet's @page size must equal the keyword for lib/export/pdf.ts's exported PDF_FORMAT ('A4' -> `a4`). That export is the only renderer change, and it is behaviour-preserving. Plant: `size: letter` PASSED every gate before (CONTAINER E2E PASSED, 10 pages) and fails after, naming both values. Q2 needs no task: W3b's verdict refuses a test that never passed, so a skipped R991 test already fails the step. **NOT delivered:** the shared modules the PDF prints through (ThresholdRail.tsx, lib/fr/dossier.ts, lib/dossier/*) select test:db, which renders the print page's HTML (print-route, annex-rendered), but not the container step. So the PDF's paint of shared styles is not proven on their edits. The page size has two homes (R993) | fw-print-page-pin 0630977 (code f7be4fe) | V1: the diff (pdf.ts: the PDF_FORMAT export only; gate-selection.mjs + .d.mts, container-pdf.test.ts, the new tests/support/css-page.ts, and their unit tests) read against the claims. gate:changed: test 3 811, test:db 722 (+27 skipped), container e2e 354 + pass 1 33 + pass 2 1, verdict 34 tests and 0 refusals, exit 0. The session's gate:clone on f7be4fe: exit 0. It ran INSIDE the orchestrator's hold of the lock in W3d's name, so no other heavy run overlapped; three sessions' light work did. V2: the orchestrator's merge gate is PENDING until the next record | Web Ruling 9 |
| W4 FW-DB-STOPPED | NOT STARTED | | | |
| W5 FW-LIGHTHOUSE-CALC | NOT STARTED | | | |
| W6 FW-GATE-CLONE-ADMIN | RUNNING from 56b7116, parallel | | | |
| W7 FW-VISUAL-FILTER | NOT STARTED | | | |
| W8 FW-WT-SETUP-GUARD | NOT STARTED | | | |
| W9 FW-DOCS-EMAIL-FROM | NOT STARTED | | | |
| W10 FW-CALC-BYTES | RUNNING from 56b7116, parallel | | | |
| W11 FW-DELAI-RAPPEL (resume) | RUNNING in place (C:/wt/fw-delai-rappel), parallel, from relay/FW-DELAI-RAPPEL-RESUME.txt (Web Rulings 8-9) | | | |
| W12 FW-WEB-ACCOUNT (resume) | NOT STARTED | | | |
