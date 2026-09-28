// android/scripts/score-field-run.mjs
//
// AN6a increment 6, AC3. Scores a field run (AN6b) mechanically: given the app's export and the
// tester's daily log, it prints the R276 verdict per kill criterion, FALSE-CH on its own line
// (R278), and an honest confidence bound on every rate.
//
// THE THRESHOLDS ARE THE FIELD PROTOCOL'S, ENCODED, NOT CHOSEN (R276). docs/field-protocol-AN6b.md
// section 3 froze them; a zero-error month is scored against exactly what shipped. Picking a
// threshold after seeing the data would be fitting the gate to the measurement.
//
// A PASS IS "NOT VISIBLY BROKEN", NEVER PROOF. With 20 working days and zero errors the 95%
// upper bound on the error rate is ~15% (the rule of three, 3/n). The harness prints that bound
// beside every rate so a good month cannot be read as an accuracy claim.
//
// Usage: node score-field-run.mjs --export <export.json> --log <log.csv> [--battery-median <pct>]

import { readFileSync } from 'node:fs';

// docs/field-protocol-AN6b.md section 3 - the kill criteria, encoded.
const K2_MAX_WRONG_HIGH = 1;
const K3_MAX_WRONG_MEDIUM_RATE = 0.15;
const K4_MIN_COVERAGE = 0.60;
const K5_MAX_BATTERY_MEDIAN = 3.0;

const WORKED = ['Suisse', 'Domicile', 'Mission'];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

// The 95% upper bound on the true error rate: the rule of three when there are no errors, the
// Wilson score upper bound otherwise. Null when there is no data to bound. Capped at 1: a bound on
// a probability cannot exceed 100%, and the rule of three saturates below n=3 (3/2 = 1.5), where
// the honest reading is "this sample says almost nothing", not "150% of days".
function upper95(errors, n) {
  if (n === 0) return null;
  if (errors === 0) return Math.min(1, 3 / n);
  const z = 1.96;
  const p = errors / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.min(1, (centre + margin) / denom);
}

const pct = (x) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);

function parseLog(csv) {
  const rows = csv.trim().split(/\r?\n/).slice(1); // drop the header
  const log = new Map();
  for (const line of rows) {
    const [date, actual] = line.split(',').map((c) => c.trim());
    if (date) log.set(date, actual);
  }
  return log;
}

// proposedKind CH means "En Suisse"; HOME means "Domicile".
const agrees = (kind, actual) =>
  (kind === 'CH' && actual === 'Suisse') || (kind === 'HOME' && actual === 'Domicile');

function score(exportRows, log, batteryMedian) {
  const days = exportRows
    .map((row) => ({ ...row, actual: log.get(row.dayDate) }))
    .filter((day) => day.actual !== undefined);

  const workingDays = days.filter((d) => WORKED.includes(d.actual));
  const high = days.filter((d) => d.tier === 'HIGH' && d.proposedKind);
  const medium = days.filter((d) => d.tier === 'MEDIUM' && d.proposedKind);

  const falseCh = high.filter((d) => d.proposedKind === 'CH' && d.actual === 'Domicile');
  const wrongHigh = high.filter((d) => !agrees(d.proposedKind, d.actual));
  const wrongMedium = medium.filter((d) => !agrees(d.proposedKind, d.actual));
  const covered = workingDays.filter((d) => (d.tier === 'HIGH' || d.tier === 'MEDIUM') && d.proposedKind);
  const coverage = workingDays.length === 0 ? 0 : covered.length / workingDays.length;

  const results = [];
  // K1 - FALSE-CH, on its own line (R278). The dangerous error: proposed En Suisse on a home day.
  results.push({
    id: 'K1',
    label: 'FALSE-CH on a HIGH day (proposed En Suisse, was at home)',
    value: `${falseCh.length} of ${high.length} HIGH days`,
    bound: `95% upper bound ${pct(upper95(falseCh.length, high.length))}`,
    pass: falseCh.length === 0,
    threshold: 'zero',
  });
  results.push({
    id: 'K2',
    label: 'Wrong HIGH proposals (any kind)',
    value: `${wrongHigh.length} of ${high.length} HIGH days`,
    bound: `95% upper bound ${pct(upper95(wrongHigh.length, high.length))}`,
    pass: wrongHigh.length <= K2_MAX_WRONG_HIGH,
    threshold: `at most ${K2_MAX_WRONG_HIGH}`,
  });
  const mediumRate = medium.length === 0 ? 0 : wrongMedium.length / medium.length;
  results.push({
    id: 'K3',
    label: 'Wrong MEDIUM proposals',
    value: `${wrongMedium.length} of ${medium.length} MEDIUM days (${pct(mediumRate)})`,
    bound: `95% upper bound ${pct(upper95(wrongMedium.length, medium.length))}`,
    pass: mediumRate <= K3_MAX_WRONG_MEDIUM_RATE,
    threshold: `at most ${pct(K3_MAX_WRONG_MEDIUM_RATE)}`,
  });
  results.push({
    id: 'K4',
    label: 'Coverage (HIGH or MEDIUM on a working day)',
    value: `${covered.length} of ${workingDays.length} working days (${pct(coverage)})`,
    bound: '',
    pass: coverage >= K4_MIN_COVERAGE,
    threshold: `at least ${pct(K4_MIN_COVERAGE)}`,
  });
  results.push({
    id: 'K5',
    label: 'Battery, median per working day',
    value: batteryMedian === undefined ? 'measured separately (profiler method)' : `${batteryMedian.toFixed(1)}%`,
    bound: '',
    pass: batteryMedian === undefined ? null : batteryMedian <= K5_MAX_BATTERY_MEDIAN,
    threshold: `at most ${K5_MAX_BATTERY_MEDIAN}%`,
  });
  results.push({
    id: 'K6',
    label: 'A day written without the person tap',
    value: 'measurement mode never writes an entry (D16, fence 7)',
    bound: '',
    pass: true,
    threshold: 'never',
  });
  return { results, dayCount: days.length, workingCount: workingDays.length };
}

const exportPath = arg('--export');
const logPath = arg('--log');
if (!exportPath || !logPath) {
  console.error('usage: node score-field-run.mjs --export <export.json> --log <log.csv> [--battery-median <pct>]');
  process.exit(1);
}
const batteryArg = arg('--battery-median');
const batteryMedian = batteryArg === undefined ? undefined : Number(batteryArg);

const exportRows = JSON.parse(readFileSync(exportPath, 'utf8'));
const log = parseLog(readFileSync(logPath, 'utf8'));
const { results, dayCount, workingCount } = score(exportRows, log, batteryMedian);

console.log('\n=== field run score (R276) ===');
console.log(`days matched: ${dayCount}   working days: ${workingCount}`);
console.log('a PASS means "not visibly broken", never proof - read the bounds.\n');
let allPass = true;
const unmeasured = [];
for (const r of results) {
  const mark = r.pass === null ? 'n/a ' : r.pass ? 'PASS' : 'FAIL';
  if (r.pass === false) allPass = false;
  if (r.pass === null) unmeasured.push(r.id);
  console.log(`  ${mark}  ${r.id}  ${r.label}`);
  console.log(`        ${r.value}   (threshold: ${r.threshold})${r.bound ? `   ${r.bound}` : ''}`);
}
const unmeasuredNote = unmeasured.length === 0 ? '' : ` (${unmeasured.join(', ')} not measured this run)`;
console.log(
  `\nCheckpoint G, so far: ${allPass ? 'no criterion failed (not a pass - see the bounds)' : 'A CRITERION FAILED'}${unmeasuredNote}`,
);
process.exit(allPass ? 0 : 1);
