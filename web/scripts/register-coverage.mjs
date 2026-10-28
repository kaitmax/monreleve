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
// repo root is read, every id of this register it cites is collected, and
// parking.md must cover each - THREE things, not one: that a "## <id> -" heading
// exists, that the entry under it is real rather than a "Not transcribed"
// placeholder, because a heading with no content is a citation that resolves to a
// promise rather than an entry, and that there is exactly ONE such heading, because
// two entries under one id is a citation that resolves to whichever a reader meets
// first. The third was added by FW-PARK-IDS and is the reason SHARED_IDS exists.
//
// R442 (FW-PARK-IDS): WHAT "AN ID OF THIS REGISTER" MEANS, AND WHAT IT USED TO
// MEAN. This header used to say "every PARK-<n> and PARKAN-<n>", and the pattern
// below said `/\bPARKAN?-\d+\b/g`. Those are not the same thing: `PARKAN?` is the
// five letters PARKA followed by an OPTIONAL N, so what it matched was
// PARKAN-<n> and PARKA-<n> - never `PARK-12`, and never a lettered id. At
// 5e87a4a it reported "39 cited id(s) across 115 report(s)" and all thirty-nine
// were PARKAN-<n>: the whole PARK-<n> series and every PARK-<letter><n> were
// invisible to the check that exists to make a citation followable. A comment
// asserting behaviour nothing delivers is R154's defect; this one asserted it
// for long enough that twenty-eight lettered ids accumulated with no entry.
//
// THE SHAPES ARE A CENSUS, NOT A GUESS. Across REPORT-*.txt, relay/ and
// parking.md, every id of this register WAS PARK-<n>, PARKAN-<n> or
// PARK-<ONE letter><n> - A1, B1..B4, F1..F3, G1, I1..I5, K1..K7, P1, P2, R1,
// R2, S1..S3, U1..U3. Hence, in R442, ONE optional letter, not `[A-Z]*`:
// PARK-FW34-LAUNCH is a real citation of a different shape, and `[A-Z]*\d+\b`
// matches PARK-FW34 out of it, because the hyphen that follows is a word
// boundary - reporting a cited id that exists nowhere (PARK-25).
//
// R679 (FW-PARK-IDS-2) WIDENED IT TO TWO LETTERS once all twenty-six single
// letters were taken, and kept PARK-25's protection by a different means: not
// by refusing the second letter, but by refusing a following hyphen, letter or
// digit after the number. See PARK_ID below, and PARK-PI2.
//
// WHAT IS STILL NOT MATCHED, AND WHY. The task-local series - PARK4-<n>
// (Phase4parking.md), PARK5-<n>, PARK5b-<n>, PARK26-<n>, PARK27-<n>,
// PARK30-<n>, PARK31-<n> - are registers of their own: each has a digit where
// this one has a hyphen, so none of them reaches `PARK-` or `PARKAN-`. The
// published "P<n>" register (R162) is likewise not matched, nor are PARKED,
// PARKING, a bare "PARK-", or PARKAN-NNN.

import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// This file lives at <root>/web/scripts/, so <root> is two directories up. An
// explicit argv[2] overrides it (RegisterCoverageTest.kt passes repoRoot so the
// resolution never depends on where node was launched from).
const SELF = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(dirname(SELF), '..', '..');

// ONE HOME FOR THE SHAPE (R206). Two places need it - the citation scan and the
// heading scan - and before FW-PARK-IDS each held its own copy of the same
// expression. They did not drift; they shared one defect, and a widening that
// reached only the first would have left the placeholder scan blind to every
// heading this change makes legal. A second description of one rule is the
// thing that can disagree with it, so there is one.
//
// R679 (FW-PARK-IDS-2): ONE OR TWO CAPITAL LETTERS, AND A BOUNDARY AFTER THE
// DIGITS. Every single letter A-Z was taken by 28.10.2026, so the series widened
// to two letters. What made one letter the safe choice in R442 was
// PARK-FW34-LAUNCH: a two-letter class closed only by `\b` reads PARK-FW34 out
// of it, because the hyphen that follows IS a word boundary. So the id ends at a
// lookahead refusing a following hyphen, letter, digit or underscore - `\w`
// keeps the underscore `\b` already refused, so nothing that `\b` refused is
// newly accepted. A longer token is never read as a shorter id: PARK-FW34-LAUNCH
// yields nothing, PARK-FW34 written on its own resolves.
//
// EXPORTED, AND IMPORTED WHEREVER IT IS USED (R679, R206). This file's two
// scans read it; R680's census imported it rather than retyping it. A copy
// anywhere else is a second definition.
const BOUNDARY = String.raw`(?![\w-])`;

export const PARK_ID = String.raw`PARK(?:AN)?-[A-Z]{0,2}\d+${BOUNDARY}`;

// PARK-12, PARKAN-18, PARK-K6 or PARK-FT1; never PARK4-2 (a different series),
// never a bare PARK-, never PARKED, never the published P<n>, and never a
// shorter id read out of a longer token.
export const CITATION = new RegExp(String.raw`\b${PARK_ID}`, 'g');

