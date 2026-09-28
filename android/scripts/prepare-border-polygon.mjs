// android/scripts/prepare-border-polygon.mjs
//
// AN6a increment 1. A ONE-TIME data-prep tool, NOT shipped in the APK. It reads the
// OpenStreetMap Switzerland boundary (fetched separately - see docs/detection-model.md
// for the source URL, date and checksum) and emits two committed artifacts:
//
//   app/src/main/assets/border/switzerland.json   - the BUNDLED polygon, Douglas-Peucker
//     simplified at a tolerance WELL BELOW the 150 m buffer, so the runtime classifier
//     stays small. This is what ships.
//   app/src/test/resources/border/geneva-reference.json - the UNSIMPLIFIED boundary
//     clipped to the Geneva region, the reference BorderPolygonTest measures the
//     simplification error against (the relay's 50/100/200/500 m test).
//
// The runtime geometry is pure Kotlin (BorderPolygon.kt); this preprocessing is the only
// place a geo algorithm runs off-device, and it has no dependency either - Douglas-Peucker
// and a bbox clip are hand-rolled. Distances are in metres via an equirectangular
// projection (longitude scaled by cos(lat)); at 150 m that approximation is exact enough.
//
// Usage: node android/scripts/prepare-border-polygon.mjs <source.geojson>

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const SIMPLIFY_TOLERANCE_M = 25; // well below the 150 m buffer (D25); stated in docs/detection-model.md
const GENEVA_BBOX = { minLng: 5.85, minLat: 46.05, maxLng: 6.35, maxLat: 46.45 };
const LAT0 = 46.8; // mid-Switzerland reference latitude for the metre projection

const source = process.argv[2];
if (!source) {
  console.error('usage: node prepare-border-polygon.mjs <source.geojson>');
  process.exit(1);
}

const raw = readFileSync(source, 'utf8');
const geo = JSON.parse(raw);
if (geo.type !== 'MultiPolygon') {
  console.error(`expected a MultiPolygon, got ${geo.type}`);
  process.exit(1);
}

console.log(`source: ${source}`);
console.log(`source sha256: ${createHash('sha256').update(raw).digest('hex')}`);
console.log(`source bytes: ${raw.length}`);

const cosLat0 = Math.cos((LAT0 * Math.PI) / 180);
const toMetres = ([lng, lat]) => [lng * 111320 * cosLat0, lat * 110540];

// Perpendicular distance from p to the segment a-b, in metres.
function perpDistanceM(p, a, b) {
  const [px, py] = toMetres(p);
  const [ax, ay] = toMetres(a);
  const [bx, by] = toMetres(b);
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Douglas-Peucker on a ring (keeps the closing point).
function simplifyRing(ring, toleranceM) {
  if (ring.length <= 3) return ring;
  const keep = new Array(ring.length).fill(false);
  keep[0] = true;
  keep[ring.length - 1] = true;
  const stack = [[0, ring.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i += 1) {
      const d = perpDistanceM(ring[i], ring[first], ring[last]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > toleranceM && index !== -1) {
      keep[index] = true;
      stack.push([first, index], [index, last]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

const countPts = (polys) => polys.reduce((n, poly) => n + poly.reduce((m, r) => m + r.length, 0), 0);

// ---- BUNDLED: simplify every ring of every polygon ----
const simplified = geo.coordinates.map((poly) => poly.map((ring) => simplifyRing(ring, SIMPLIFY_TOLERANCE_M)));
const bundled = { type: 'MultiPolygon', coordinates: simplified };
const bundledJson = JSON.stringify(bundled);

mkdirSync('app/src/main/assets/border', { recursive: true });
writeFileSync('app/src/main/assets/border/switzerland.json', bundledJson);

// ---- REFERENCE: the unsimplified boundary CLIPPED to the Geneva bbox ----
// Extract the contiguous run(s) of full-resolution vertices inside the Geneva window
// (plus the one vertex either side, so each segment spans the window edge), so the test
// compares the bundled polygon against the FULL-resolution truth along the Geneva border -
// not the whole national ring.
const inBox = ([lng, lat]) =>
  lng >= GENEVA_BBOX.minLng && lng <= GENEVA_BBOX.maxLng && lat >= GENEVA_BBOX.minLat && lat <= GENEVA_BBOX.maxLat;
function clipRingToBox(ring) {
  const segs = [];
  let cur = null;
  for (let i = 0; i < ring.length; i += 1) {
    if (inBox(ring[i])) {
      if (cur === null) {
        cur = [];
        if (i > 0) cur.push(ring[i - 1]); // the entry vertex, just outside
      }
      cur.push(ring[i]);
    } else if (cur !== null) {
      cur.push(ring[i]); // the exit vertex, just outside
      segs.push(cur);
      cur = null;
    }
  }
  if (cur !== null) segs.push(cur);
  return segs;
}
const genevaRings = [];
for (const poly of geo.coordinates) {
  for (const ring of poly) {
    for (const seg of clipRingToBox(ring)) genevaRings.push(seg);
  }
}
const reference = { type: 'MultiLineString', coordinates: genevaRings, bbox: GENEVA_BBOX };
const referenceJson = JSON.stringify(reference);

mkdirSync('app/src/test/resources/border', { recursive: true });
writeFileSync('app/src/test/resources/border/geneva-reference.json', referenceJson);

console.log('');
console.log(`simplification tolerance: ${SIMPLIFY_TOLERANCE_M} m`);
console.log(`bundled points:   ${countPts(simplified)} (from ${countPts(geo.coordinates)})`);
console.log(`bundled bytes:    ${bundledJson.length}`);
console.log(`bundled sha256:   ${createHash('sha256').update(bundledJson).digest('hex')}`);
console.log(`reference rings:  ${genevaRings.length}, points: ${genevaRings.reduce((n, r) => n + r.length, 0)}`);
console.log(`reference bytes:  ${referenceJson.length}`);
