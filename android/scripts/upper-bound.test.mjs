// android/scripts/upper-bound.test.mjs
//
// AN5b increment 0, R279. The exact one-sided 95% binomial upper bound at zero errors,
// 1 - 0.05^(1/n), pinned against independently-computed known values so a change to the formula
// is caught rather than trusted. Run: node --test upper-bound.test.mjs
//
// The knowns below were computed by hand from 1 - 0.05^(1/n), NOT read back out of the code, so
// this is a value test and not a tautology (R197). The rule of three (3/n) values are shown beside
// each as the large-n approximation the exact bound replaces: they agree at n=20 (~14% vs 15%) and
// diverge wildly at n=2 (78% vs the impossible 150%), which is the whole reason for R279.

import test from 'node:test';
import assert from 'node:assert/strict';

import { score, upper95 } from './score-field-run.mjs';

// n -> the exact 1 - 0.05^(1/n), to 6 dp, computed independently of the implementation.
const KNOWN_ZERO_ERROR = {
  1: 0.95, //        rule of three: 3.000 (300%)
  2: 0.776393, //    rule of three: 1.500 (150%, impossible)
  3: 0.631597, //    rule of three: 1.000 (100%)
  10: 0.258866, //   rule of three: 0.300 (30%)
  17: 0.161566, //   rule of three: 0.176 (17.6%) - the worked example's HIGH count
  20: 0.139108, //   rule of three: 0.150 (15%) - here they nearly agree
};

test('zero-error bound equals the exact binomial at every pinned n', () => {
  for (const [n, expected] of Object.entries(KNOWN_ZERO_ERROR)) {
    const got = upper95(0, Number(n));
    assert.ok(
      Math.abs(got - expected) < 1e-5,
      `n=${n}: expected ~${expected}, got ${got}`,
    );
  }
});

test('the bound never exceeds 1, unlike the rule of three it replaces', () => {
  // 3/n exceeds 1 for n < 3; the exact bound cannot, by construction.
  for (let n = 1; n <= 30; n += 1) {
    const got = upper95(0, n);
    assert.ok(got > 0 && got < 1, `n=${n}: ${got} is not a probability`);
  }
});

test('the bound decreases monotonically as n grows', () => {
  let previous = 1;
  for (let n = 1; n <= 100; n += 1) {
    const got = upper95(0, n);
    assert.ok(got < previous, `n=${n}: ${got} did not decrease below ${previous}`);
    previous = got;
  }
});

test('with errors present it uses Wilson, a real bound above the point rate', () => {
  const got = upper95(1, 20); // p = 0.05; Wilson upper ~0.246
  assert.ok(got > 0.05 && got < 0.4, `expected a Wilson bound near 0.25, got ${got}`);
});

test('no data means no bound', () => {
  assert.equal(upper95(0, 0), null);
  assert.equal(upper95(3, 0), null);
});

// AN-NEXT-2 / R324. The scorer surfaces the provider share so the field test can see how often the NETWORK
// (wifi/cell) fallback decided a check - counts only, read from the export's gpsChecks/networkChecks.
test('the score surfaces how often network location decided a check (R324)', () => {
  const log = 'date,actual\n2027-06-01,Suisse\n2027-06-02,Suisse\n';
  const exportRows = [
    { dayDate: '2027-06-01', tier: 'HIGH', proposedKind: 'CH', gpsChecks: 1, networkChecks: 3 },
    { dayDate: '2027-06-02', tier: 'HIGH', proposedKind: 'CH', gpsChecks: 4, networkChecks: 0 },
  ];
  const { provider } = score(exportRows, parseLogForTest(log));
  assert.equal(provider.gpsChecks, 5);
  assert.equal(provider.networkChecks, 3);
  assert.ok(Math.abs(provider.networkShare - 3 / 8) < 1e-9);
});

// A day with no matching log row is dropped before counting, and an all-GPS run reports a zero network share
// rather than null - null is reserved for "no checks at all".
test('network share is null only when there were no checks at all (R324)', () => {
  const { provider } = score([], new Map());
  assert.equal(provider.networkShare, null);
  const allGps = score(
    [{ dayDate: '2027-06-01', tier: 'HIGH', proposedKind: 'CH', gpsChecks: 4, networkChecks: 0 }],
    new Map([['2027-06-01', 'Suisse']]),
  ).provider;
  assert.equal(allGps.networkShare, 0);
});

// A tiny log parser mirroring the module's own, kept here so the test does not depend on the CLI path.
function parseLogForTest(csv) {
  const map = new Map();
  for (const line of csv.trim().split(/\r?\n/).slice(1)) {
    const [date, actual] = line.split(',').map((c) => c.trim());
    if (date) map.set(date, actual);
  }
  return map;
}
