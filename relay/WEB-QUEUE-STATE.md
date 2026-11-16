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

## STEPS

| Step | Status | Branch / SHA | Verified | Rulings |
|---|---|---|---|---|
| W1 FW-HEALTH-IMAGE | **MERGED** (Web Ruling 2). It closes QUEUE-STATE PARKED TASKS' first bullet (PARK-S3): the test's PREMISE was wrong, not the route. The image sets FRONTALIER_RUNTIME=1 and readiness evaluates the database only then; /api/health reads no database, so there is no R375 question. The spec now asserts the state its launcher declares (FRONTALIER_SERVER_IS_SERVING, set only by container-e2e.mjs). FW28's title exclusion is removed: nothing is skipped in the container. test:container:e2e runs to its end: 354 passed, the auth and PDF step 9 passed, "CONTAINER E2E PASSED". PDF: 10 pages from the image, 10 here; origin https://monreleve.example; MONRELEVE_VERIFICATION_ORIGIN unset; rendered 16:10:33-16:10:44Z | fw-health-image b12f518 (code 1bacd2f) | V1: the diff (home.spec.ts, container-e2e.mjs, the report) read against the claims; test:runtime matches only *.runtime.spec.ts, so it does not run home.spec.ts. V2: the session's gate:clone ALONE on 1bacd2f passed. **The orchestrator's gate:clone ALONE on the merge tip 589d0e8 (W1 + the run's records) PASSED, STEP_EXIT=0; pushed 1a4136f..589d0e8** (Web Ruling 3 records it) | Web Ruling 2 |
| W2 FW-PDF-A4 | **MERGED** (Web Ruling 3). The PDF is A4, read from the bytes: every page of both renders measures 595.92 x 842.88 pt (210.2 x 297.3 mm). The image runs Debian Chromium 156.0.8078.79 and this machine Playwright's Chromium 153.0.8010.12, 10 pages each. The check is ISO A4 with 1 mm per side, both stated values asserted (R345); Chromium adds 0.48 pt per side. The assertion runs in test:container:e2e, the only gated suite that renders a PDF, and the harness prints each PDF's page count and size from its own run. New selector rule: lib/export/pdf.ts, container-pdf.test.ts, container-auth.test.ts and pdf-pages.ts select test:container:e2e (R251; Web Ruling 3 keeps it). Plants: page 5 rewritten to 612x792 went RED naming it; a Letter render went RED on all 10 pages. The CSV schema is already asserted (csv.test.ts:37-56, export-csv.test.ts:318-339, against SPEC:890), so it is cited only. **NOT delivered:** monochrome print is open; 17 PDF render tests (export-pdf 15, verification-qr 2) run in NO gate, which is W3b; the harness refusal when the page line is missing is written but has never fired, a plant owed in W3b. So SPEC 21 criterion 12 stays PARTIAL | fw-pdf-a4 0f69539 (code e5bc035) | V1: the diff (container-e2e.mjs, gate-selection.mjs, container-pdf.test.ts, the new tests/support/pdf-pages.ts, and their unit tests) read against the claims. gate:changed: test 3 752, test:db 714 (+26 skipped), test:container:e2e 354 + the PDF step 9, exit 0. The session's gate:clone ALONE on e5bc035: exit 0. V2 at the merge: the orchestrator's gate:clone on its record commit is PENDING until W3's record closes it | Web Ruling 3 |
| W3 FW-DOSSIER-ENGINE | NOT STARTED | | | |
| W3b FW-PDF-RENDER-GATE | NOT STARTED (added by Web Ruling 3, from REPORT-FW-PDF-A4.txt QUESTION 2) | | | |
| W4 FW-DB-STOPPED | NOT STARTED | | | |
| W5 FW-LIGHTHOUSE-CALC | NOT STARTED | | | |
| W6 FW-GATE-CLONE-ADMIN | NOT STARTED | | | |
| W7 FW-VISUAL-FILTER | NOT STARTED | | | |
| W8 FW-WT-SETUP-GUARD | NOT STARTED | | | |
| W9 FW-DOCS-EMAIL-FROM | NOT STARTED | | | |
| W10 FW-CALC-BYTES | NOT STARTED | | | |
| W11 FW-DELAI-RAPPEL (resume) | NOT STARTED | | | |
| W12 FW-WEB-ACCOUNT (resume) | NOT STARTED | | | |
