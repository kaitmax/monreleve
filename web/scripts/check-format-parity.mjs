// web/scripts/check-format-parity.mjs
//
// SPEC section 21 ship criterion: formatPercent and formatDays render "the
// same codepoints, identical on Node 22 and 24". SPEC section 19 repeats it.
//
// WHY THIS EXISTS. Ruling R27 put the Node floor at 22, so this is no
// longer a workaround for vitest excluding Node 20 - it is the check that
// the SUPPORTED versions agree with each other. What moves a separator
// codepoint is an ICU or CLDR change, and those ship with a Node major, so
// 22 against 24 is the comparison that matters.
//
// The value of having no imports, no node_modules and no TypeScript is that
// a leg cannot go red for a toolchain reason: if it fails, the formatters
// really do disagree.
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

/**
 * THE TYPED BOUNDARY - RULING R107, and the half that does the work.
 *
 * checkJs alone would NOT have caught the defect that started this. load()
 * is a dynamic import of a COMPUTED path, which TypeScript types as any, so
 * formatPercent was any and any arity was legal - which is precisely how
 * formatPercent(100) survived R97's "compile error, not convention" and
 * failed CI for eight commits.
 *
 * These annotations point at the SOURCE modules, so the signatures flow from
 * the declarations, while the runtime still imports the BUILT output from
 * dist-parity. That split is the point of a parity check: the types come from
 * one place and the bytes under test from another, on whichever Node version
 * is running.
 */

/** @type {typeof import('../lib/ui/core/format/number')} */
const numberFormat = await load('number.js');

/** @type {typeof import('../lib/ui/core/format/date')} */
const dateFormat = await load('date.js');

const { formatDays, formatPercent, formatSignedDays } = numberFormat;
const { formatDate, formatDateTime } = dateFormat;

/**
 * SPEC 6.4's two examples plus the cases that carry a codepoint decision.
 * Every expectation is assembled from the constants above.
 */
const CASES = [
  // RULING R97 MADE THE PRECISION REQUIRED, and these two calls are why CI
  // went red for eight commits while every local gate was green. This file is
  // .mjs, so tsc never sees it: R97 was enforced as a compile error and a
  // compile error cannot reach a script that is not compiled.
  //
  // 34.6 PASSED BY ACCIDENT, which is the more interesting half. With
  // decimals undefined, Intl.NumberFormat falls back to at most three
  // fraction digits and renders "34,6 %" anyway - the right answer from a
  // broken call. formatPercent(100) rendered "100 %" against an expectation
  // of "100,0 %" and failed. One bug, one visible symptom.
  //
  // SPEC 6.4's own example is formatPercent(34.6) -> 34,6 %, at one decimal.
  ['formatPercent(34.6, 1)', formatPercent(34.6, 1), `34${COMMA}6${NBSP}%`],
  ['formatPercent(39.16, 2)', formatPercent(39.16, 2), `39${COMMA}16${NBSP}%`],
  ['formatPercent(39.95, 1) truncates', formatPercent(39.95, 1), `39${COMMA}9${NBSP}%`],
  ['formatPercent(100, 1)', formatPercent(100, 1), `100${COMMA}0${NBSP}%`],
  ['formatDays(1234.5)', formatDays(1234.5), `1${NNBSP}234${COMMA}5`],
  ['formatDays(1000)', formatDays(1000), `1${NNBSP}000`],
  ['formatDays(240)', formatDays(240), '240'],
  ['formatDays(96.5)', formatDays(96.5), `96${COMMA}5`],
  ['formatSignedDays(-12.5).text', formatSignedDays(-12.5).text, `12${COMMA}5`],
  ['formatDate(2026-12-18)', formatDate('2026-12-18'), '18.12.2026'],
  [
    'formatDateTime(2027-06-18T16:03Z)',
    formatDateTime('2027-06-18T16:03:00Z'),
    `18.06.2027${NBSP}${A_GRAVE}${NBSP}18:03`,
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
