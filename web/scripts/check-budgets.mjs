// web/scripts/check-budgets.mjs
//
// First-load JS budget, measured from the Next build manifests. "A budget not
// enforced in CI is a budget that silently disappears." (SPEC section 17.)
//
// Two gates, per operator ruling R2 of 07.09.2026, which replaces the web row
// of SPEC section 17. The single 100 KB total was set against an older
// framework baseline and is not achievable on Next 15 + React 19, where a bare
// page already measures 100.6 KiB. Splitting the gate separates the floor we
// cannot control from the weight we add:
//
//   GATE A  total first-load JS per public route  <= 125 KiB gzip
//   GATE B  feature delta over the framework floor <= 25 KiB gzip
//
// Four measurement decisions, made explicit because each one moves the number
// across the gate on a page containing one h1:
//
//  1. A route's first load is its own entry UNIONED with every ancestor
//     layout entry. app-build-manifest.json keeps "/page" and "/layout" as
//     separate keys and the page entry does not list the layout chunk, so
//     reading "/page" alone under-reports every route.
//  2. Each file is gzipped on its own and the sizes are summed. Gzipping the
//     concatenated buffer reports roughly 1 KB less than the browser
//     actually receives, because the browser gets each file compressed
//     separately.
//  3. Polyfills are measured but NOT counted against the budget. Next serves
//     polyfills-*.js with `nomodule`, so no browser that supports ES modules
//     ever downloads it, and Next's own "First Load JS" column excludes it.
//     The figure is printed so the choice is visible rather than implied.
//  4. Only .js is counted. The manifests also list the route's stylesheet, and
//     the budget in SPEC section 17 is first-load JS. Next filters the same
//     way. CSS is measured and printed on its own row instead.

import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_DIR = join(WEB_ROOT, '.next');
const FONT_DIR = join(WEB_ROOT, 'public', 'fonts');

const KIB = 1024;

// THE FRAMEWORK FLOOR.
//
// Measured first-load JS of a bare route - one h1 and one figure, no feature
// code - on:
//     next 15.5.25, react 19.2.8, react-dom 19.2.8
//     measured 07.09.2026 in FW1 (see REPORT-FW1.txt, BUDGET NUMBERS)
//     103028 bytes gzip level 9 = 100.6 KiB
//     of which framework chunk 54.2 kB and app-router runtime 46.5 kB
//
// Neither chunk is reducible by configuration. This constant is the datum for
// GATE B, so it must not drift silently: re-measure it ONLY on a framework
// upgrade, in its own commit titled "chore: re-baseline framework floor"
// (ruling R2).
const FRAMEWORK_BASELINE_KIB = 100.6;

// Public routes are the acquisition surface: calculator, comparator, guides,
// home, legal. /dev/** is noindex, out of the sitemap and not part of that
// surface, so it is measured and printed but not gated - FW2 deliberately
// builds a component-heavy page there.
const GATE_A_TOTAL_BYTES = 125 * KIB;
const GATE_B_DELTA_BYTES = 25 * KIB;
const BASELINE_BYTES = Math.round(FRAMEWORK_BASELINE_KIB * KIB);

// Segment-aware, so a real public route whose first segment merely starts with
// "dev" - /devis, /developpement - is not silently excused from the gate.
const isGated = (route) => route !== '/dev' && !route.startsWith('/dev/');

// Next emits route-group segments in the manifest keys and strips them only in
// memory. app/(public)/page.tsx arrives at FW10 and must print as "/".
const normaliseRoute = (route) =>
  route
    .split('/')
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
    .join('/') || '/';

const kib = (bytes) => (bytes / KIB).toFixed(1);

/** Every ancestor layout entry for a page entry, plus the page entry itself. */
function entriesForRoute(pageEntry, allEntries) {
  const segments = pageEntry.slice(0, -'/page'.length).split('/').filter(Boolean);
  const layouts = [];
  for (let depth = 0; depth <= segments.length; depth += 1) {
    const candidate = `/${segments.slice(0, depth).join('/')}`.replace('//', '/');
    const layout = candidate === '/' ? '/layout' : `${candidate}/layout`;
    if (allEntries.includes(layout)) layouts.push(layout);
  }
  // THE ROOT 404 IS TWO MANIFEST ENTRIES, and measuring only one of them
  // under-reported it by the whole shell. Next emits "/_not-found/page" for
  // the internal catch-all route AND "/not-found" for the component in
  // app/not-found.tsx; the component's chunks are on the second, and only the
  // first ends in "/page", so the loop below never saw them. Before this, the
  // 404 reported 100.8 KiB with a 0.2 KiB feature delta while actually
  // shipping PublicShell - a route passing its gate on a number that was not
  // its payload, which is worse than a breach because nothing looks wrong.
  //
  // Found by comparing chunk counts: /_not-found/page had 5, /not-found 7.
  if (pageEntry === '/_not-found/page' && allEntries.includes('/not-found')) {
    return [...layouts, pageEntry, '/not-found'];
  }

  return [...layouts, pageEntry];
}

