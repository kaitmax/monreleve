// web/scripts/og-sync.mjs
//
// Copies the card the container rendered into the place Next ships it from.
//
//   tests/visual/baselines/og-card.png  ->  public/opengraph-image.png
//
// WHY TWO FILES RATHER THAN ONE. The baseline is written by
// e2e/og.visual.spec.ts, which only runs when somebody runs docker. If that
// were also the shipped asset, a regenerated card would ship the instant it
// was regenerated - including from a run nobody looked at. Keeping them
// separate makes the gap visible: tests/unit/meta/og-image.test.ts compares
// the two on every commit and fails until this script has been run, which is
// the fast suite reporting "the card was re-rendered and not shipped".
//
// A COPY RATHER THAN A SYMLINK OR AN IMPORT, because the shipped file has to
// be an ordinary PNG that Next serves as a static asset, and because a link
// would make the two files the same file, which is the arrangement this
// exists to avoid.
//
// R133: the script asserts a positive signal - a PNG signature and real
// dimensions, printed - rather than reporting success because copyFileSync
// did not throw. The DIMENSIONS ARE REPORTED, NOT CHECKED: the numbers belong
// to lib/ui/core/rail/geometry.ts and the tests assert against that source. A
// second copy of 1200 and 630 here would be one more place to disagree.

import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const FROM = join(WEB, 'tests', 'visual', 'baselines', 'og-card.png');

/**
 * public/, NOT app/ - AND THAT IS RULING R81, MEASURED.
 *
 * app/opengraph-image.png is Next's metadata file convention, and it injects
 * the tags by itself. With the card there, a build whose origin is unset put
 * this in the head of every public page:
 *
 *   <meta property="og:image" content="http://localhost:3000/opengraph-image.png?56ee358a35a09d24">
 *   <meta name="twitter:image" content="http://localhost:3000/opengraph-image.png?...">
 *
 * e2e/guard.runtime.spec.ts caught it: "no localhost URL reaches the rendered
 * head at all". That guard exists because a canonical pointing at localhost
 * is an INSTRUCTION to a crawler rather than an absence, and an og:image is
 * the same kind of claim - a card address nothing can fetch.
 *
 * The convention has no conditional form: it emits whenever metadataBase
 * resolves, and metadataBase resolves to the stand-in. So the card is served
 * from public/ at the same URL and DECLARED explicitly, which lets the
 * declaration sit behind canonicalsAvailable() exactly as the canonical does.
 */
const TO = join(WEB, 'public', 'opengraph-image.png');

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

if (!existsSync(FROM)) {
  console.error(`og:sync FAILED - ${FROM} does not exist.`);
  console.error('');
  console.error('The card is rendered by e2e/og.visual.spec.ts inside R37\'s');
  console.error('container. Run pnpm test:visual:update first.');
  process.exit(1);
}

const bytes = readFileSync(FROM);

if (bytes.length < 24 || SIGNATURE.some((byte, index) => bytes[index] !== byte)) {
  console.error(`og:sync FAILED - ${FROM} is not a PNG.`);
  process.exit(1);
}

copyFileSync(FROM, TO);

const width = bytes.readUInt32BE(16);
const height = bytes.readUInt32BE(20);

console.log(
  `og:sync - public/opengraph-image.png is now the container's card: ` +
    `${String(width)} x ${String(height)}, ${String(bytes.length)} bytes.`,
);
