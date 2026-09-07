// web/scripts/check-format-parity.mjs
//
// SPEC section 21 ship criterion: formatPercent and formatDays render "the
// same codepoints, identical on Node 20 and 22". SPEC section 19 repeats it.
//
// WHY THIS EXISTS INSTEAD OF A SECOND VITEST LANE. vitest 5 declares
// engines "^22.12.0 || ^24.0.0 || >=26.0.0" - Node 20 is excluded outright,
// not merely untested - so the formatter SUITE cannot run there at all. This
// script is the parity check with the test runner taken out of it: no
// imports, no node_modules, no TypeScript. It runs the compiled formatters
// and asserts codepoints, so it executes on any Node that has Intl.
//
// It does NOT replace the suite. It checks the one property the suite cannot
// check on Node 20 - that the bytes are the same there - and the full suite
// still runs on the supported versions. Recorded in REPORT-FW6.txt with the
// three options for closing the gap properly, which need an operator ruling.
//
// USAGE: node scripts/check-format-parity.mjs <dir-of-compiled-js>
//
// The directory must hold number.js and date.js as emitted by tsc from
// lib/ui/core/format/. Both modules have no runtime imports, which is what
// makes compiling just those two files sufficient.

import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

// Built from char codes rather than written as escapes, so nothing between
// here and the file can quietly turn one no-break space into another.
const NBSP = String.fromCharCode(0x00a0); // U+00A0 NO-BREAK SPACE
const NNBSP = String.fromCharCode(0x202f); // U+202F NARROW NO-BREAK SPACE
const COMMA = String.fromCharCode(0x002c);
const A_GRAVE = String.fromCharCode(0x00e0);

const named = (text) =>
  [...text]
    .map((char) => `U+${char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
    .join(' ');

const dir = resolve(process.argv[2] ?? 'dist-parity');
const load = (file) => import(pathToFileURL(join(dir, file)).href);

const { formatDays, formatPercent, formatSignedDays } = await load('number.js');
const { formatDate, formatDateTime } = await load('date.js');

/**
 * SPEC 6.4's two examples plus the cases that carry a codepoint decision.
 * Every expectation is assembled from the constants above.
 */
const CASES = [
  ['formatPercent(34.6)', formatPercent(34.6), `34${COMMA}6${NBSP}%`],
  ['formatPercent(39.16, 2)', formatPercent(39.16, 2), `39${COMMA}16${NBSP}%`],
  ['formatPercent(39.95, 1) truncates', formatPercent(39.95, 1), `39${COMMA}9${NBSP}%`],
  ['formatPercent(100)', formatPercent(100), `100${COMMA}0${NBSP}%`],
  ['formatDays(1234.5)', formatDays(1234.5), `1${NNBSP}234${COMMA}5`],
  ['formatDays(1000)', formatDays(1000), `1${NNBSP}000`],
  ['formatDays(240)', formatDays(240), '240'],
  ['formatDays(96.5)', formatDays(96.5), `96${COMMA}5`],
  ['formatSignedDays(-12.5).text', formatSignedDays(-12.5).text, `12${COMMA}5`],
  ['formatDate(2026-12-18Z)', formatDate(new Date('2026-12-18T00:00:00Z')), '18.12.2026'],
  [
    'formatDateTime(2027-06-18T16:03Z)',
    formatDateTime(new Date('2027-06-18T16:03:00Z')),
    `18.06.2027 ${A_GRAVE} 18:03`,
  ],
];

// R26, exhaustively, on whichever Node this is. The ruling's own domain: for
// every integer n in 0..10000, two decimals must render exactly the digits of
// n. Expectation by integer arithmetic only.
function r26Failures() {
  const failures = [];

  for (let n = 0; n <= 10_000; n++) {
    const whole = Math.floor(n / 100);
    const wanted = `${whole >= 1000 ? `${Math.floor(whole / 1000)}${NNBSP}${String(whole % 1000).padStart(3, '0')}` : String(whole)}${COMMA}${String(n % 100).padStart(2, '0')}${NBSP}%`;
    const got = formatPercent(n / 100, 2);

    if (got !== wanted) failures.push(`n=${n}: wanted ${named(wanted)} got ${named(got)}`);
  }

  return failures;
}

const failures = [];

for (const [label, got, wanted] of CASES) {
  if (got !== wanted) {
    failures.push(`${label}\n    wanted ${named(wanted)}\n    got    ${named(got)}`);
  }
}

const exhaustive = r26Failures();
if (exhaustive.length > 0) {
  failures.push(`R26 exhaustive: ${exhaustive.length} of 10001 failed\n    ${exhaustive[0]}`);
}

process.stdout.write(
  `format parity on ${process.version} (ICU ${process.versions.icu}, CLDR ${process.versions.cldr})\n`,
);

if (failures.length > 0) {
  process.stderr.write(`\n${failures.length} parity failure(s):\n`);
  for (const failure of failures) process.stderr.write(`  ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `  ${CASES.length} codepoint cases and 10001 exhaustive values: all identical\n`,
  );
}
