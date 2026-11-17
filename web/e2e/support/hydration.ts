// web/e2e/support/hydration.ts
//
// FW-PREHYDRATION-SITES, R1056: W18's plant (R1041), parameterised so every
// island can be typed into before it hydrates. e2e/rappel-delai.spec.ts holds
// the original, fixed to the comparator's date field; this is the same
// mechanism with the page and the field to watch passed in.
//
// WHAT IT DOES. Every script the page asks for under /_next/static/ is held at
// the network until the typing is done, so the typing lands on the server's
// HTML by construction - no listener, no state, only the field. Stylesheets
// and fonts are not held, so the page stays the real, styled one.
//
// VERIFIED BEFORE ITS RESULT IS READ (R180), in every call:
//   1. at least one script request is waiting;
//   2. the watched field carries no React fiber BEFORE the typing, and STILL
//      none AFTER it - so the value landed on the server's HTML;
//   3. once released, React's hydration claims the field (its fiber appears),
//      so a failure after this is the island's, not a page the plant broke.

import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Every script the page asks for under /_next/static/: the framework's and the
 * island's own chunk alike. Anything narrower would be a guess about the chunk
 * graph.
 */
const SCRIPTS = /\/_next\/static\/.+\.js(?:\?|$)/u;

/**
 * True once React's hydration has claimed the node: it sets its fiber on every
 * node it hydrates, under a `__reactFiber$` key. React sets it in its render
 * phase, so the commit can trail it by a moment; web-first assertions after it
 * retry over that gap. Were React to rename the key, the wait on it would time
 * out: a loud failure, never a silent pass.
 */
export async function hydrated(field: Locator): Promise<boolean> {
  return field.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactFiber$')));
}

/**
 * Opens `path` with its scripts held, runs `type` against the server's HTML,
 * then releases the scripts and waits until React's hydration has claimed
 * `field`. Returns what waited, and for how long - the plant's evidence, for
 * the run's output.
 */
export async function typeBeforeHydration(
  page: Page,
  path: string,
  field: Locator,
  type: () => Promise<void>,
): Promise<string> {
  const requested: { readonly path: string; readonly at: number }[] = [];
  let release = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route(SCRIPTS, async (route) => {
    requested.push({ path: new URL(route.request().url()).pathname, at: Date.now() });
    await released;
    await route.continue();
  });

  let held: readonly { readonly path: string; readonly ms: number }[] = [];

  try {
    // Not 'load': the load event waits for the very scripts held here.
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => requested.length).toBeGreaterThan(0);
    expect(await hydrated(field)).toBe(false);

    await type();

    expect(await hydrated(field)).toBe(false);
  } finally {
    const at = Date.now();

    held = requested.map((request) => ({ path: request.path, ms: at - request.at }));
    release();
  }

  await expect.poll(() => hydrated(field), { timeout: 20_000 }).toBe(true);

  const ms = held.map((request) => request.ms);

  return `held ${String(held.length)} script(s) for ${String(Math.min(...ms))}-${String(Math.max(...ms))} ms: ${held.map((request) => request.path).join(', ')}`;
}
