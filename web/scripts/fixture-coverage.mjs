// web/scripts/fixture-coverage.mjs
//
// R348: EVERY SECTION OF EVERY SHARED FIXTURE IS CONSUMED BY BOTH ENGINES.
//
// WHY THIS EXISTS. The two engines (web/lib/calc-engine, TypeScript; android
// .../calc + .../dossier, Kotlin) implement ONE set of rules and are gated on
// ONE set of fixtures under fixtures/ (R206/D20). REG-APPLY corrected the
// mission cap and updated fixtures/denominator-cases.json's missionCapCases, and
// :app:gate went red ONLY because the Kotlin suite happened to read that
// section - had it read denominator-cases.json but not its missionCapCases, the
// web fixture and the Kotlin engine would have diverged with both builds green.
// This census makes that impossible to repeat: a shared fixture section read by
// one engine and not the other is a failure here, so a change to any section
// fails in BOTH engines' suites (R283), not silently in one.
//
// DERIVED FROM THE FILES, NEVER A LIST (R246). The file set is fixtures/*.json
// as it is on disk; the section set is each file's own top-level keys; the
// consumers are discovered by scanning each engine's test tree. A fixture added
// tomorrow, or a section added to one, is in scope the day it lands - nothing
// here is hand-maintained.
//
// WHAT A "SECTION" IS. A top-level key whose value is an ARRAY - the collection
// of cases an engine iterates and asserts against. That is exactly the unit the
// mission-cap near-miss was about (a case array read by one side only). Scalar
// prose (rule, source, verificationTrace, ...) and metadata are not sections;
// comment keys (_comment, $comment) are excluded by the leading _/$ convention.
//
// WHAT "CONSUME" MEANS. An engine consumes section S of file F if a test file in
// that engine's suite references F by name AND references S as a key or property
// (quoted or dotted: "cases", .cases, getJSONArray("cases")). The bare word is
// not enough - the match must be in a key/accessor position - so an incidental
// "cases" in prose cannot read as consumption.
//
// THE SCOPE IS PER-FILE'S-CONSUMERS, AND THAT CHOICE IS DELIBERATE. A fixture is
// required of an engine only once that engine's suite reads the file at all; a
// file both engines read must have every section read by both. forecast-cases.json
// is read today by the Kotlin suite only (the AN-FORECAST foundation; the web
// consumer is the pending FW-FORECAST task) - so it is NOT failed here, but the
// single-engine state is printed loudly so it stays visible rather than silent.
// Tightening this to "both engines, every file, always" is a one-line change
// once the web forecast consumer exists; see REPORT-ENGINE-PARITY.txt.
//
// IN gate:clone's REACH, like register-coverage.mjs (R327). It is pure Node (fs
// only), so gate:clone runs it before install, and FixtureCoverageTest.kt shells
// out to this ONE definition so :app:gate enforces it too (R206 - a second
// implementation would drift).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const SELF = fileURLToPath(import.meta.url);
// This file lives at <root>/web/scripts/, so <root> is two directories up. An
// explicit argv[2] overrides it (FixtureCoverageTest.kt passes repoRoot so the
// resolution never depends on where node was launched from), matching R327.
const DEFAULT_ROOT = resolve(dirname(SELF), '..', '..');

// The two engines and the test tree each keeps the suites that may read a
// fixture. Derived, not per-fixture: every file under these trees is scanned.
const ENGINES = [
  { name: 'web (TypeScript)', dir: 'web/tests', exts: ['.ts', '.tsx'] },
  { name: 'android (Kotlin)', dir: 'android/app/src/test/kotlin', exts: ['.kt'] },
];

/** Recursively collect { path, text } for every source file under dir with a matching extension. */
function readTree(dir, exts) {
  const out = [];
  let entries;

  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      out.push(...readTree(full, exts));
    } else if (exts.includes(extname(entry.name))) {
      out.push({ path: full, text: readFileSync(full, 'utf8') });
    }
  }

  return out;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A section name used as a key or property: "cases", 'cases', .cases - not a bare word in prose. */
function referencesSection(text, section) {
  return new RegExp(`["'.]${escapeRegExp(section)}\\b`).test(text);
}

