# Detection model — the recorded parameters

SPEC §13.1 requires this file to record the polygon source and date, the buffer distance,
the hysteresis constants, the tier thresholds, the sampling and background mechanics, the
battery measurements, and — if activated — the geofence contingency. It is filled in as
the AN6 increments land; each section says which increment owns it.

---

## The border polygon (AN6a increment 1)

**Source.** OpenStreetMap — the Switzerland national boundary, relation **51701**
(`admin_level=2`), fetched as GeoJSON from
`https://polygons.openstreetmap.fr/get_geojson.py?id=51701&params=0`.

**Fetch date.** 2026-09-28.

**Source integrity.** 1 197 323 bytes,
`sha256 cb41591cc39040f460c687afd4c3e3a72662867110f54c6915cc9852b03e78c0`. The raw source
is not committed (a 1.2 MB national boundary); it is re-fetchable from the URL above and
its checksum is recorded here so a regeneration is verifiable.

**Licence, read from the source (R146).** OpenStreetMap data is licensed under the **Open
Data Commons Open Database License (ODbL) 1.0** — read from
`https://www.openstreetmap.org/copyright` on the fetch date, which names the ODbL and links
its full legal code at opendatacommons.org. Two obligations follow and both are real:

- **Attribution.** The product must credit **"© OpenStreetMap contributors"** (ODbL 1.0)
  wherever the border data is used. The app has no such screen yet — this is a **NEEDS**
  for the detection UI (AN9+): an about/credits line naming OpenStreetMap and the ODbL.
- **Share-alike.** The bundled and reference polygons are a *derived database*. If the
  product ever publicly conveys them as data (beyond shipping them inside the app), the
  derived database is itself ODbL 1.0.

**Compliance (R280, AN5b increment 0).** Distributing the APK distributes the GeoJSON inside
it; whether that is "Public Use" of a Derivative Database is arguable, and complying costs
almost nothing, so the product complies rather than arguing the edge. A licence-and-attribution
notice ships **beside the data**, in the same assets folder that is packaged into every build:
`android/app/src/main/assets/border/switzerland.json.LICENSE.txt`. It states the ODbL 1.0 licence,
the "© OpenStreetMap contributors" attribution, the OSM relation it derives from, and the
share-alike obligation — so the licence travels with the file it governs. The simplified polygon
is thereby **available under ODbL 1.0 with attribution** at that path (tracked in git and shipped
in the APK). The in-app attribution **screen** remains the NEEDS above.

**Processing.** `android/scripts/prepare-border-polygon.mjs` — a one-time, off-device data
tool, not shipped, no dependency (hand-rolled Douglas-Peucker + a bbox clip; distances in
metres via an equirectangular projection). The runtime geometry (`detection/BorderPolygon.kt`)
is pure Kotlin with no geo dependency (R136).

**Bundled polygon (ships in the APK).**
`app/src/main/assets/border/switzerland.json` — GeoJSON MultiPolygon, **6 878 points**
(from 52 159), **157 852 bytes** (~154 KB),
`sha256 11d1534ffa4a15336685995519650efa576c9d566236b2ebd7559e05fae7b400`.

**Simplification tolerance.** Douglas-Peucker at **25 m** — chosen WELL BELOW the 150 m
buffer, so simplification can never move the border enough to misclassify a point the
buffer exists to protect. `BorderPolygonTest.simplificationErrorStaysFarBelowTheBuffer`
measures the bundled polygon against the **unsimplified** Geneva reference at 50/100/200/500 m
offsets either side of the real border and asserts the error stays far below the buffer. A
polygon simplified at 200 m would fail that test — which is the point of stating the
tolerance.

**Reference (test only).** `app/src/test/resources/border/geneva-reference.json` — the
full-resolution boundary clipped to the Geneva window (lng 5.85–6.35, lat 46.05–46.45),
6 171 points, the truth the tolerance test measures against.

**Buffer distance.** **150 m** (D25) — `BorderPolygon.BUFFER_METERS`. A fix within 150 m of
the border classifies as BUFFER, contributes to neither tally, and lowers the tier.

**Enclave limitation, recorded honestly.** This `polygons.openstreetmap.fr` extract returns
the outer boundary with **no interior rings**, so the German enclave of Büsingen and the
Italian enclave of Campione are not cut out — a point inside either would classify as INSIDE
Switzerland. Both sit on the German and Italian borders, far from the Franco-Swiss border
near Geneva this product serves, so it is immaterial today; the ray-cast is nonetheless
**hole-aware** (it processes interior rings), so a hole-carrying source drops in without a
code change. Recorded as a **NEEDS** only if enclave accuracy ever matters.

---

## The four checks and the daily record (R320)

**R320 replaced continuous sampling with FOUR CHECKS A DAY.** Continuous sampling was never fully
realistic — Android 8+ delivers background location only a few times an hour — and four checks cost a
fraction of the battery and make the disclosure plainer: the person is told exactly when their
position is checked. AN6a's polygon and 150 m border-strip classifier are **unchanged**; only how a
day is decided changed. The minutes-and-hysteresis tally, its `detection/Tally.kt`, `detection/LiveTally.kt`,
the hysteresis constants and `WORKING_WINDOW_*` are removed.