async function measure(files) {
  let raw = 0;
  let gzip = 0;
  for (const file of files) {
    const buffer = await readFile(join(NEXT_DIR, file));
    raw += buffer.length;
    gzip += gzipSync(buffer, { level: 9 }).length;
  }
  return { raw, gzip };
}

// The latin subset is the only face a French page fetches; latin-ext is gated
// behind its unicode-range. Both are reported, neither is gated.
const PRELOADED_SUBSET = 'inter-latin-wght-normal.woff2';

async function fontPayload() {
  try {
    const files = await readdir(FONT_DIR);
    let bytes = 0;
    let preloadedBytes = 0;
    for (const file of files) {
      const size = (await stat(join(FONT_DIR, file))).size;
      bytes += size;
      if (file === PRELOADED_SUBSET) preloadedBytes = size;
    }
    return { count: files.length, bytes, preloadedBytes };
  } catch {
    return { count: 0, bytes: 0, preloadedBytes: 0 };
  }
}

const appManifest = JSON.parse(
  await readFile(join(NEXT_DIR, 'app-build-manifest.json'), 'utf8'),
);
const buildManifest = JSON.parse(
  await readFile(join(NEXT_DIR, 'build-manifest.json'), 'utf8'),
);

const allEntries = Object.keys(appManifest.pages);
const rootMainFiles = buildManifest.rootMainFiles ?? [];
const polyfills = await measure(buildManifest.polyfillFiles ?? []);

/**
 * One route's measurement, and the SHAPE IS DECLARED because ruling R107 put
 * this file under checkJs. The gate arithmetic below adds delta, failsA and
 * failsB after the fact; without this typedef TypeScript infers the object
 * from its literal and reports 21 errors for adding a property to it.
 *
 * Declaring it is better than silencing it: the three computed fields are the
 * ones the verdict column depends on, and nothing until now said so.
 *
 * @typedef {object} BudgetRow
 * @property {string} route
 * @property {number} files
 * @property {number} raw
 * @property {number} gzip
 * @property {number} css
 * @property {boolean} gated
 * @property {number} [delta]   over the framework baseline; set below
 * @property {boolean} [failsA] gated and over GATE A; set below
 * @property {boolean} [failsB] gated and over GATE B; set below
 */

/** @type {BudgetRow[]} */
const rows = [];
for (const entry of allEntries) {
  if (!entry.endsWith('/page')) continue;

  const route = normaliseRoute(entry.slice(0, -'/page'.length) || '/');
  const all = [
    ...new Set([
      ...rootMainFiles,
      ...entriesForRoute(entry, allEntries).flatMap((e) => appManifest.pages[e] ?? []),
    ]),
  ];
  const scripts = all.filter((file) => file.endsWith('.js'));
  const styles = all.filter((file) => file.endsWith('.css'));

  const { raw, gzip } = await measure(scripts);
  const css = await measure(styles);
  rows.push({ route, files: scripts.length, raw, gzip, css: css.gzip, gated: isGated(route) });
}

rows.sort((a, b) => a.route.localeCompare(b.route));

// A gate that passes when it measured nothing is the failure mode SPEC
// section 17 warns about. The realistic trigger is a Next upgrade changing the
// manifest key shape the "/page" filter depends on.
if (rows.length === 0) {
  console.error(
    'No route entries found in .next/app-build-manifest.json - the budget gate measured nothing.',
  );
  process.exit(1);
}

const fonts = await fontPayload();

// The only face a French page actually fetches. The latin-ext subset is gated
// behind its unicode-range and is not requested on our pages.
const preloadedFontBytes = fonts.preloadedBytes;

for (const row of rows) {
  row.delta = row.gzip - BASELINE_BYTES;
  row.failsA = row.gated && row.gzip > GATE_A_TOTAL_BYTES;
  row.failsB = row.gated && row.delta > GATE_B_DELTA_BYTES;
}

const breaches = rows.filter((row) => row.failsA || row.failsB);

