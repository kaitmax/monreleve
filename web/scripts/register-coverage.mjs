// web/scripts/register-coverage.mjs
//
// R327: THE ONE DEFINITION of the register-coverage check, shared by BOTH gates.
//
// The reports (REPORT-*.txt) and the register (parking.md) describe the same
// decisions from two sides, and nothing checks the space between them (R175): a
// report can cite a PARK-<n> / PARKAN-<n> the register never contained, so a
// reader following the citation up hits nothing. REPORT-AN5b/AN5c once cited
// PARKAN-16/17/18 that were never written (the 4 -> 19 gap), and AN-NEXT-2 cited
// PARKAN-37/38 with no headings and RED main between tasks.
//
// WHY A NODE SCRIPT, AND WHY ONE (R206, R327). This check is a REPOSITORY-WIDE
// DOCUMENT check - parking.md and REPORT-*.txt at the repo root, no Android code
// in it but a path helper. It lived only in the Android suite
// (:app:testDebugUnitTest), which gate:clone - the PUSH gate - does not run, so a
// report commit could red the Android gate invisibly after it had already left
// this machine. It is wired into gate:clone now; but a second implementation in
// Node beside the Kotlin one would drift (R206). So the LOGIC moved here, to one
// place both gates invoke as a subprocess:
//   - gate:clone runs it against the clone (web/scripts/gate-clone.mjs), the
//     cheapest signal, before install;
//   - RegisterCoverageTest.kt shells out to it, so :app:gate still enforces it.
// gate:clone-in-the-clone exercises the CLONE's copy of this file, so an
// uncommitted edit to it is not trusted (gate:clone checks HEAD).
//
// THE SCOPE IS DERIVED FROM THE REPORTS ON DISK, NEVER A HAND-KEPT LIST. A new
// report added tomorrow is scanned the day it lands. Every REPORT-*.txt at the
// repo root is read, every PARK-<n> and PARKAN-<n> it cites is collected, and
// parking.md must cover each - both that a "## <id> -" heading exists AND that the
// entry under it is real rather than a "Not transcribed" placeholder, because a
// heading with no content is a citation that resolves to a promise, not an entry.
//
// The PARK4-<n> series (Phase4parking.md) is a DIFFERENT register and is not
// matched: "PARK4-2" has a digit where PARK-<n> / PARKAN-<n> have a hyphen, so the
// pattern below excludes it. The published "P<n>" register is likewise not matched.

import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// This file lives at <root>/web/scripts/, so <root> is two directories up. An
// explicit argv[2] overrides it (RegisterCoverageTest.kt passes repoRoot so the
// resolution never depends on where node was launched from).
const SELF = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(dirname(SELF), '..', '..');

// PARK-12 or PARKAN-18, never PARK4-2 (a different series) and never the published P<n>.
const CITATION = /\bPARKAN?-\d+\b/g;

/**
 * @param {string} repoRoot
 * @returns {{ ok: boolean, problems: string[], cited: number, reports: number }}
 */
export function checkRegisterCoverage(repoRoot) {
  const parkingFile = join(repoRoot, 'parking.md');
  let parking;

  try {
    parking = readFileSync(parkingFile, 'utf8');
  } catch {
    return {
      ok: false,
      problems: [`parking.md not found at ${parkingFile}`],
      cited: 0,
      reports: 0,
    };
  }

  const reports = readdirSync(repoRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith('REPORT-') && entry.name.endsWith('.txt'))
    .map((entry) => entry.name)
    .sort();

  if (reports.length === 0) {
    return {
      ok: false,
      problems: [
        `no REPORT-*.txt found at ${repoRoot} - the derived scan scope is empty, ` +
          'which would let this check pass by finding nothing (R133)',
      ],
      cited: 0,
      reports: 0,
    };
  }

  // Which report(s) cite each id, for a failure message that points at the source.
  const citedBy = new Map();

  for (const name of reports) {
    const text = readFileSync(join(repoRoot, name), 'utf8');

    for (const match of text.matchAll(CITATION)) {
      const id = match[0];

      if (!citedBy.has(id)) {
        citedBy.set(id, new Set());
      }

      citedBy.get(id).add(name);
    }
  }

  const problems = [];

  for (const [id, who] of citedBy) {
    if (!hasHeading(parking, id)) {
      problems.push(
        `${id} is cited by ${[...who].join(', ')} but has no "## ${id} -" heading in parking.md`,
      );
    }
  }

  // An entry that exists as a heading but still carries the placeholder is not yet an entry.
  for (const id of placeholderEntries(parking)) {
    const who = citedBy.has(id) ? [...citedBy.get(id)].join(', ') : 'no report';

    problems.push(
      `${id} carries the "Not transcribed" placeholder in parking.md (cited by ${who}) - ` +
        'a heading with no content is a citation that resolves to a promise, not an entry',
    );
  }

  return { ok: problems.length === 0, problems, cited: citedBy.size, reports: reports.length };
}

function hasHeading(parking, id) {
  return new RegExp(`^##\\s+${escapeRegExp(id)}\\s+-`, 'm').test(parking);
}

// Split parking.md into sections at each "## PARK<...> -" heading; a section still
// carrying the "Not transcribed" placeholder is named by its heading id. The STATUS
// LEDGER row's lowercase "not transcribed" sits under "## STATUS LEDGER", not a PARK
// heading, so it is not a false positive - only a real placeholder BODY under a
// PARK/PARKAN heading is flagged.
function placeholderEntries(parking) {
  const headings = [...parking.matchAll(/^##\s+(PARKAN?-\d+)\s+-.*$/gm)];
  const flagged = [];

  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : parking.length;

    if (parking.slice(start, end).includes('Not transcribed')) {
      flagged.push(headings[i][1]);
    }
  }

  return flagged;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isMain() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(process.argv[1]) === realpathSync(SELF);
  } catch {
    return false;
  }
}

if (isMain()) {
  const root = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_ROOT;
  const result = checkRegisterCoverage(root);

  if (!result.ok) {
    process.stderr.write('R294/R327: parking.md does not cover every cited register entry:\n');

    for (const problem of result.problems) {
      process.stderr.write(`  - ${problem}\n`);
    }

    process.exit(1);
  }

  process.stdout.write(
    `register coverage: OK - ${result.cited} cited id(s) across ${result.reports} report(s), ` +
      'all have headings in parking.md\n',
  );
}
