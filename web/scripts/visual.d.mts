// web/scripts/visual.d.mts
//
// Types for visual.mjs's pure half, so its unit tests (checked by the strict
// tsconfig.json, allowJs: false) can import it. Same reasoning as
// scripts/gate-selection.d.mts.
//
// R185: ASSERTED, not argued - tests/unit/meta/declaration-parity.test.ts
// walks every .d.mts beside a .mjs and fails if the value exports here do not
// match the module's, in both directions. It imports visual.mjs to read them,
// which starts nothing: the run is main(), and only `node scripts/visual.mjs`
// calls it.

/** What a person typed after `node scripts/visual.mjs`, read (R960). */
export type VisualArguments =
  | { ok: true; update: boolean; filter: string[] }
  | { ok: false; why: string };

/** Read the arguments: --update, `--` separators, and a filter - or why not (R960). */
export declare function visualArguments(argv: readonly string[]): VisualArguments;

/** The one shell script the container runs; Playwright's arguments arrive as "$@" (R960). */
export declare const CONTAINER_SCRIPT: string;

/** Everything one container run is made of. */
export interface DockerRun {
  repo: string;
  volume: string;
  distDir: string;
  image: string;
  update: boolean;
  filter: readonly string[];
}

/** The docker argv for one run: the filter after the script, never inside it (R960, R961). */
export declare function dockerRunArguments(run: DockerRun): string[];

/** The node_modules cache for one lockfile (R961). */
export interface NodeModulesCache {
  /** monreleve-visual-node-modules-<first 16 hex of the lockfile's sha256>. */
  volume: string;
  /** The full sha256 of the lockfile's content, line endings normalised. */
  lockfileSha256: string;
  /** Every label the volume is created with, the product among them. */
  labels: Readonly<Record<string, string>>;
}

/** Name and label the cache from the lockfile's text (R961). */
export declare function nodeModulesCache(lockfile: string, image: string): NodeModulesCache;

/** `docker volume create` with every label, by exact name (R961). */
export declare function volumeCreateArguments(cache: NodeModulesCache): string[];

/** What to do with an existing volume of that name (R961). */
export type VolumeVerdict = { action: 'create' } | { action: 'reuse' } | { action: 'refuse'; why: string };

/** Reuse only our own volume for this lockfile and image; create one that is absent; refuse any other. */
export declare function volumeVerdict(
  existing: Readonly<Record<string, string>> | null,
  cache: NodeModulesCache,
): VolumeVerdict;

/** One baseline the runner says it wrote (R208, R1020). */
export interface BaselineWritten {
  /** Package-relative, e.g. tests/visual/baselines/home-desktop.png. */
  file: string;
  /** A snapshot that did not exist, or one that changed. */
  kind: 'new' | 're-generated';
}

/** Every baseline Playwright says it wrote, once each, sorted by file (R208, R1020). */
export declare function baselinesWritten(printed: string): BaselineWritten[];

/** What a regeneration says about itself, and its exit code (R135, R208, R1020). */
export interface RegenerationReport {
  exitCode: 0 | 1;
  stream: 'stdout' | 'stderr';
  lines: string[];
}

/** Judge a regeneration from what the runner printed, git's view as a cross-check. */
export declare function regenerationReport(run: {
  printed: string;
  runFailed: boolean;
  differs: readonly string[];
}): RegenerationReport;
