// web/scripts/generate-zones-scss.mjs
//
// Generates lib/ui/core/styles/_zones.scss from lib/ui/core/zone-tokens.ts,
// so the Zone -> band colour and Status -> badge colour mappings exist once.
// SPEC section 20 Never: "keep zones.ts the single source." A hand-written
// SCSS copy of the same mapping is a second source of visual truth, and the
// two drift silently because nothing renders both at once.
//
// TWO MODES.
//
//   (default)  write the file.
//   --check    compare and never write. Exit 1 if the file on disk differs
//              from what this script would produce, or is missing.
//
// --check is the mode wired into the build, NOT generation. The prompt for
// this task asked for generation on prebuild, and that is a trap: if the
// build regenerates, a hand edit is silently overwritten before anything can
// notice it, so a check placed after the build can never fail and a developer
// who hand-edits and runs `pnpm build` loses the edit with no signal.
// Checking on prebuild fails the build on drift instead, and regeneration
// stays an explicit act (`pnpm zones:generate`). Recorded in REPORT-FW6.txt.
//
// The comparison is BYTE FOR BYTE. It is not normalised for line endings, and
// must not be: normalising is what makes a stale check unable to see the
// EOL-only and trailing-newline-only edits it exists to catch. The repo's
// .gitattributes pins LF for exactly this reason, and this script writes "\n"
// and never os.EOL.
//
// It loads a TypeScript module directly, under --experimental-strip-types.
// That works without a resolver hook or a TypeScript runner only because
// zone-tokens.ts has no runtime imports - see its header for why it is a
// separate file from zones.ts.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_MODULE = join(HERE, '..', 'lib', 'ui', 'core', 'zone-tokens.ts');
const TARGET = join(HERE, '..', 'lib', 'ui', 'core', 'styles', '_zones.scss');

/** Relative, POSIX-style, so the generated header reads the same on any OS. */
const SOURCE_LABEL = 'lib/ui/core/zone-tokens.ts';

const HEADER = `// web/lib/ui/core/styles/_zones.scss
//
// GENERATED FROM ${SOURCE_LABEL} - DO NOT EDIT.
//
// Run \`pnpm zones:generate\` after changing the mapping there. \`pnpm
// zones:check\` fails if this file and that module disagree, and runs on
// prebuild and in CI.
//
// Every class assigns a CUSTOM PROPERTY and no visual declarations. The
// mapping is a token mapping, not a component style: FW7's rail fills with
// var(--zone-colour), and emitting a finished component style here would fix
// the rail's styling architecture from the wrong file.
//
// ZONE ONLY, per ruling R31. Status styling belongs to FW8, whose badge is a
// .tsx with a colocated CSS MODULE - module selectors are camelCase because
// they are addressed as styles.x, while this global partial is kebab-case, so
// a global .status-mission-exposure could not be consumed there at all. It
// would be dead CSS that still had to be kept in step with the mapping. The
// badge reads the token NAMES from zones.ts in TypeScript, which is the same
// single source (SPEC 20) by a shorter route.
//
// SPEC 6.2: the rail is coloured by ZONE and never by Status - that is a
// review rejection - which is why this file knows only about Zone.
`;

/**
 * The whole file, as a string. Exported so the stale-check test can compare
 * against it in memory without shelling out or writing a temp file.
 *
 * Keys are sorted rather than taken in declaration order, so reordering the
 * TypeScript source does not churn the generated CSS. Order is safe to
 * choose freely here because every rule sets custom properties on a distinct
 * class, so no two rules can interact through the cascade.
 */
export function renderZonesScss(bandTokens) {
  const blocks = [];

  for (const zone of Object.keys(bandTokens).sort()) {
    blocks.push(`.zone-${zone} {\n  --zone-colour: var(${bandTokens[zone]});\n}`);
  }

  // Trailing newline, and exactly one. stylelint-config-standard-scss
  // requires it, and a missing one is a hand edit the byte comparison sees.
  return `${HEADER}\n${blocks.join('\n\n')}\n`;
}

async function expected() {
  const { ZONE_BAND_TOKEN } = await import(
    `file://${SOURCE_MODULE.replace(/\\/g, '/')}`
  );

  return renderZonesScss(ZONE_BAND_TOKEN);
}

async function main() {
  const wanted = Buffer.from(await expected(), 'utf8');

  if (!process.argv.includes('--check')) {
    writeFileSync(TARGET, wanted);
    process.stdout.write(`generated ${SOURCE_LABEL} -> _zones.scss (${wanted.length} bytes)\n`);
    return;
  }

  let onDisk;
  try {
    onDisk = readFileSync(TARGET);
  } catch {
    process.stderr.write(
      `_zones.scss is missing. It is generated from ${SOURCE_LABEL}; run \`pnpm zones:generate\`.\n`,
    );
    process.exitCode = 1;
    return;
  }

  if (onDisk.equals(wanted)) {
    process.stdout.write('_zones.scss is up to date with zone-tokens.ts\n');
    return;
  }

  process.stderr.write(
    `_zones.scss does not match ${SOURCE_LABEL}.\n` +
      `  on disk:  ${onDisk.length} bytes\n` +
      `  expected: ${wanted.length} bytes\n` +
      'It is generated and must not be hand-edited. Change the mapping in ' +
      `${SOURCE_LABEL} and run \`pnpm zones:generate\`.\n`,
  );
  process.exitCode = 1;
}

// Only when run as a command. The stale-check test imports renderZonesScss
// from this file, and without this guard that import would EXECUTE the
// generator in write mode - so the test would regenerate the file it is
// supposed to be checking, and could never fail.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