console.log('');
console.log('First-load JS per route (gzip level 9). Ruling R2 gates:');
console.log(`  GATE A  total <= ${kib(GATE_A_TOTAL_BYTES)} KiB`);
console.log(
  `  GATE B  delta <= ${kib(GATE_B_DELTA_BYTES)} KiB over the ${FRAMEWORK_BASELINE_KIB} KiB framework floor`,
);
// THE ROUTE COLUMN IS MEASURED, NOT GUESSED. It was a hard-coded 22, and
// FW11's /calculateur-teletravail-frontalier is 35 characters: the name ran
// straight into the bucket column and printed
// "/calculateur-teletravail-frontalierpublic". This table IS the size record
// that goes into a session report, so a row nobody can read is a bad record,
// and the next long route would have done it again.
const ROUTE_COL = Math.max(22, ...rows.map((row) => row.route.length)) + 2;
const TABLE_WIDTH = ROUTE_COL + 8 + 9 + 8 + 7 + 7 + 2 + 40;

console.log('');
console.log(
  'route'.padEnd(ROUTE_COL) +
    'bucket'.padEnd(8) +
    'js total'.padStart(9) +
    'delta'.padStart(8) +
    'css'.padStart(7) +
    'fonts'.padStart(7) +
    '  verdict',
);
console.log('-'.repeat(TABLE_WIDTH));

for (const row of rows) {
  // An ungated route still gets its gate arithmetic printed. /dev/spike is
  // the whole point of FW2: the gates do not block on it, but the spike has
  // to be able to answer "would a representative public page fit?".
  const wouldPass =
    row.gzip <= GATE_A_TOTAL_BYTES && row.delta <= GATE_B_DELTA_BYTES
      ? `would pass (A ${kib(GATE_A_TOTAL_BYTES - row.gzip)} spare, B ${kib(GATE_B_DELTA_BYTES - row.delta)} spare)`
      : `WOULD FAIL ${row.gzip > GATE_A_TOTAL_BYTES ? 'A' : ''}${row.gzip > GATE_A_TOTAL_BYTES && row.delta > GATE_B_DELTA_BYTES ? '+' : ''}${row.delta > GATE_B_DELTA_BYTES ? 'B' : ''}`;

  const verdict = !row.gated
    ? `not gated - ${wouldPass}`
    : row.failsA && row.failsB
      ? `FAIL A by ${kib(row.gzip - GATE_A_TOTAL_BYTES)} and B by ${kib(row.delta - GATE_B_DELTA_BYTES)}`
      : row.failsA
        ? `FAIL GATE A by ${kib(row.gzip - GATE_A_TOTAL_BYTES)} KiB`
        : row.failsB
          ? `FAIL GATE B by ${kib(row.delta - GATE_B_DELTA_BYTES)} KiB`
          : `pass (A ${kib(GATE_A_TOTAL_BYTES - row.gzip)} spare, B ${kib(GATE_B_DELTA_BYTES - row.delta)} spare)`;

  console.log(
    row.route.padEnd(ROUTE_COL) +
      (row.gated ? 'public' : 'dev').padEnd(8) +
      kib(row.gzip).padStart(9) +
      kib(row.delta).padStart(8) +
      kib(row.css).padStart(7) +
      kib(preloadedFontBytes).padStart(7) +
      '  ' +
      verdict,
  );
}

console.log('-'.repeat(TABLE_WIDTH));
// Ruling R2: fonts and CSS get their own lines and are NEVER counted against
// a JS gate. They are in the table for visibility only.
console.log('css   reported, never gated: it is not JS.');
console.log(
  `fonts reported, never gated: ${kib(preloadedFontBytes)} KiB preloaded (latin subset), ` +
    `${kib(fonts.bytes)} KiB across ${fonts.count} file(s) on disk. woff2 is already compressed.`,
);
console.log(
  `polyfills excluded: ${kib(polyfills.gzip)} KiB gzip / ${kib(polyfills.raw)} KiB raw, served nomodule.`,
);
console.log(
  `framework floor: ${FRAMEWORK_BASELINE_KIB} KiB, measured on next 15.5.25 / react 19.2.8, 07.09.2026.`,
);
console.log('');

if (breaches.length > 0) {
  for (const row of breaches) {
    if (row.failsA) {
      console.error(
        `GATE A BREACH  ${row.route}: ${kib(row.gzip)} KiB total exceeds ${kib(GATE_A_TOTAL_BYTES)} KiB (ruling R2).`,
      );
    }
    if (row.failsB) {
      console.error(
        `GATE B BREACH  ${row.route}: ${kib(row.delta)} KiB of feature code exceeds ${kib(GATE_B_DELTA_BYTES)} KiB over the framework floor (ruling R2).`,
      );
    }
  }
  process.exit(1);
}

console.log('All gated routes pass both gates.');