// CITATIONS THAT ARE NOT ENTRIES, AND MUST NEVER BECOME ONE.
//
// R680's census ran the widened pattern over every tracked file. Two ids in
// reports on main resolve under it that never resolved before and are not
// entries of this register: PARK-FW34 in REPORT-FW-PARK-IDS.txt, which names the
// phantom a wrong pattern would read out of PARK-FW34-LAUNCH, and PARK-ZZ1 in
// REPORT-KMP-DT.txt, which names an id the one-letter rule did not match. Those
// reports are history and are not edited.
//
// SO THE EXEMPTION IS A (REPORT, ID) PAIR, NEVER AN ID. Exempting the bare id
// PARK-FW34 would exempt exactly the string R680 exists to test: a new report
// citing PARK-FW34, or a pattern that read it out of PARK-FW34-LAUNCH, would
// pass in silence. Keyed to the one report that names it, any OTHER report
// citing it still fails like any unheaded id.
//
// AND A HEADING UNDER EITHER ID FAILS, because the citation in that report would
// then resolve to an entry it never meant (R196: both directions). Frozen at two
// and asserted, like SHARED_IDS. Recorded as PARK-PI1.
const PHANTOM_CITATIONS = Object.freeze(['REPORT-FW-PARK-IDS.txt:PARK-FW34', 'REPORT-KMP-DT.txt:PARK-ZZ1']);

/** The ids named by PHANTOM_CITATIONS, each of which must never carry a heading. */
const PHANTOM_IDS = Object.freeze(PHANTOM_CITATIONS.map((pair) => pair.slice(pair.indexOf(':') + 1)));

// THE IDS ALLOWED TO CARRY MORE THAN ONE ENTRY, AND NOTHING ELSE EVER IS.
//
// WHY THE DUPLICATE CHECK EXISTS AT ALL. Until FW-PARK-IDS this file asked only
// whether a heading EXISTS. That question is satisfied just as well by TWO
// headings with the same id as by one, so an id owned by two tasks merged in
// silence and a reader following the citation landed on whichever entry came
// first in the file. Renaming the ids in one collision fixes that collision;
// it does not stop the next one, because nothing was looking.
//
// WHY THESE THREE ARE EXEMPT. PARK-F1, PARK-F2 and PARK-F3 were each allocated
// by TWO tasks - FW-FOLLOWUP (15.10.2026) and FW-FUTURE-DAY (19.10.2026) - for
// six different findings. The reports that cite them are HISTORY: they are on
// main, they record what those sessions decided, and a register is not a reason
// to rewrite them. So renaming is unavailable, and the only two remaining
// options were to leave the duplicate check unwritten - which keeps the register
// permanently blind to exactly the case it exists for - or to name the three ids
// that may legitimately carry a second entry. This is the second.
//
// IT IS FROZEN AT THREE, AND A TEST SAYS SO. Asserted-exactly-three beats
// merely-three (R206's corollary): a fourth exemption has to survive its own
// argument rather than joining an established habit, which is how every
// exemption list in this repository has nearly failed.
//
// IT EXEMPTS NOTHING TODAY, which is stated rather than left to be discovered.
// Each of the three has exactly ONE heading in parking.md - one entry carrying
// both findings - so this list is a standing permission rather than a cover for
// something already there. If those entries are ever split one-per-task, this is
// what permits it.
const SHARED_IDS = Object.freeze(['PARK-F1', 'PARK-F2', 'PARK-F3']);

/**
 * @param {string} repoRoot
 * @returns {{ ok: boolean, problems: string[], cited: number, reports: number, series?: string }}
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

      // A phantom is a citation of nothing, by design, in the ONE report that
      // makes it; it is checked below for the opposite fault - a heading - and
      // is not counted as cited. The same id from any other report is not exempt.
      if (PHANTOM_CITATIONS.includes(`${name}:${id}`)) {
        continue;
      }

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

  const headings = headingsOf(parking);

  // The other direction: a phantom that gains a heading would give a citation
  // its report never meant a destination.
  for (const id of PHANTOM_IDS) {
    if (hasHeading(parking, id)) {
      problems.push(
        `${id} is a phantom citation - a report on main names it as an example, not an entry - ` +
          `and must not carry a "## ${id} -" heading in parking.md`,
      );
    }
  }

  // An entry that exists as a heading but still carries the placeholder is not yet an entry.
  for (const id of placeholderEntries(parking, headings)) {
    const who = citedBy.has(id) ? [...citedBy.get(id)].join(', ') : 'no report';

    problems.push(
      `${id} carries the "Not transcribed" placeholder in parking.md (cited by ${who}) - ` +
        'a heading with no content is a citation that resolves to a promise, not an entry',
    );
  }

  // One id, two entries: a citation of it resolves to whichever a reader meets first.
  for (const [id, lines] of duplicateHeadings(headings)) {
    problems.push(
      `${id} has ${lines.length} "## ${id} -" headings in parking.md ` +
        `(lines ${lines.join(', ')}) - one id, two entries, and a citation of it ` +
        'resolves to whichever a reader finds first',
    );
  }

  return {
    ok: problems.length === 0,
    problems,
    cited: citedBy.size,
    reports: reports.length,
    series: seriesTaken(headings),
  };
}

/**
 * R681: WHICH SERIES THE REGISTER'S HEADINGS USE, so a session claims a free one
 * by asking the register rather than reading a list or trusting a prompt (R456).
 * Derived from headingsOf() - the same scan the coverage checks read - so the
 * answer cannot disagree with what the check sees.
 *
 * @param {Array<{ id: string }>} headings
 * @returns {string}
 */
