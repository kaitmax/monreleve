// web/tests/unit/meta/container-render-verdict.test.ts
//
// FW-PDF-RENDER-GATE (R981). The container step's verdict, per test.
//
// scripts/container-e2e.mjs used to read ONE number from its vitest step -
// "Tests  N passed" - and refuse only when it was zero. That was enough while
// the step ran container-auth and container-pdf, whose every test needs the
// container. It is not enough once export-pdf.test.ts joins: that file has
// seven handler-only tests that pass with no server at all, so its fifteen
// render tests could skip and the step would still print a healthy count
// (R133: a suite that skipped exits 0 and reads like one that passed).
//
// So the verdict is per test: every test of every file the step runs passed
// in at least one of its passes, and none failed in any. The passes are
// plural because verification-qr.test.ts asserts two states of one server
// setting, and a server holds one at a time (R332).

import { describe, expect, it } from 'vitest';
import { renderVerdict } from '../../../scripts/container-render-verdict.mjs';

type Status = 'passed' | 'failed' | 'skipped';

/** A vitest JSON report, in the shape `--reporter=json` writes. */
function report(
  files: Record<string, Array<[string[], string, Status]>>,
  root = 'C:/wt/x/web/',
): unknown {
  return {
    testResults: Object.entries(files).map(([file, tests]) => ({
      name: `${root}${file}`,
      status: tests.some(([, , status]) => status === 'failed') ? 'failed' : 'passed',
      message: '',
      assertionResults: tests.map(([ancestorTitles, title, status]) => ({
        ancestorTitles,
        title,
        status,
        failureMessages: status === 'failed' ? ['AssertionError: planted'] : [],
      })),
    })),
  };
}

const PDF = 'tests/db/export-pdf.test.ts';
const QR = 'tests/db/verification-qr.test.ts';

describe('renderVerdict: the container step passes only when every test passed somewhere', () => {
  it('passes a run where every test passed, and lists each one', () => {
    const verdict = renderVerdict(
      [
        {
          label: 'pass 1',
          report: report({
            [PDF]: [
              [['AC1'], 'refuses an unauthenticated caller', 'passed'],
              [['AC1: a real render'], 'returns REAL PDF BYTES', 'passed'],
            ],
          }),
        },
      ],
      [PDF],
    );

    expect(verdict.refusals).toEqual([]);
    // PRESENCE (R169): the rows are what the harness prints, so an empty table
    // would be a verdict about nothing.
    expect(verdict.rows.map((row) => `${row.file} > ${row.name} : ${row.passedIn.join(',')}`)).toEqual([
      `${PDF} > AC1 > refuses an unauthenticated caller : pass 1`,
      `${PDF} > AC1: a real render > returns REAL PDF BYTES : pass 1`,
    ]);
  });

  it('REFUSES a test that skipped in every pass, naming it - the case the count could not see', () => {
    // The shape of the defect: seven handler-only tests passed, the render
    // test skipped, and "Tests  7 passed" read as healthy.
    const verdict = renderVerdict(
      [
        {
          label: 'pass 1',
          report: report({
            [PDF]: [
              [['AC1'], 'refuses an unauthenticated caller', 'passed'],
              [['AC1: a real render - SKIPPED, no server'], 'returns REAL PDF BYTES', 'skipped'],
            ],
          }),
        },
      ],
      [PDF],
    );

    expect(verdict.refusals).toEqual([
      `${PDF} > AC1: a real render - SKIPPED, no server > returns REAL PDF BYTES never passed (skipped in pass 1)`,
    ]);
  });

  it('accepts a test that skipped in one pass and passed in the other (one server state each, R332)', () => {
    const qr = (defaultState: Status, originState: Status) =>
      report({
        [QR]: [
          [['R332: with NO permanent origin'], 'prints neither', defaultState],
          [['R332/R232: with a permanent origin set'], 'the QR decodes', originState],
        ],
      });

    const verdict = renderVerdict(
      [
        { label: 'no origin', report: qr('passed', 'skipped') },
        { label: 'origin set', report: qr('skipped', 'passed') },
      ],
      [QR],
    );

    expect(verdict.refusals).toEqual([]);
    expect(verdict.rows.map((row) => row.passedIn)).toEqual([['no origin'], ['origin set']]);
  });

  it('REFUSES a test that failed in any pass, even if it passed in another', () => {
    const verdict = renderVerdict(
      [
        { label: 'pass 1', report: report({ [QR]: [[['block'], 'the QR decodes', 'failed']] }) },
        { label: 'pass 2', report: report({ [QR]: [[['block'], 'the QR decodes', 'passed']] }) },
      ],
      [QR],
    );

    expect(verdict.refusals).toEqual([`${QR} > block > the QR decodes FAILED in pass 1`]);
  });

  it('REFUSES a required file no pass collected (presence before absence, R169)', () => {
    const verdict = renderVerdict(
      [{ label: 'pass 1', report: report({ [PDF]: [[['AC1'], 'refuses', 'passed']] }) }],
      [PDF, QR],
    );

    expect(verdict.refusals).toEqual([`${QR} was not collected by any pass`]);
  });

  it('REFUSES a file that was collected with no test in it', () => {
    // A file whose import threw is reported with an empty test list - every
    // assertion about its tests is then satisfied by there being none.
    const verdict = renderVerdict(
      [{ label: 'pass 1', report: report({ [PDF]: [] }) }],
      [PDF],
    );

    expect(verdict.refusals).toEqual([`${PDF} was collected with no test in pass 1`]);
  });

  it('REFUSES a pass whose report cannot be read', () => {
    const verdict = renderVerdict([{ label: 'pass 1', report: null }], [PDF]);

    expect(verdict.refusals).toEqual([
      'pass 1 wrote no readable vitest report',
      `${PDF} was not collected by any pass`,
    ]);
  });

  it('names a file by its package path, whatever the platform wrote', () => {
    const verdict = renderVerdict(
      [
        {
          label: 'pass 1',
          report: report({ [PDF.split('/').join('\\')]: [[['AC1'], 'refuses', 'passed']] }, 'C:\\wt\\x\\web\\'),
        },
      ],
      [PDF],
    );

    expect(verdict.refusals).toEqual([]);
    expect(verdict.rows[0]?.file).toBe(PDF);
  });
});
