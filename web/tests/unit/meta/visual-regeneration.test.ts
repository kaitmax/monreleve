// web/tests/unit/meta/visual-regeneration.test.ts
//
// R1020 (Web Ruling 17): A REGENERATION COUNTS THE BASELINES IT CREATED AS
// WELL AS THE ONES IT CHANGED.
//
// THE DEFECT, W11's DEFECT 1 (REPORT-FW-DELAI-RAPPEL.txt). Under Playwright
// 1.63 a regeneration prints one of two lines for each snapshot it writes -
// both read in its own source, lib/matchers/expect.js:
//
//   A snapshot doesn't exist at <path>, writing actual.    a NEW baseline
//   <path> is re-generated, writing actual.                a CHANGED one
//
// visual.mjs recognised only the second: its pattern for a new file expected
// the path FIRST, a wording 1.63 does not print. So W11's second regeneration
// printed a list missing its four new files, and its third - new files only -
// exited 1 with "R208: REGENERATION WROTE NOTHING" although both files were
// written and matched the named set. R207's named-set check reads that list,
// so a list short of the new files is a check a correct run cannot pass.
//
// THE INPUT IS WHAT PLAYWRIGHT PRINTED, copied verbatim from W11's captured
// logs - h3-regen.log lines 507 and 524, h2-regen.log lines 420-449, progress
// lines and all - so the counter is proven against the real output and not
// against lines this file invented (R154: a known input gives the known
// list). And the refusal R208 exists for is asserted to still fire.

import { describe, expect, it } from 'vitest';
import { baselinesWritten, regenerationReport } from '../../../scripts/visual.mjs';

/** h3-regen.log lines 507 and 524: a regeneration that wrote two NEW files and nothing else. */
const H3_REGEN_507_524 = [
  "A snapshot doesn't exist at /repo/web/tests/visual/baselines/page-rappel-suppression-desktop.png, writing actual.",
  "A snapshot doesn't exist at /repo/web/tests/visual/baselines/page-rappel-suppression-mobile.png, writing actual.",
];

/** h2-regen.log lines 420-449: four NEW and two RE-GENERATED, between the progress lines. */
const H2_REGEN_420_449 = [
  "A snapshot doesn't exist at /repo/web/tests/visual/baselines/comparateur-delai-rappel-envoye-desktop.png, writing actual.",
  '  ✓   49 [visual] › e2e/comparateur.visual.spec.ts:314:7 › desktop › delai-rappel-envoye (2.7s)',
  '  ✓   51 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › vide (1.3s)',
  "A snapshot doesn't exist at /repo/web/tests/visual/baselines/comparateur-rappel-confirme-desktop.png, writing actual.",
  '  ✓   50 [visual] › e2e/comparateur.visual.spec.ts:314:7 › desktop › rappel-confirme (2.3s)',
  '  ✓   53 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › inferieur (1.5s)',
  '  ✓   52 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › rempli (1.7s)',
  '  ✓   54 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › superieur (1.7s)',
  '  ✓   55 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › adulte-seul (1.6s)',
  '  ✓   56 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › plancher (1.7s)',
  '/repo/web/tests/visual/baselines/comparateur-delai-sans-s3-desktop.png is re-generated, writing actual.',
  '  ✓   57 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › erreur (1.3s)',
  '  ✓   48 [visual] › e2e/comparateur.visual.spec.ts:314:7 › desktop › delai-sans-s3 (7.5s)',
  '  ✓   58 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › commune (1.6s)',
  '  ✓   59 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › annee-partielle (1.7s)',
  '  ✓   60 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › points-inferieur (1.6s)',
  '  ✓   61 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › points-entre (1.7s)',
  '  ✓   62 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › points-superieur (1.7s)',
  '  ✓   63 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › soins (2.1s)',
  '  ✓   64 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › franc-deplace (1.8s)',
  "A snapshot doesn't exist at /repo/web/tests/visual/baselines/comparateur-delai-rappel-envoye-mobile.png, writing actual.",
  '  ✓   66 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › delai-rappel-envoye (1.5s)',
  '  ✓   68 [visual] › e2e/composants.visual.spec.ts:91:3 › rail-unavailable (656ms)',
  "A snapshot doesn't exist at /repo/web/tests/visual/baselines/comparateur-rappel-confirme-mobile.png, writing actual.",
  '  ✓   67 [visual] › e2e/comparateur.visual.spec.ts:314:7 › mobile › rappel-confirme (1.7s)',
  '  ✓   69 [visual] › e2e/composants.visual.spec.ts:91:3 › badge-mission (782ms)',
  '  ✓   70 [visual] › e2e/composants.visual.spec.ts:91:3 › badge-compliant (795ms)',
  '  ✓   71 [visual] › e2e/composants.visual.spec.ts:91:3 › badge-social (794ms)',
  '  ✓   72 [visual] › e2e/composants.visual.spec.ts:91:3 › badge-regime (797ms)',
  '/repo/web/tests/visual/baselines/comparateur-delai-sans-s3-mobile.png is re-generated, writing actual.',
];

/** As the container's log holds them: one line each. */
const logOf = (lines: readonly string[]): string => lines.join(String.fromCharCode(10));

