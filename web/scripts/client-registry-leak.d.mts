// web/scripts/client-registry-leak.d.mts
//
// Types for client-registry-leak.mjs, so its unit test (checked by the strict
// tsconfig.json, allowJs: false) can import it. Same reasoning as
// size-marker.d.mts.
//
// R185: this hand-written declaration is ASSERTED, not argued -
// tests/unit/meta/declaration-parity.test.ts walks every .d.mts beside a .mjs
// and fails if the value exports here do not match the module's.

/** The registry, relative to the package root. */
export declare const REGISTRY_SOURCE: string;

/** The shortest task string taken as a probe. */
export declare const MIN_PROBE_LENGTH: number;

/** The registry's long task strings, read from the text of its source. */
export declare function registryProbes(source: string): string[];

/** The probes a file's text carries. */
export declare function probesIn(text: string, probes: readonly string[]): string[];

/** The verdict, from what was read. */
export declare function registryVerdict(reading: {
  probes: readonly string[];
  serverHits: number;
  clientFiles: number;
  leaks: readonly { file: string; probes: readonly string[] }[];
}): { ok: boolean; lines: string[] };

/** The whole check against a build directory. */
export declare function checkRegistryInClient(
  nextDir: string,
  routesSource: string,
): { ok: boolean; lines: string[] };
