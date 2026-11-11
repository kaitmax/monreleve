// web/lib/deploy/placeholders.d.mts
//
// Types for placeholders.mjs, which is JavaScript because a plain `node`
// entrypoint reads it before any compilation step exists (R250).
//
// R185: THIS IS ASSERTED, NOT ARGUED. A hand-written declaration is a second
// description of one module and can disagree with it, and the argument that
// the disagreement is harmless covers a declaration that is WRONG rather than
// one that is INCOMPLETE - an omitted export is a compile error on correct
// code, landing on whoever adds the NEXT export.
// tests/unit/meta/declaration-parity.test.ts compares the names below against
// the module's real exports, in both directions.

/** How a variable fails when it is not supplied correctly. */
export type EnvSeverity = 'required' | 'degradable';

/** One variable's verdict. `placeholder` is named apart from `absent` (R198). */
export type EnvVerdict = 'ok' | 'absent' | 'placeholder';

/** One variable a deployment supplies. */
export interface DeploymentVariable {
  readonly name: string;
  readonly severity: EnvSeverity;
  /** The published example value, or null where there is none to compare. */
  readonly placeholder: string | null;
  /**
   * Its disclosure is a credential leak (R858). The one home of which
   * variables are secrets: test:container refuses an image whose history
   * names any of them.
   */
  readonly secret: boolean;
  readonly what: string;
}

/** One variable, classified. */
export interface EnvResult {
  readonly name: string;
  readonly severity: EnvSeverity;
  readonly what: string;
  readonly verdict: EnvVerdict;
}

/** Every variable classified, and whether this environment may serve. */
export interface EnvReport {
  readonly results: readonly EnvResult[];
  /** Placeholders at any severity, plus absent `required` ones. */
  readonly refusals: readonly EnvResult[];
  /** Absent `degradable` ones: the container starts and /api/ready reports. */
  readonly degraded: readonly EnvResult[];
  readonly mayServe: boolean;
}

export declare const PLACEHOLDER_SECRET: string;
export declare const PLACEHOLDER_PROJECT_ID: string;
export declare const PLACEHOLDER_CLIENT_EMAIL: string;
export declare const PLACEHOLDER_PRIVATE_KEY: string;

export declare const DEPLOYMENT_VARIABLES: readonly DeploymentVariable[];

export declare function classifyVariable(
  variable: DeploymentVariable,
  raw: string | undefined | null,
): EnvVerdict;

export declare function classifyEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): EnvReport;

/** Does the origin this image was BUILT for match the one it is RUN with? */
export declare function classifyOrigin(
  baked: string | null | undefined,
  runtime: string | undefined,
): 'ok' | 'mismatch' | 'unbuilt' | 'unknown';

export declare function describeEnvironment(report: EnvReport): string;
