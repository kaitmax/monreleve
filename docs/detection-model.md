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
  for the detection UI (AN8): an about/credits line naming OpenStreetMap and the ODbL.
- **Share-alike.** The bundled and reference polygons are a *derived database*. If the
  product ever publicly conveys them as data (beyond shipping them inside the app), the
  derived database is itself ODbL 1.0.

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

## Tier thresholds (AN6a increment 4)

_Encoded from `docs/field-protocol-AN6b.md` §3, not chosen here (R276). Filled in at increment 4._

## Sampling and background mechanics (AN6a increment 5)

_Filled in at increment 5._

## Battery measurement method (AN6a increment 6)

_The 3 %-per-working-day budget cannot be measured on an emulator (no power rails). The
method for AN6b's physical device is recorded at increment 6._

## Geofence contingency (D31)

_Built only if Checkpoint G's border-only branch triggers it (AN7b). Not active._