/**
 * @param {string} repoRoot
 * @returns {{ ok: boolean, problems: string[], files: number, sections: number, singleEngine: string[] }}
 */
export function checkFixtureCoverage(repoRoot) {
  const fixturesDir = join(repoRoot, 'fixtures');
  let fixtureNames;

  try {
    fixtureNames = readdirSync(fixturesDir)
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch {
    return {
      ok: false,
      problems: [`fixtures/ not found at ${fixturesDir}`],
      files: 0,
      sections: 0,
      singleEngine: [],
    };
  }

  if (fixtureNames.length === 0) {
    return {
      ok: false,
      problems: [
        `no *.json found under ${fixturesDir} - the derived scope is empty, which would let this ` +
          'check pass by finding nothing (R133)',
      ],
      files: 0,
      sections: 0,
      singleEngine: [],
    };
  }

  // Each engine's test corpus, read once.
  const corpus = ENGINES.map((engine) => ({
    name: engine.name,
    files: readTree(join(repoRoot, engine.dir), engine.exts),
  }));

  const problems = [];
  const singleEngine = [];
  let sectionCount = 0;

  for (const name of fixtureNames) {
    let parsed;

    try {
      parsed = JSON.parse(readFileSync(join(fixturesDir, name), 'utf8'));
    } catch (err) {
      problems.push(`${name} is not valid JSON: ${String(err)}`);
      continue;
    }

    // Sections = top-level ARRAY keys, excluding the _/$ comment convention.
    const sections = Object.entries(parsed)
      .filter(([key, value]) => Array.isArray(value) && !key.startsWith('_') && !key.startsWith('$'))
      .map(([key]) => key);

    // Which engines read this file at all (reference it by name).
    const consumingEngines = corpus
      .map((engine) => ({
        name: engine.name,
        files: engine.files.filter((f) => f.text.includes(name)),
      }))
      .filter((engine) => engine.files.length > 0);

    if (consumingEngines.length === 0) {
      problems.push(
        `${name} is in fixtures/ but NO engine's test suite reads it - an orphan fixture ` +
          'cannot catch a divergence (R133/R246)',
      );
      continue;
    }

    if (consumingEngines.length === 1) {
      singleEngine.push(`${name} -> ${consumingEngines[0].name} only`);
    }

    for (const section of sections) {
      sectionCount += 1;

      // Which consuming engines actually read this section (vs. merely reading the file).
      const readsSection = consumingEngines.filter((engine) =>
        engine.files.some((f) => referencesSection(f.text, section)),
      );
      const readerNames = readsSection.map((e) => e.name);

      for (const engine of consumingEngines) {
        if (readerNames.includes(engine.name)) {
          continue;
        }

        const others = readerNames.filter((n) => n !== engine.name).join(', ');

        problems.push(
          `${name}: ${engine.name} reads this file but NOT its section "${section}"` +
            (others ? ` (consumed by ${others})` : ' (consumed by neither engine)') +
            ' - a shared section one engine does not read is the mission-cap near-miss (R348)',
        );
      }
    }
  }

  return {
    ok: problems.length === 0,
    problems,
    files: fixtureNames.length,
    sections: sectionCount,
    singleEngine,
  };
}

function isMain() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return statSync(process.argv[1]).ino === statSync(SELF).ino && process.argv[1].endsWith('fixture-coverage.mjs');
  } catch {
    return process.argv[1].endsWith('fixture-coverage.mjs');
  }
}

if (isMain()) {
  const root = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_ROOT;
  const result = checkFixtureCoverage(root);

  if (result.singleEngine.length > 0) {
    process.stdout.write('fixture coverage: files read by ONE engine only (visible, not a failure):\n');

    for (const line of result.singleEngine) {
      process.stdout.write(`  - ${line}\n`);
    }
  }

  if (!result.ok) {
    process.stderr.write('R348: a shared fixture section is not consumed by every engine that reads its file:\n');

    for (const problem of result.problems) {
      process.stderr.write(`  - ${problem}\n`);
    }

    process.exit(1);
  }

  process.stdout.write(
    `fixture coverage: OK - ${result.sections} section(s) across ${result.files} file(s), ` +
      'each consumed by every engine that reads its file\n',
  );
}
