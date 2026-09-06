// web/scripts/copy-fonts.mjs
//
// Copies the two Inter subsets we serve out of @fontsource-variable/inter and
// into public/fonts, so they are delivered from our own origin under a stable
// path that the root layout can preload. Runs before dev and before build.
// The copies are build output, not source: they are git-ignored.

import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = join(WEB_ROOT, 'node_modules', '@fontsource-variable', 'inter', 'files');
const TARGET_DIR = join(WEB_ROOT, 'public', 'fonts');

const SUBSETS = ['inter-latin-wght-normal.woff2', 'inter-latin-ext-wght-normal.woff2'];

await mkdir(TARGET_DIR, { recursive: true });

let total = 0;
for (const file of SUBSETS) {
  const from = join(SOURCE_DIR, file);
  await copyFile(from, join(TARGET_DIR, file));
  total += (await stat(from)).size;
}

console.log(`fonts: ${SUBSETS.length} subsets copied to public/fonts (${total} bytes)`);
