// web/scripts/check-budgets.mjs
//
// First-load JS budget, measured from the Next build manifests (SPEC section
// 17). "A budget not enforced in CI is a budget that silently disappears."
//
// Three measurement decisions, made explicit because each one moves the number
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

import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NEXT_DIR = join(WEB_ROOT, '.next');
const FONT_DIR = join(WEB_ROOT, 'public', 'fonts');

const KIB = 1024;

// SPEC section 17. Public routes are the acquisition surface: calculator,
// comparator, guides, home, legal. /dev/** is noindex, is out of the sitemap
// and is not part of that surface, so it is measured and printed but not
// gated - FW2 deliberately builds a component-heavy page there.
const PUBLIC_BUDGET_BYTES = 100 * KIB;
const isGated = (route) => !route.startsWith('/dev');

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

async function fontPayload() {
  try {
    const files = await readdir(FONT_DIR);
    let bytes = 0;
    for (const file of files) bytes += (await stat(join(FONT_DIR, file))).size;
    return { count: files.length, bytes };
  } catch {
    return { count: 0, bytes: 0 };
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

const rows = [];
for (const entry of allEntries) {
  if (!entry.endsWith('/page')) continue;

  const route = entry.slice(0, -'/page'.length) || '/';
  const files = [
    ...new Set([
      ...rootMainFiles,
      ...entriesForRoute(entry, allEntries).flatMap((e) => appManifest.pages[e] ?? []),
    ]),
  ];

  const { raw, gzip } = await measure(files);
  rows.push({ route, files: files.length, raw, gzip, gated: isGated(route) });
}

rows.sort((a, b) => a.route.localeCompare(b.route));

const breaches = rows.filter((row) => row.gated && row.gzip > PUBLIC_BUDGET_BYTES);

console.log('');
console.log(`First-load JS per route  (budget: ${kib(PUBLIC_BUDGET_BYTES)} KiB gzip on public routes)`);
console.log('');
console.log(
  'route'.padEnd(22) +
    'bucket'.padEnd(9) +
    'files'.padStart(6) +
    'raw KiB'.padStart(10) +
    'gzip KiB'.padStart(10) +
    '  status',
);
console.log('-'.repeat(70));

for (const row of rows) {
  const status = !row.gated
    ? 'not gated'
    : row.gzip > PUBLIC_BUDGET_BYTES
      ? `OVER by ${kib(row.gzip - PUBLIC_BUDGET_BYTES)} KiB`
      : `ok (${kib(PUBLIC_BUDGET_BYTES - row.gzip)} KiB spare)`;

  console.log(
    row.route.padEnd(22) +
      (row.gated ? 'public' : 'dev').padEnd(9) +
      String(row.files).padStart(6) +
      kib(row.raw).padStart(10) +
      kib(row.gzip).padStart(10) +
      '  ' +
      status,
  );
}

const fonts = await fontPayload();
console.log('-'.repeat(70));
console.log(
  `polyfills (nomodule, excluded from the gate): ${kib(polyfills.gzip)} KiB gzip / ${kib(polyfills.raw)} KiB raw`,
);
console.log(`font payload: ${fonts.count} file(s), ${kib(fonts.bytes)} KiB on disk (woff2 is already compressed)`);
console.log('');

if (breaches.length > 0) {
  for (const row of breaches) {
    console.error(
      `BUDGET BREACH  ${row.route}: ${kib(row.gzip)} KiB gzip exceeds the ${kib(PUBLIC_BUDGET_BYTES)} KiB public budget (SPEC section 17).`,
    );
  }
  process.exit(1);
}

console.log('All gated routes are within budget.');
