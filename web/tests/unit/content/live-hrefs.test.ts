// web/tests/unit/content/live-hrefs.test.ts
//
// R976 (FW-CALC-BYTES): R85 over a TABLE of links, decided where the registry
// lives. The calculator's result panel asked ctaHrefIfLive itself, inside the
// client island, which put the whole route registry in the calculator's
// first-load JS. The pages now resolve the panel's four links with liveHrefs on
// the server and hand the island the answers.
//
// Both directions against synthetic registries, as tests/unit/content/cta-gate.test.ts
// does for ctaHrefIfLive: the registry is a module constant, so a decision read
// only through it would have one reachable branch.

import { describe, expect, it } from 'vitest';
import { type PublicRoute, ctaHrefIfLive, liveHrefs } from '@/lib/content/routes';
import { RESULT_COPY } from '@/lib/fr/result';

const route = (path: string, status: PublicRoute['status']): PublicRoute => ({
  path,
  status,
  task: 'TEST',
  changeFrequency: 'monthly',
  priority: 0.5,
});

const LINKS = {
  built: { href: '/built' },
  coming: { href: '/coming' },
  unknown: { href: '/nowhere' },
} as const;

describe('liveHrefs (R85, R976)', () => {
  it('keeps a live target’s href, and withholds a planned or unregistered one', () => {
    const routes = [route('/built', 'live'), route('/coming', 'planned')];

    expect(liveHrefs(LINKS, routes)).toEqual({ built: '/built', coming: null, unknown: null });
  });

  it('flips with the registry, so it is the registry deciding and not the table', () => {
    const routes = [route('/built', 'planned'), route('/coming', 'live')];

    expect(liveHrefs(LINKS, routes)).toEqual({ built: null, coming: '/coming', unknown: null });
  });

  it('answers every key of the table, and only those', () => {
    expect(Object.keys(liveHrefs(LINKS, [])).sort()).toEqual(['built', 'coming', 'unknown']);
  });

  it('agrees with ctaHrefIfLive on the real registry, for every result-panel link', () => {
    // The panel's own table, resolved against the registry that ships. One
    // rule: whatever ctaHrefIfLive says of a link, liveHrefs says of it too.
    const resolved = liveHrefs(RESULT_COPY.links);

    for (const [status, link] of Object.entries(RESULT_COPY.links)) {
      expect(resolved[status as keyof typeof RESULT_COPY.links], status).toBe(ctaHrefIfLive(link.href));
    }
  });
});
