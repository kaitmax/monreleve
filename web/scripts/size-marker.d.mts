// web/scripts/size-marker.d.mts
//
// Types for size-marker.mjs, so next.config.ts (checked by the strict
// tsconfig.json, allowJs: false) can import writeSizeMarker. Same reasoning as
// scripts/gate-selection.d.mts: scripts are checked by tsconfig.scripts.json
// with strict off, and turning allowJs on in the main project to let one
// import through would drag every build script into the strict config.
//
// R185: this hand-written declaration is ASSERTED, not argued -
// tests/unit/meta/declaration-parity.test.ts walks every .d.mts beside a .mjs
// and fails if the value exports here do not match the module's, in both
// directions. So an export added to size-marker.mjs and forgotten here is a
// failing test, not a compile error on the next importer.

/** The marker's filename, inside whatever distDir the build used. */
export declare const SIZE_MARKER_FILE: string;

/** Write the marker into a distDir root. */
export declare function writeSizeMarker(
  distDirRoot: string,
  nature: { dev: boolean; devRoutes: boolean },
): void;

/** Read the marker from a distDir root, or null if missing or unreadable. */
export declare function readSizeMarker(
  distDirRoot: string,
): { phase: string; devRoutes: boolean } | null;

/** The reason pnpm size must not measure this build, or null when it ships. */
export declare function shippingMarkerRefusal(
  marker: { phase: string; devRoutes: boolean } | null,
  distLabel: string,
): string | null;
