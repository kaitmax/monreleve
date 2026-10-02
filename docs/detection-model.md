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

## Hysteresis and the daily tally (AN6a increment 3)

**Hysteresis (D26), named in `detection/Tally.kt`.** A change of side is provisional until it
has persisted **10 minutes** (`HYSTERESIS_PROVISIONAL_MINUTES`) and is significant after **30**
(`HYSTERESIS_SIGNIFICANT_MINUTES`). Excursions shorter than 10 minutes are folded back into the
preceding side — the GPS-flicker guard for someone living near Geneva. The tally's minute
attribution turns on the 10-minute fold; the 30-minute mark is the stronger-confidence signal
the tier reads (increment 4). `TallyComputerTest` proves the boundary (9 min folds, 10/11 min
stand), oscillation folding, and that buffer time is attributed to neither side.

**Minutes come from the fixes' own timestamps**, never the wall clock: the gap after each fix is
attributed to its side. This is what lets a compressed replay of a day (increment 5) produce the
tally a real day would.

**The working window.** 07:00–19:00 Europe/Paris (`WORKING_WINDOW_START_MINUTE` /
`WORKING_WINDOW_END_MINUTE`), pinned to Paris regardless of the device timezone (R28,
`WorkingWindowTest`). Stored on each tally as minutes-of-day so a past tally keeps the window it
was computed under.

**The tally table (`daily_tally`), Room version 2.** Per day: `minutesSwitzerland`,
`minutesElsewhere`, `fixCount`, `bufferFixCount`, the window, and `tier` (nullable, set at
increment 4). **No coordinate column** — the DDL scan now iterates every table
(`RoomSchemaContractTest.noColumnIsCoordinateShapedInAnyTable`), and the plant in
REPORT-AN6a.txt shows it fires. `MIGRATION_1_2` creates the table; `MonReleveMigrationTest`
runs and validates it against `schemas/2.json` on the emulator — the migration harness's first
real execution.

## Tier thresholds, and the proposal (AN6a increment 4)

**Tiers are ENCODED from `docs/field-protocol-AN6b.md` §3, not chosen (R276)**, in
`detection/Proposal.kt`. `TierThresholdParityTest` reads the six numbers back out of that
document and fails if the constants drift (R181):

- **HIGH**: samples ≥ 50 % of expected, buffer ≤ 20 %, winning side ≥ 85 %.
- **MEDIUM**: samples ≥ 25 % of expected, buffer ≤ 40 %, winning side ≥ 70 %.
- **LOW**: anything else — and **LOW withholds** (no proposal; the day stays *Non renseigné*).