/** The file lines of a report, read as [kind, file] whatever the padding between them. */
function listed(lines: readonly string[]): readonly (readonly string[])[] {
  return lines
    .map((line) => line.trim().split(/\s+/u))
    .filter((parts) => parts.length === 2 && (parts[1] ?? '').endsWith('.png'));
}

const BASELINES = 'tests/visual/baselines';

describe('R1020: the counter reads both lines Playwright 1.63 prints', () => {
  it('reads a run that wrote only NEW baselines - the run that said WROTE NOTHING', () => {
    expect(baselinesWritten(logOf(H3_REGEN_507_524))).toEqual([
      { file: `${BASELINES}/page-rappel-suppression-desktop.png`, kind: 'new' },
      { file: `${BASELINES}/page-rappel-suppression-mobile.png`, kind: 'new' },
    ]);
  });

  it('reads a mixed run: four new and two re-generated, each with its kind', () => {
    expect(baselinesWritten(logOf(H2_REGEN_420_449))).toEqual([
      { file: `${BASELINES}/comparateur-delai-rappel-envoye-desktop.png`, kind: 'new' },
      { file: `${BASELINES}/comparateur-delai-rappel-envoye-mobile.png`, kind: 'new' },
      { file: `${BASELINES}/comparateur-delai-sans-s3-desktop.png`, kind: 're-generated' },
      { file: `${BASELINES}/comparateur-delai-sans-s3-mobile.png`, kind: 're-generated' },
      { file: `${BASELINES}/comparateur-rappel-confirme-desktop.png`, kind: 'new' },
      { file: `${BASELINES}/comparateur-rappel-confirme-mobile.png`, kind: 'new' },
    ]);
  });

  it('names a file once, however many times its line was printed', () => {
    const twice = [...H3_REGEN_507_524, ...H3_REGEN_507_524];

    expect(baselinesWritten(logOf(twice))).toHaveLength(2);
  });
});

describe('R1020: the report names every file written and says which is which', () => {
  it('reports the new-only run as written, not as WROTE NOTHING', () => {
    const report = regenerationReport({
      printed: logOf(H3_REGEN_507_524),
      runFailed: false,
      differs: [
        `?? web/${BASELINES}/page-rappel-suppression-desktop.png`,
        `?? web/${BASELINES}/page-rappel-suppression-mobile.png`,
      ],
    });

    expect(report.exitCode).toBe(0);
    expect(report.stream).toBe('stdout');
    expect(report.lines.join(' ')).not.toContain('WROTE NOTHING');
    expect(report.lines.join(' ')).toContain('2 baseline(s) written BY THIS RUN (2 new, 0 re-generated)');
    expect(listed(report.lines)).toEqual([
      ['new', `${BASELINES}/page-rappel-suppression-desktop.png`],
      ['new', `${BASELINES}/page-rappel-suppression-mobile.png`],
    ]);
  });

  it('reports the mixed run with every file and its kind', () => {
    const report = regenerationReport({
      printed: logOf(H2_REGEN_420_449),
      runFailed: false,
      differs: ['1', '2', '3', '4', '5', '6'],
    });

    expect(report.exitCode).toBe(0);
    expect(report.lines.join(' ')).toContain('6 baseline(s) written BY THIS RUN (4 new, 2 re-generated)');
    expect(listed(report.lines)).toEqual([
      ['new', `${BASELINES}/comparateur-delai-rappel-envoye-desktop.png`],
      ['new', `${BASELINES}/comparateur-delai-rappel-envoye-mobile.png`],
      ['re-generated', `${BASELINES}/comparateur-delai-sans-s3-desktop.png`],
      ['re-generated', `${BASELINES}/comparateur-delai-sans-s3-mobile.png`],
      ['new', `${BASELINES}/comparateur-rappel-confirme-desktop.png`],
      ['new', `${BASELINES}/comparateur-rappel-confirme-mobile.png`],
    ]);
  });

  it('still refuses, R208, when no line of either kind appears', () => {
    // The same real log with its six writing lines taken out: a run that
    // reached the comparisons and wrote nothing. PRESENCE FIRST - it is a real
    // log of 24 lines, not an empty string that any parser reads as nothing.
    const progressOnly = H2_REGEN_420_449.filter((line) => !line.includes('writing actual'));

    expect(progressOnly).toHaveLength(24);

    const report = regenerationReport({ printed: logOf(progressOnly), runFailed: false, differs: [] });

    expect(report.exitCode).toBe(1);
    expect(report.stream).toBe('stderr');
    expect(report.lines).toContain('R208: REGENERATION WROTE NOTHING.');
    expect(listed(report.lines)).toEqual([]);
  });

  it('claims nothing when the run failed, whatever its log holds', () => {
    const report = regenerationReport({ printed: logOf(H2_REGEN_420_449), runFailed: true, differs: [] });

    expect(report.exitCode).toBe(1);
    expect(report.stream).toBe('stderr');
    expect(report.lines).toContain('R208: THE RUN FAILED, so no regeneration is claimed.');
    expect(listed(report.lines)).toEqual([]);
  });
});
