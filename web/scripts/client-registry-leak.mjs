// web/scripts/client-registry-leak.mjs
//
// RULING R976 (FW-CALC-BYTES): THE ROUTE REGISTRY NEVER REACHES THE BROWSER.
//
// lib/content/routes.ts is every public URL with its status, gate, task and
// sitemap weight, and R85's liveness is decided against all of it. Until this
// ruling three client modules imported it - the public shell, the calculator's
// form and its result panel - so the whole registry shipped in a chunk every
// public page loads, and ANY new route entry cost bytes on the calculator, the
// page with the least GATE A headroom (QUEUE-STATE BLOCKED 11). Liveness is now
// resolved on the server and handed to client code as plain data; a client
// module that needs a path takes it from lib/content/route-paths.ts, a leaf.
//
// WHY A CHUNK SCAN AND NOT A MARKER. Next's 'server-only' import would refuse a
// client import at build time, but it is a package this project does not
// depend on, and adding one is Ask-first (SPEC 20). R976's other shape is this:
// read every client chunk of the build `pnpm size` measures, and fail if one
// carries a string only the registry holds.
//
// THE PROBES ARE THE REGISTRY'S OWN DATA, READ FROM ITS SOURCE (R181): the
// `task` strings of 12 characters or more. No other module holds them, and the
// registry is one array literal, so if any of it ships, all of them do. A list
// typed here would be a second copy of the registry that goes stale.
//
// PRESENCE BEFORE ABSENCE (R154, R169). "No client chunk carries a probe" is
// satisfied perfectly by a probe the compiler rewrote, or by a build with no
// chunks at all. So the check also requires the probes to appear in the
// SERVER output - where the registry legitimately lives - and at least one
// client chunk to have been read, and refuses to vouch for anything otherwise.

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The registry, relative to the package root. */
export const REGISTRY_SOURCE = 'lib/content/routes.ts';

/**
 * The shortest task string taken as a probe.
 *
 * Short tasks ("FW10", "FW17") are real registry values, but a string that
 * short could occur in a client chunk for another reason, and a guard that
 * cries wolf is a guard people route around. Three of today's tasks are
 * longer, and the registry ships whole, so one long probe is enough to see it.
 */
export const MIN_PROBE_LENGTH = 12;

/**
 * The registry's long task strings, read from the text of its source.
 *
 * @param {string} source the text of lib/content/routes.ts
 * @returns {string[]}
 */
export function registryProbes(source) {
  const probes = [];

  for (const match of source.matchAll(/\btask:\s*(['"])((?:(?!\1)[^\n\\])+)\1/g)) {
    const value = match[2];

    if (value.length >= MIN_PROBE_LENGTH && !probes.includes(value)) probes.push(value);
  }

  return probes;
}

/**
 * The probes a file's text carries.
 *
 * @param {string} text
 * @param {readonly string[]} probes
 * @returns {string[]}
 */
export function probesIn(text, probes) {
  return probes.filter((probe) => text.includes(probe));
}

/**
 * The verdict, from what was read. Pure, so both directions are provable
 * without a build.
 *
 * @param {{ probes: readonly string[], serverHits: number, clientFiles: number,
 *           leaks: readonly { file: string, probes: readonly string[] }[] }} reading
 * @returns {{ ok: boolean, lines: string[] }}
 */
export function registryVerdict({ probes, serverHits, clientFiles, leaks }) {
  if (probes.length === 0) {
    return {
      ok: false,
      lines: [
        `R976 REFUSED: no probe could be read from ${REGISTRY_SOURCE} (task strings of ` +
          `${MIN_PROBE_LENGTH}+ characters), so the registry check would prove nothing.`,
      ],
    };
  }

  if (serverHits === 0) {
    return {
      ok: false,
      lines: [
        `R976 REFUSED: no server file carries any of the ${probes.length} registry probe(s), ` +
          'so their absence from the client chunks would prove nothing (R169: presence first).',
      ],
    };
  }

  if (clientFiles === 0) {
    return { ok: false, lines: ['R976 REFUSED: no client chunk was found to read.'] };
  }

  if (leaks.length > 0) {
    return {
      ok: false,
      lines: [
        ...leaks.map((leak) => `R976 REGISTRY IN CLIENT CHUNK  ${leak.file}: ${leak.probes.join(' | ')}`),
        `R976 BREACH: the route registry (${REGISTRY_SOURCE}) ships to the browser in ` +
          `${leaks.length} client chunk(s). Resolve it on the server and pass plain data; a ` +
          'client module takes a path from lib/content/route-paths.ts.',
      ],
    };
  }

  return {
    ok: true,
    lines: [
      `R976 registry check: ${probes.length} probe(s) from ${REGISTRY_SOURCE}, seen in ` +
        `${serverHits} server file(s), absent from all ${clientFiles} client chunk(s).`,
    ],
  };
}

/** Every .js file under a directory, as paths relative to `root` with forward slashes. */
function jsFiles(root, dir) {
  let entries;

  try {
    entries = readdirSync(join(root, dir), { withFileTypes: true });
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const path = `${dir}/${entry.name}`;

    if (entry.isDirectory()) return jsFiles(root, path);

    return entry.name.endsWith('.js') ? [relative(root, join(root, path)).split('\\').join('/')] : [];
  });
}

/**
 * The whole check against a build directory: `server/` is where the registry
 * belongs, `static/` is everything a browser can be sent.
 *
 * @param {string} nextDir a .next directory (or any directory of that shape)
 * @param {string} routesSource the text of lib/content/routes.ts
 * @returns {{ ok: boolean, lines: string[] }}
 */
export function checkRegistryInClient(nextDir, routesSource) {
  const probes = registryProbes(routesSource);
  const read = (file) => readFileSync(join(nextDir, file), 'utf8');

  const serverHits = probes.length === 0
    ? 0
    : jsFiles(nextDir, 'server').filter((file) => probesIn(read(file), probes).length > 0).length;
  const client = jsFiles(nextDir, 'static');
  const leaks = client
    .map((file) => ({ file, probes: probesIn(read(file), probes) }))
    .filter((leak) => leak.probes.length > 0);

  return registryVerdict({ probes, serverHits, clientFiles: client.length, leaks });
}
