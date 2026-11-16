// web/scripts/container-render-verdict.mjs
//
// ============================================================================
// FW-PDF-RENDER-GATE (R981): THE CONTAINER STEP'S VERDICT, PER TEST
// ============================================================================
//
// scripts/container-e2e.mjs used to read one number from its vitest step and
// refuse only when it was zero. That held while the step ran container-auth
// and container-pdf, whose every test needs the container. It does not hold
// once export-pdf.test.ts runs there: seven of its tests are handler-only and
// pass with no server at all, so its fifteen render tests could skip and the
// count would still read healthy. A skip exits 0 and reads like a pass (R133).
//
// So the verdict is per test, from vitest's JSON report of each pass:
//   - every file the step runs was collected, with at least one test;
//   - every test passed in AT LEAST ONE pass;
//   - no test failed in ANY pass.
//
// PASSES ARE PLURAL BECAUSE A SERVER HOLDS ONE STATE. verification-qr.test.ts
// asserts both sides of MONRELEVE_VERIFICATION_ORIGIN (R332), and each side
// needs a server started with that setting. Each of its two tests skips in the
// pass that cannot exercise it and must pass in the one that can.
//
// IT IS A PURE FUNCTION so its refusals are proven in `pnpm test` without a
// Docker build (tests/unit/meta/container-render-verdict.test.ts).

/** A file's path from the package root, whatever separator the platform wrote. */
function packagePath(name) {
  const normalised = String(name).replace(/[\\]/gu, '/');
  const found = /(?:^|\/)(tests\/.+)$/u.exec(normalised);

  return found === null ? normalised : found[1];
}

/**
 * The verdict on a container step's vitest passes.
 *
 * @param {ReadonlyArray<{ label: string, report: unknown }>} passes
 *   each pass's label and its parsed `--reporter=json` output
 * @param {ReadonlyArray<string>} requiredFiles
 *   package paths (tests/db/...) every one of which must have been collected
 * @returns {{ refusals: string[], rows: Array<{ file: string, name: string, passedIn: string[], statuses: string[] }> }}
 */
export function renderVerdict(passes, requiredFiles) {
  const refusals = [];
  /** @type {Map<string, { file: string, name: string, passedIn: string[], statuses: string[] }>} */
  const rows = new Map();
  const collected = new Set();

  for (const { label, report } of passes) {
    /** @type {any} */
    const parsed = report;
    const results =
      typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.testResults)
        ? parsed.testResults
        : null;

    if (results === null) {
      refusals.push(`${label} wrote no readable vitest report`);
      continue;
    }

    for (const result of results) {
      const file = packagePath(result.name);
      const tests = Array.isArray(result.assertionResults) ? result.assertionResults : [];

      collected.add(file);

      if (tests.length === 0) {
        refusals.push(`${file} was collected with no test in ${label}`);
        continue;
      }

      for (const test of tests) {
        const name = [...(test.ancestorTitles ?? []), test.title].join(' > ');
        const key = `${file} > ${name}`;
        const row = rows.get(key) ?? { file, name, passedIn: [], statuses: [] };

        row.statuses.push(`${test.status} in ${label}`);
        if (test.status === 'passed') row.passedIn.push(label);
        if (test.status === 'failed') refusals.push(`${key} FAILED in ${label}`);

        rows.set(key, row);
      }
    }
  }

  for (const file of requiredFiles) {
    if (!collected.has(file)) refusals.push(`${file} was not collected by any pass`);
  }

  for (const [key, row] of rows) {
    const failed = row.statuses.some((status) => status.startsWith('failed '));

    if (row.passedIn.length === 0 && !failed) {
      refusals.push(`${key} never passed (${row.statuses.join(', ')})`);
    }
  }

  return { refusals, rows: [...rows.values()] };
}
