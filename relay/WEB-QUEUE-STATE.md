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

## STEPS

| Step | Status | Branch / SHA | Verified | Rulings |
|---|---|---|---|---|
| W1 FW-HEALTH-IMAGE | **MERGED** (Web Ruling 2). It closes QUEUE-STATE PARKED TASKS' first bullet (PARK-S3): the test's PREMISE was wrong, not the route. The image sets FRONTALIER_RUNTIME=1 and readiness evaluates the database only then; /api/health reads no database, so there is no R375 question. The spec now asserts the state its launcher declares (FRONTALIER_SERVER_IS_SERVING, set only by container-e2e.mjs). FW28's title exclusion is removed: nothing is skipped in the container. test:container:e2e runs to its end: 354 passed, the auth and PDF step 9 passed, "CONTAINER E2E PASSED". PDF: 10 pages from the image, 10 here; origin https://monreleve.example; MONRELEVE_VERIFICATION_ORIGIN unset; rendered 16:10:33-16:10:44Z | fw-health-image b12f518 (code 1bacd2f) | V1: the diff (home.spec.ts, container-e2e.mjs, the report) read against the claims; test:runtime matches only *.runtime.spec.ts, so it does not run home.spec.ts. V2: the session's gate:clone ALONE on 1bacd2f passed. **The orchestrator's gate:clone ALONE on the merge tip 589d0e8 (W1 + the run's records) PASSED, STEP_EXIT=0; pushed 1a4136f..589d0e8** (Web Ruling 3 records it) | Web Ruling 2 |
| W2 FW-PDF-A4 | **MERGED** (Web Ruling 3). The PDF is A4, read from the bytes: every page of both renders measures 595.92 x 842.88 pt (210.2 x 297.3 mm). The image runs Debian Chromium 156.0.8078.79 and this machine Playwright's Chromium 153.0.8010.12, 10 pages each. The check is ISO A4 with 1 mm per side, both stated values asserted (R345); Chromium adds 0.48 pt per side. The assertion runs in test:container:e2e, the only gated suite that renders a PDF, and the harness prints each PDF's page count and size from its own run. New selector rule: lib/export/pdf.ts, container-pdf.test.ts, container-auth.test.ts and pdf-pages.ts select test:container:e2e (R251; Web Ruling 3 keeps it). Plants: page 5 rewritten to 612x792 went RED naming it; a Letter render went RED on all 10 pages. The CSV schema is already asserted (csv.test.ts:37-56, export-csv.test.ts:318-339, against SPEC:890), so it is cited only. **NOT delivered:** monochrome print is open; 17 PDF render tests (export-pdf 15, verification-qr 2) run in NO gate, which is W3b; the harness refusal when the page line is missing is written but has never fired, a plant owed in W3b. So SPEC 21 criterion 12 stays PARTIAL | fw-pdf-a4 0f69539 (code e5bc035) | V1: the diff (container-e2e.mjs, gate-selection.mjs, container-pdf.test.ts, the new tests/support/pdf-pages.ts, and their unit tests) read against the claims. gate:changed: test 3 752, test:db 714 (+26 skipped), test:container:e2e 354 + the PDF step 9, exit 0. The session's gate:clone ALONE on e5bc035: exit 0. V2 at the merge: **the orchestrator's gate:clone ALONE on fc446b5 (W2 + record) PASSED, STEP_EXIT=0; pushed 589d0e8..fc446b5** (closed by Web Ruling 4) | Web Ruling 3 |
| W3 FW-DOSSIER-ENGINE | **MERGED together with W3b** (Web Rulings 4-5). Plan Checkpoint D item 2's PAYLOAD half: through the real route handler (app/api/v1/dossier/route GET, with a real token pair), a seeded 2026 year matches a direct lib/calc-engine computation EXACTLY. The year: 59 rows for a person at 80 %, HALF_DAY, GE, with every kind, 10 missions against a cap of 8, absences, month boundaries and split days. 22 engine figures compared with toStrictEqual; the test imports nothing from lib/dossier. The annex holds exactly the seeded days, each row with its server stamp and source. R940: before this task, NONE of (a), (b), (c) was proven through the route. Nine verified plants went RED naming the figure or row; the test passed on its first run, since no code change was allowed. No DEFECT. **NOT delivered:** the rendered page / PDF half of 'annex expanded, provenance per row' (W3c); and a part-year seed, since a full year holds periodFractionOf (lib/dossier/aggregate.ts:219) at 1 (W3c establishes coverage). **Noticed, no task:** the payload serves zone.fiscalCeilingDays as 76.80000000000001, a float on the wire, unrounded; rounding is Ask-first (SPEC 20) | fw-dossier-engine 23d780b (code 846bc19) | V1: the diff is web/tests/db/dossier-engine.test.ts and the report; the test imports GET from app/api/v1/dossier/route and the engine, nothing from lib/dossier. gate:changed: test 3 752, test:db 719 (+26 skipped). The session's gate:clone ALONE on 846bc19: exit 0. V2: the orchestrator's merge gate on the joint W3+W3b tip, PENDING until W3c's record closes it | Web Ruling 4 |
| W3b FW-PDF-RENDER-GATE | **MERGED together with W3** (Web Ruling 5). The 17 PDF render tests (export-pdf 15, verification-qr 2) skipped in EVERY gate: test:db had no server, gate:clone's test:db had none, test:container:e2e did not collect them, and CI is off. Now 17 of 17 run and pass in the container harness's existing vitest step. Pass 1 runs on the image as started; pass 2 restarts the same image with MONRELEVE_VERIFICATION_ORIGIN=https://monreleve.example (the QR test only). A per-test verdict from vitest's JSON report replaces the blind pass count. The selector now also matches export-pdf.test.ts, verification-qr.test.ts, the verdict module and print.module.scss. Plants: a renamed `[pdf]` prefix made the harness refuse by name; a 2027 year went 1 failed; a server on port 1 gave vitest exit 0 with 17 skipped, and the verdict refused 17. **The @page rule is NOT inert**, as measured: `a4 landscape` turned every MediaBox landscape, refused by the A4 check; `letter` kept A4 paper but paginated 9 -> 10, with no red (W3d). Criterion 12's "same rail" is proven by export-pdf:425 (prints the rail, AC2), now gated. **NOT delivered:** the 17 render with THIS machine's Chromium against the image's print route; only container-pdf uses the image's own Chromium. page.tsx, the export route and tests/db/support/{live-server,pdf-text,pdf-image}.ts do not select test:container:e2e yet (W3d, R267). Nothing pins the CSS page size (W3d). Monochrome print is open. So criterion 12 stays PARTIAL | fw-pdf-render-gate 94bb8ff (code cf64929, cut from W3's 23d780b) | V1: the diff (container-e2e.mjs, the new container-render-verdict.mjs + .d.mts, gate-selection.mjs and their unit tests) read against the claims. The .d.mts is asserted by declaration-parity.test.ts, which discovers every .d.mts beside a .mjs (R185). Pass 2's origin is a reserved domain on a throwaway local container; the rule against setting it binds Coolify (RULINGS-2026-11-03 Advisor Ruling 4, R332). gate:changed: test 3 765, test:container:e2e e2e 354, vitest pass 1 32 passed + 1 skipped, pass 2 1 passed + 1 skipped, verdict 33 tests and 0 refusals, exit 0. The session's gate:clone ALONE on cf64929: exit 0. V2: the joint merge gate is PENDING until W3c's record closes it | Web Ruling 5 |
| W3c FW-ANNEX-RENDERED | NOT STARTED (added by Web Ruling 4, from REPORT-FW-DOSSIER-ENGINE.txt QUESTIONS 1-2) | | | |
| W3d FW-PRINT-PAGE-PIN | NOT STARTED (added by Web Ruling 5, from REPORT-FW-PDF-RENDER-GATE.txt QUESTIONS 1-2) | | | |
| W4 FW-DB-STOPPED | NOT STARTED | | | |
| W5 FW-LIGHTHOUSE-CALC | NOT STARTED | | | |
| W6 FW-GATE-CLONE-ADMIN | NOT STARTED | | | |
| W7 FW-VISUAL-FILTER | NOT STARTED | | | |
| W8 FW-WT-SETUP-GUARD | NOT STARTED | | | |
| W9 FW-DOCS-EMAIL-FROM | NOT STARTED | | | |
| W10 FW-CALC-BYTES | NOT STARTED | | | |
| W11 FW-DELAI-RAPPEL (resume) | NOT STARTED | | | |
| W12 FW-WEB-ACCOUNT (resume) | NOT STARTED | | | |
