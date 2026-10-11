// web/scripts/size-marker.mjs
//
// RULING R326: pnpm size measures ONLY the build that ships.
//
// THE DEFECT IT CLOSES. check-budgets.mjs reads `.next` and reports GATE A/B.
// Nothing told it WHAT KIND of build `.next` held, so it would measure, with
// equal confidence:
//   - a `next dev` build (not a production build at all), and
//   - a production build with the dev routes compiled in
//     (FRONTALIER_DEV_ROUTES=1), which R129 records costs the calculator
//     ~1.6 KiB of chunk regrouping that never ships.
// FW33's reported "+1.9 KiB" was the second kind: `pnpm size` ran in the
// working tree after test:e2e had left a dev-routes `.next` behind, and the
// real cost was +0.4 (REPORT-FW33b). The number went into a session report.
//
// THE MECHANISM. next.config.ts writes a marker into the distDir on every
// build AND every `next dev` (webpack's `done` hook fires in both, and this
// project's dev is plain `next dev` on webpack, not Turbopack). The marker
// states the phase and whether the dev routes were compiled in. check-budgets,
// measuring the SHIPPING build, refuses anything the marker does not vouch for
// - BY NAME, so the refusal is a diagnosis rather than a mystery.
//
// ONE HOME (R206). The filename, the writer and the reader live here; both
// next.config.ts (writer) and check-budgets.mjs (reader) import from this one
// module, so the shape cannot drift between the thing that writes it and the
// thing that trusts it.

import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The marker's filename, inside whatever distDir the build used. */
export const SIZE_MARKER_FILE = 'frontalier-size-marker.json';

/**
 * Write the marker into a distDir root.
 *
 * @param {string} distDirRoot absolute path to the build's distDir (.next, or
 *   whatever NEXT_DIST_DIR set it to).
 * @param {{ dev: boolean, devRoutes: boolean }} nature
 *   dev: a `next dev` build rather than a production build.
 *   devRoutes: FRONTALIER_DEV_ROUTES was set, so /dev/** is in the graph.
 */
export function writeSizeMarker(distDirRoot, nature) {
  const marker = {
    // A STRING, not the booleans alone, so a human reading the file sees what
    // it is, and so a future third kind of build is a new value rather than a
    // new column nobody migrates.
    phase: nature.dev ? 'dev' : 'build',
    devRoutes: nature.devRoutes === true,
    writtenAt: new Date().toISOString(),
  };

  writeFileSync(join(distDirRoot, SIZE_MARKER_FILE), `${JSON.stringify(marker, null, 2)}\n`);
}

/**
 * Read the marker from a distDir root, or null if it is missing or unreadable.
 *
 * @param {string} distDirRoot absolute path to the distDir being measured.
 * @returns {{ phase: string, devRoutes: boolean } | null}
 */
export function readSizeMarker(distDirRoot) {
  try {
    const raw = readFileSync(join(distDirRoot, SIZE_MARKER_FILE), 'utf8');
    const parsed = JSON.parse(raw);

    return { phase: String(parsed.phase), devRoutes: parsed.devRoutes === true };
  } catch {
    return null;
  }
}

/**
 * The reason pnpm size must NOT measure this build, or null when it is the
 * shipping build. Pure, so it is tested without a build (R154: proven to
 * deliver, both directions).
 *
 * @param {{ phase: string, devRoutes: boolean } | null} marker
 * @param {string} distLabel the directory name, for the message.
 * @returns {string | null}
 */
export function shippingMarkerRefusal(marker, distLabel) {
  if (marker === null) {
    return (
      `pnpm size found no shipping marker in ${distLabel}/ (ruling R326). ` +
      `Run \`pnpm build\` to produce the build that ships, then \`pnpm size\`. ` +
      `A missing marker means ${distLabel}/ was not produced by a build that ` +
      `records what it is - a stale or hand-assembled directory, not the ` +
      `shipping build.`
    );
  }

  if (marker.phase === 'dev') {
    return (
      `pnpm size measured a \`next dev\` build in ${distLabel}/, not the ` +
      `build that ships (ruling R326). The dev server's bundle is not the ` +
      `production one. Run \`pnpm build\`, then \`pnpm size\`.`
    );
  }

  if (marker.devRoutes === true) {
    return (
      `pnpm size measured a production build with the dev routes compiled in ` +
      `(FRONTALIER_DEV_ROUTES=1) in ${distLabel}/, not the build that ships ` +
      `(ruling R326). /dev/** regroups the chunks every route loads (R129), so ` +
      `these numbers are ~1.6 KiB high on the calculator and are not what ` +
      `ships - this is the FW33 "+1.9 KiB" defect. Run a plain \`pnpm build\` ` +
      `(without the flag), then \`pnpm size\`.`
    );
  }

  return null;
}
