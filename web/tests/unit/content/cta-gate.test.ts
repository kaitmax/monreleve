// web/tests/unit/content/cta-gate.test.ts
//
// RULING R85: "the header CTA renders only when its target is live in the
// registry. A CTA to a planned route renders nothing; registry-driven,
// test-pinned. Better an absent button than a 404 behind the product's one
// call to action."
//
// WHY THIS IS A PURE FUNCTION AND NOT A CHECK INSIDE THE COMPONENT. Both
// directions have to be provable, and the registry is a module constant: with
// the decision buried in PublicShell there would be exactly one testable
// state - whichever one the repository happens to be in today, which is
// "planned". The day /application ships, nobody would find out the button
// works until they looked at the page. So the decision takes its routes as an
// argument, gets tested against synthetic lists in both directions, and
// PublicShell.test.tsx asserts the WIRING separately.
//
// The same shape as ruling R51's reviewNotice and R84's entity prop: a pure
// function, both branches reachable, no mocking.

import { describe, expect, it } from 'vitest';
import {
  PUBLIC_ROUTES,
  ctaHrefIfLive,
  isLive,
  type PublicRoute,
} from '@/lib/content/routes';
import { SHELL_COPY } from '@/lib/fr/shell';

const LIVE: PublicRoute = {
  path: '/application',
  status: 'live',
  task: 'test',
  changeFrequency: 'monthly',
  priority: 0.9,
};

const PLANNED: PublicRoute = { ...LIVE, status: 'planned' };

describe('isLive', () => {
  it('is true for a live route', () => {
    expect(isLive('/application', [LIVE])).toBe(true);
  });

  it('is false for a planned route', () => {
    expect(isLive('/application', [PLANNED])).toBe(false);
  });

  it('is false for a path nothing declares', () => {
    // Not "true by default". An href nobody registered is the case R85 exists
    // for - a typo, or a route someone linked before declaring it.
    expect(isLive('/nowhere', [LIVE])).toBe(false);
  });

  it('reads the real registry by default', () => {
    // The parameter exists for the test; the default is what the product uses,
    // and a default pointing at the wrong list would make every assertion here
    // decorative.
    expect(isLive('/mentions-legales')).toBe(true);
    expect(isLive('/application')).toBe(false);
  });
});

describe('ctaHrefIfLive', () => {
  it('returns the href when the target is live', () => {
    expect(ctaHrefIfLive('/application', [LIVE])).toBe('/application');
  });

  it('returns null when the target is only planned', () => {
    // null rather than an empty string: an empty href resolves to the CURRENT
    // page, so a button that "led nowhere" would silently reload whatever page
    // the reader was on. null is the value a component can branch on.
    expect(ctaHrefIfLive('/application', [PLANNED])).toBeNull();
  });

  it('returns null for an unregistered path', () => {
    expect(ctaHrefIfLive('/nowhere', [LIVE])).toBeNull();
  });
});

describe('the shipped state, stated so it cannot change silently', () => {
  it('has /application registered but NOT live', () => {
    // The premise of R85. If this ever fails it is because /application
    // shipped - in which case the CTA should start rendering, and the shell
    // test that asserts its absence is the one to update.
    const application = PUBLIC_ROUTES.find((route) => route.path === '/application');

    expect(application).toBeDefined();
    expect(application?.status).toBe('planned');
  });

  it('means the header CTA has no target today', () => {
    expect(ctaHrefIfLive(SHELL_COPY.ctaHref)).toBeNull();
  });

  it('still points the CTA at /application, so it flips with no code change', () => {
    // The href stays in lib/fr and stays correct; only its VISIBILITY is
    // conditional. Marking the route live is the whole change.
    expect(SHELL_COPY.ctaHref).toBe('/application');
  });
});
