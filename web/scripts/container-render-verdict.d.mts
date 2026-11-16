// web/scripts/container-render-verdict.d.mts
//
// Types for container-render-verdict.mjs, so its unit test (checked by the
// strict tsconfig.json, allowJs: false) can import renderVerdict. Same
// reasoning as scripts/gate-selection.d.mts.
//
// R185: ASSERTED, not argued - tests/unit/meta/declaration-parity.test.ts
// walks every .d.mts beside a .mjs and fails if the value exports here do not
// match the module's, in both directions.

/** One row per test: where it passed, and its status in every pass. */
export interface RenderVerdictRow {
  file: string;
  name: string;
  passedIn: string[];
  statuses: string[];
}

/**
 * The verdict on a container step's vitest passes: every required file
 * collected, every test passed in at least one pass, none failed in any.
 */
export declare function renderVerdict(
  passes: ReadonlyArray<{ label: string; report: unknown }>,
  requiredFiles: ReadonlyArray<string>,
): { refusals: string[]; rows: RenderVerdictRow[] };
