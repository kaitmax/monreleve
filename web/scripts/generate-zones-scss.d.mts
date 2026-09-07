// web/scripts/generate-zones-scss.d.mts
//
// Types for the generator, so the stale-check test can import its renderer
// under `tsc --noEmit` without allowJs or a @ts-expect-error. The test must
// compare against the SAME renderer the command uses; a second copy of the
// rendering logic in the test would be the very duplication the generated
// file exists to prevent.

export function renderZonesScss(bandTokens: Readonly<Record<string, string>>): string;