function seriesTaken(headings) {
  const one = new Set();
  const two = new Set();
  let park = 0;
  let parkan = 0;

  for (const { id } of headings) {
    const [, an, letters, digits] = /^PARK(AN)?-([A-Z]*)(\d+)$/.exec(id) ?? [];

    if (letters === undefined) {
      continue;
    }

    if (letters.length === 1) {
      one.add(letters);
    } else if (letters.length === 2) {
      two.add(letters);
    } else if (an === undefined) {
      park = Math.max(park, Number(digits));
    } else {
      parkan = Math.max(parkan, Number(digits));
    }
  }

  const list = (set) => (set.size === 0 ? 'none' : [...set].sort().join(' '));
  const held = [...new Set(PHANTOM_IDS.map((id) => /^PARK-([A-Z]+)/.exec(id)?.[1] ?? ''))].sort().join(' ');

  return (
    `series taken: one letter ${list(one)}; two letters ${list(two)}; ` +
    `PARK-<n> up to ${park === 0 ? 'none' : park}; PARKAN-<n> up to ${parkan === 0 ? 'none' : parkan}; ` +
    `two-letter series held by phantom citations: ${held}`
  );
}

function hasHeading(parking, id) {
  return new RegExp(`^##\\s+${escapeRegExp(id)}\\s+-`, 'm').test(parking);
}

/**
 * EVERY "## <id> -" HEADING IN parking.md, SCANNED ONCE.
 *
 * TWO CONSUMERS READ THIS, NOT THE EXPRESSION (R206). The placeholder scan and
 * the duplicate scan both need the same headings in the same order, and the
 * previous version of this file is the argument: the heading matcher held its
 * own copy of the id expression, shared the citation scan's defect, and saw 39
 * of parking.md's 97 headings. Adding a third consumer with a third copy would
 * have rebuilt exactly what the last commit removed.
 *
 * The line number is counted from the text rather than re-scanned, so it cannot
 * disagree with the index it is derived from.
 *
 * @param {string} parking
 * @returns {Array<{ id: string, index: number, line: number }>}
 */
function headingsOf(parking) {
  const found = [];

  for (const match of parking.matchAll(new RegExp(String.raw`^##\s+(${PARK_ID})\s+-.*$`, 'gm'))) {
    const index = match.index ?? 0;
    const line = parking.slice(0, index).split('\n').length;

    found.push({ id: match[1], index, line });
  }

  return found;
}

/**
 * Ids carrying more than one entry, minus the three that are allowed to.
 *
 * BOTH DIRECTIONS MATTER HERE, the way they did for FW21's database constraints
 * (R196): a duplicate scan that reported EVERY repeated id would be refused by
 * the three this register cannot rename, and one that exempted anything would
 * pass on the case it exists for. So the exemption is a named list of three,
 * frozen and asserted, and everything else fails.
 *
 * @param {Array<{ id: string, line: number }>} headings
 * @returns {Map<string, number[]>}
 */
function duplicateHeadings(headings) {
  const lines = new Map();

  for (const heading of headings) {
    if (!lines.has(heading.id)) {
      lines.set(heading.id, []);
    }

    lines.get(heading.id).push(heading.line);
  }

  const duplicates = new Map();

  for (const [id, found] of lines) {
    if (found.length > 1 && !SHARED_IDS.includes(id)) {
      duplicates.set(id, found);
    }
  }

  return duplicates;
}

// Split parking.md into sections at each "## PARK<...> -" heading; a section still
// carrying the "Not transcribed" placeholder is named by its heading id. The STATUS
// LEDGER row's lowercase "not transcribed" sits under "## STATUS LEDGER", not a PARK
// heading, so it is not a false positive - only a real placeholder BODY under a
// PARK/PARKAN heading is flagged.
//
// IT READS THE SAME HEADINGS AS THE DUPLICATE SCAN (R267). This matcher carried its
// own copy of the narrow expression, so it saw 39 of the 97 headings in
// parking.md - a placeholder under "## PARK-12 -" or "## PARK-K6 -" could not
// be flagged at all. A finding that names a second site is not closed until
// that site is checked, and the sites now cannot diverge.
function placeholderEntries(parking, headings) {
  const flagged = [];

  for (let i = 0; i < headings.length; i += 1) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : parking.length;

    if (parking.slice(start, end).includes('Not transcribed')) {
      flagged.push(headings[i].id);
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

  // R681: printed on every run, pass or fail, so claiming a series needs no
  // second tool. stdout, so it never reads as part of a failure.
  if (result.series !== undefined) {
    process.stdout.write(`${result.series}\n`);
  }

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