**The four windows (`detection/CheckWindows.kt`), Europe/Paris, chosen to avoid lunch:**

| Check | Centre | Window |
|---|---|---|
| 1 | 09:30 | 09:00–10:00 |
| 2 | 11:00 | 10:30–11:30 |
| 3 | 14:30 | 14:00–15:00 |
| 4 | 16:30 | 16:00–17:00 |

Each check runs **anywhere inside its window**; a check that cannot run inside its window is **MISSED,
never taken late** — an 11:00 check delayed to 13:00 would sample lunch, which the windows exist to
avoid. The window radius is `CHECK_WINDOW_RADIUS_MINUTES` = **30** minutes (a 60-minute window):
WorkManager delivers background work no more often than every 15 minutes and cannot promise an exact
time (the exact-alarm permission is restricted and is **not** requested, R320), so a window must hold
several wake opportunities; 60 minutes holds about four and keeps the windows disjoint and clear of
lunch (window 2 ends 11:30, window 3 opens 14:00). Pinned to Paris regardless of the device timezone
(R28, `CheckWindowsTest`).

**The record table (`daily_tally`), Room version 4.** Per day: `check1`…`check4`, each a Classification
name (`INSIDE`/`OUTSIDE`/`BUFFER`) or **NULL** (MISSED). **No minutes, no tier column, no coordinate** —
the tier is derived by the vote, so nothing stored can drift. The DDL scan iterates every table
(`RoomSchemaContractTest.noColumnIsCoordinateShapedInAnyTable`). `MIGRATION_3_4` reshapes the table: it
**drops the continuous-era rows explicitly** (a minutes tally cannot convert into four check slots, and
only AN-AUTO's own test rows can exist — detection has never shipped) and leaves the entry table — the
person's recorded days — untouched. `MonReleveMigrationTest` runs a genuine v3 database through it on the
device and validates against `schemas/4.json` (R305/R187).

## The vote (R320)

**A day is decided by a VOTE over its four checks (`detection/Vote.kt`).** The thresholds are **PROPOSED**
(R276/R320): they are ratified by the operator and **freeze when the field test starts** — a threshold
chosen after seeing data is tuned to pass. `VoteThresholdParityTest` reads them back out of this document
and fails if the encoded constants drift (R181).

- **HIGH**: `VOTE_MIN_CHECKS` = **3** checks taken, ALL on the same side, none in the strip.
- **MEDIUM**: `VOTE_MIN_CHECKS` = **3** taken, `MEDIUM_MAX_DISSENT` = **1** on the other side or in the strip.
- **LOW**: anything else — and **LOW withholds** (no proposal; the day stays *Non renseigné*).

**One bad GPS reading can never decide a day on its own**: a lone dissenter drops HIGH to MEDIUM, two
drop it to LOW. The winning side becomes the kind — INSIDE → *En Suisse* (CH), OUTSIDE → *Domicile*
(HOME). A HIGH/MEDIUM voted day is a **full day** on that side. **Missions and absences are never
detected** (a proposal is only ever CH or HOME).

**Half-day granularity (R320).** Each half is decided from ITS OWN two checks (AM = checks 1–2, PM =
checks 3–4): both taken, both the same side, neither in the strip, or the half is **not sure**. `VoteTest`
covers every case, including a missed check and a split day whose halves are each decided.

**The tier is words plus segments, never a percentage (R27):** `Tier` is HIGH/MEDIUM/LOW and the display
renders those words, never a confidence figure.

**Nothing here writes an entry (D16).** A `Proposal` is a value; only the confirming tap records it.
`FencesTest.detectionNeverWritesAnEntry` (fence 7) asserts detection/ never references the entry-write
path (EntryRepository/RecordCommand).

## Only HIGH proposes in the product (AN-AUTO increment 1, R311)

**R311 reverses SPEC 13.1/11.2's "MEDIUM proposes, LOW withholds".** In the PRODUCT a proposal
is surfaced to the person **only when the tier is HIGH**; **MEDIUM and LOW both withhold** and
show the not-sure message (R312, `fr/DetectionCopy.NOT_SURE`). Fewer proposals, fewer wrong ones:
the field protocol names the one error no message can cover - a confident, *wrong* HIGH day
(FALSE-CH, K1/R278) - so until the field test measures how often that happens, the product
narrows what it proposes at all.

- **The measurement build tests what ships (R320).** `exportFieldRun` scores each day by the SAME
  vote (`voteTier` / `votedKind`) the product uses, so a field run validates the detector people
  actually get. HIGH and MEDIUM are still scored separately in the export; only the PRODUCT narrows
  what it surfaces.
- **The product decision has one home (R206):** `detection/DetectionOutcome.detectionOutcome`
  maps a `Proposal?` to `Proposed(proposal)` (HIGH only) or `NotSure` (MEDIUM, LOW, or a withheld
  day). The Aujourd'hui auto surface and the track replay both read it, so they cannot disagree.
  `DetectionOutcomeTest` asserts each tier end to end, including that a MEDIUM day is still scored
  by the vote **and** withheld by the product.

## Near-border recognition (R313, as R320 translates it) — PROPOSED

**The app recognises someone who lives near the border from the four checks alone — no coordinate.** A
working day is **near-border** when `NEAR_BORDER_STRIP_CHECKS` = **2** or more of its four checks land in
the 150 m strip — 50 %, above the protocol's 40 % MEDIUM ceiling, and a day a single bad reading cannot
trigger. It is told on `NEAR_BORDER_DAYS_THRESHOLD` = **3** of the last five working days with data, over a
window of `NEAR_BORDER_WINDOW_DAYS` = **5** working days. The person is told **once** that detection is
unreliable where they live and offered manual, respected either way (D19 — manual is a peer, automatic is
never forced off).

- Constants, in `detection/NearBorder.kt`: `NEAR_BORDER_STRIP_CHECKS`, `NEAR_BORDER_DAYS_THRESHOLD`,
  `NEAR_BORDER_WINDOW_DAYS`.
- **PROPOSED (R276).** Frozen when the field test starts — a threshold chosen after seeing data is tuned
  to pass.
- `NearBorderTest` proves the per-day rule, the 3-of-5 trigger, and that no-data days are excluded from
  the window. "Told once" and the choice are the UI's.

## Sampling and background mechanics (R320)

**The entry point is `DetectionSession.onFix(latitude, longitude, epochMillis)`** — classify each fix,
assign it to the check window its instant falls in (the first fix in a window wins; a fix outside every
window is ignored, never a late check), and at day's end take the vote over the four checks. The
synthetic tracks (`detection/SyntheticTracks.kt`, each a scenario with its expected result written
first, R197) are replayed through it: on the phone by `dev/DetectionMockReplayActivity` through the real
OS test-location provider, and in the JVM regression by `DetectionSessionTest`.

**The background client (`detection/SamplingWorker.kt`).** A single unique periodic WorkManager worker at
the 15-minute floor (`SAMPLING_INTERVAL_MINUTES`); each wake does something ONLY when it lands inside a
check window whose slot is still empty — it requests one GPS fix, classifies it, discards the coordinate
(`awaitClassifiedFix`, D18), and writes the side into that window's slot (`recordCheck`). A wake outside
every window does nothing. No geofencing, no Play Services, no exact-alarm permission (R320/R136). The
battery and the real-world missed-check rate of this choice are A5's measurement.

## Battery measurement method (AN6a increment 6)

The 3 %-per-working-day budget (SPEC 13.1, K5) is a NUMBER THAT MUST BE MEASURED, and the
method matters as much as the figure (R233). From the android-profiler skill (docs/android-skills.md
§7.1):

- **Preferred: Perfetto system trace.** Record a working-day background trace (the
  `long_background.pftxt` config shape); read energy from the **`power_rails`** track (energy per
  rail = `power_ma * duration`, summed, in mWh). Confirm the device SUSPENDS between detection
  wakes via the **`suspend_state`** track, and root-cause any failure to suspend via
  **`kernel_wakelock`** - the detection budget is dominated by whether the device stays asleep
  between fixes.
- **Hard constraint:** `power_rails` needs on-device power measurement (ODPM) - a Pixel 6+
  (Tensor) or similar. **The 3 % figure cannot be measured on an emulator** (no power rails), so
  AN6a does not produce it; AN6b measures it on the tester's physical phone, the same way every
  day, and reports it to `score-field-run.mjs --battery-median`.
- **Fallback where ODPM is absent:** `dumpsys batterystats` (coarser), reset at the window start
  and read at the end.

## The scoring harness (AN6a increment 6, AC3)

`android/scripts/score-field-run.mjs` scores a run: `--export <app export.json> --log <tester
log.csv>`. It reads the app's export (`detection/exportFieldRun` - per day the vote tier, the voted
kind, each of the four checks, and the taken/missed/strip counts; **no coordinate**, R277) and the
tester's daily log (date,
`Suisse`/`Domicile`/`Mission`/`Absent`, note - the fiche testeur format), and prints per kill
criterion the count, the rate, and its **95 % confidence bound**. At zero errors the bound is the
**exact one-sided binomial**, `1 - 0.05^(1/n)` (R279): the rule of three (`3/n`) is a large-n
approximation of it that gives 150 % at n = 2 where the exact bound is 78 %, so the code uses the
exact form and the field protocol keeps the rule of three only as the human-facing explanation.
For k > 0 errors the bound is the Wilson score upper bound; the two meet with no discontinuity.
`upper-bound.test.mjs` pins the formula at n = 1, 2, 3, 10, 17, 20 against independently-computed
values. FALSE-CH is on its own line (K1, R278). The thresholds are encoded from the field protocol
§3 (R276), not chosen. A worked example on fabricated data lives in `android/scripts/fixtures/`.

The measurement build **runs without a server** (detection is on-device, D18) and is **blind**
(it does not show the tester its proposals during the run - the export carries them at the end),
so the daily log stays independent ground truth.

## Geofence contingency (D31)

_Built only if Checkpoint G's border-only branch triggers it (AN7b). Not active._