"Expected samples" is the window length over the sampling cadence (`SAMPLE_INTERVAL_MINUTES` =
15, SPEC 13.1's WorkManager floor): a 12 h window expects 48.

**The proposal.** HIGH/MEDIUM propose the winning side — INSIDE → *En Suisse* (CH), OUTSIDE →
*Domicile* (HOME). SPEC 13.1 granularity: > 4 h is a full day, 2–4 h a half day (AM/PM from
when the winning side's fixes fall), under 2 h is withheld. **Missions and absences are never
detected** (`ProposalTest` asserts no tally yields MISSION_FR/MISSION_THIRD/ABSENT). A split
day (neither side ≥ 70 %) is LOW, so it is withheld rather than guessed.

**The tier is words plus segments, never a percentage (R27):** `Tier` is HIGH/MEDIUM/LOW and
the display (AN8) renders those words beside the minute segments, never a confidence figure.

**Nothing here writes an entry (D16).** A `Proposal` is a value; only the confirming tap
records it. `FencesTest.detectionNeverWritesAnEntry` (fence 7) asserts detection/ never
references the entry-write path (EntryRepository/RecordCommand); the plant in REPORT-AN6a.txt
shows it fires.

## Only HIGH proposes in the product (AN-AUTO increment 1, R311)

**R311 reverses SPEC 13.1/11.2's "MEDIUM proposes, LOW withholds".** In the PRODUCT a proposal
is surfaced to the person **only when the tier is HIGH**; **MEDIUM and LOW both withhold** and
show the not-sure message (R312, `fr/DetectionCopy.NOT_SURE`). Fewer proposals, fewer wrong ones:
the field protocol names the one error no message can cover - a confident, *wrong* HIGH day
(FALSE-CH, K1/R278) - so until the field test measures how often that happens, the product
narrows what it proposes at all.

- **The measurement build is unchanged.** `computeProposal` / `proposedKind` / `exportFieldRun`
  still score HIGH and MEDIUM separately against the §3 table, so a field run is scored against
  exactly what AN6a built. Only the PRODUCT changes.
- **The product decision has one home (R206):** `detection/DetectionOutcome.detectionOutcome`
  maps a `Proposal?` to `Proposed(proposal)` (HIGH only) or `NotSure` (MEDIUM, LOW, or a withheld
  day). The Aujourd'hui auto surface and the seven-track replay both read it, so they cannot
  disagree. `DetectionOutcomeTest` asserts each tier end to end, including that a MEDIUM day is
  still scored by the measurement path **and** withheld by the product.

## Near-border recognition (AN-AUTO increment 6, R313) — PROPOSED

**The app recognises someone who lives near the border from the tally alone — no coordinate.** The
daily tally already counts how many fixes fell in the 150 m buffer (`bufferFixCount`). A working day
is **near-border** when its buffer-fix share is **above `MEDIUM_BUFFER_SHARE` (0.40)** — the field
protocol's MEDIUM ceiling, above which a day cannot even reach MEDIUM. When that holds on **≥ 3 of the
last 5 working days with data**, the person is told **once** that detection is unreliable where they
live and offered manual, respected either way (D19 — manual is a peer, automatic is never forced off).

- Constants, in `detection/NearBorder.kt`: `NEAR_BORDER_DAYS_THRESHOLD = 3`, `NEAR_BORDER_WINDOW_DAYS
  = 5`, and the per-day test reuses `MEDIUM_BUFFER_SHARE` (already encoded from the field protocol §3).
- **PROPOSED (R276).** The threshold reuses the protocol constant and is **frozen when the field test
  starts** — a threshold chosen after seeing data is tuned to pass.
- `NearBorderTest` proves the per-day rule (strictly above 0.40), the 3-of-5 trigger, and that
  no-data days are excluded from the window. "Told once" and the choice are the UI's (increment 5).

## Sampling and background mechanics (AN6a increment 5)

**The entry point is `DetectionSession.onFix(latitude, longitude, epochMillis)`** — classify,
accumulate, and at day's end compute the tally and proposal. The seven synthetic tracks
(`detection/SyntheticTracks.kt`, each a scenario with its expected result written first, R197)
are replayed through it: on the emulator by `dev/DetectionReplayActivity` (loading the shipped
asset polygon, showing each track's expected vs observed proposal and OK), and in the JVM
regression by `DetectionSessionTest`. All seven pass; the tier shows in words, no percentage,
no map (R27).

**Assumed cadence: one fix per `SAMPLE_INTERVAL_MINUTES` (15).** SPEC 13.1's WorkManager floor.
The tally attributes minutes from the fixes' own timestamps, so a compressed replay produces
the tally a real day would.

**The background sampling CLIENT is deliberately NOT built here — it is SPEC 13.1's spike (AN7).**
AN6a proves the CLASSIFIER on synthetic tracks; which combination of WorkManager periodic work,
geofences, or a foreground service meets the accuracy and battery budgets is what AN6b measures
and AN7 wires. The `detection/LiveLocation.classifyCurrentLocation` bridge is built and
`adb emu geo fix` sets the emulator position (verified: `OK`), but
`LocationManager.getLastKnownLocation` returns null on the headless emulator without an active
location-updates client — which is exactly the client AN7 owns. So the OS-location READ layer is
noted, not demonstrated; the classifier pipeline it feeds is fully proven via the tracks.

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
log.csv>`. It reads the app's export (`detection/exportFieldRun` - per day tier, proposed kind,
minutes, fix and buffer counts; **no coordinate**, R277) and the tester's daily log (date,
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
