// web/scripts/generate-zones-scss.d.mts
//
// Types for the generator, so the stale-check test can import its renderer
// under `tsc --noEmit` without allowJs or a @ts-expect-error. The test must
// compare against the SAME renderer the command uses; a second copy of the
// rendering logic in the test would be the very duplication the generated
// file exists to prevent.
//
// THE .d.mts EXTENSION IS REQUIRED and is not a violation of ruling R34
// ("repository scripts are .mjs"). TypeScript resolves the types for
// ./generate-zones-scss.mjs by looking for generate-zones-scss.d.mts
// specifically; renaming it would silently stop the declaration from being
// found, and the test's import would fall back to an implicit any. This is a
// declaration file, not a script - there is no .ts script in scripts/.

export function renderZonesScss(bandTokens: Readonly<Record<string, string>>): string;
