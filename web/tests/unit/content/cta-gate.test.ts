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
  ctaHrefIfOffered,
  isLive,
  type PublicRoute,
} from '@/lib/content/routes';
import { PRODUCT_STATE } from '@/lib/content/product-state';
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
    // FW20b: /application is live now, so the default-registry check needed a
    // route that was still planned - /calculateur-lamal-cmu, the last one.
    // FW-COMPARATEUR built it, so NO route is planned any more and the check
    // turns round: a route the REAL registry has live and the one-route
    // fixture does not. Only the default list can answer true.
    expect(isLive('/calculateur-lamal-cmu')).toBe(true);
    expect(isLive('/calculateur-lamal-cmu', [LIVE])).toBe(false);
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

describe('ctaHrefIfOffered: both the target and the offer (R85 + R186)', () => {
  // BOTH STATES OF THE OFFER, which is the half ctaHrefIfLive cannot carry.
  // The header CTA promises day-tracking, so beyond "does the page exist" it
  // asks "can the reader actually do the thing" - the `offered` argument the
  // shell fills from PRODUCT_STATE.trackerExists.
  it('returns the href when the target is live AND the capability is offered', () => {
    expect(ctaHrefIfOffered('/application', true, [LIVE])).toBe('/application');
  });

  it('returns null when the target is live but the capability is NOT offered', () => {
    // THE R186 CASE: the page exists, the thing it promises does not. A button
    // that resolves to a real page but offers a capability the product lacks
    // is a promise, which is worse than a broken link because nothing 404s.
    expect(ctaHrefIfOffered('/application', false, [LIVE])).toBeNull();
  });

  it('returns null when offered but the target is only planned', () => {
    expect(ctaHrefIfOffered('/application', true, [PLANNED])).toBeNull();
  });

  it('returns null when neither holds', () => {
    expect(ctaHrefIfOffered('/application', false, [PLANNED])).toBeNull();
  });
});

describe('the shipped state, stated so it cannot change silently', () => {
  it('has /application live, and the CTA still hidden - for a different reason', () => {
    // THIS BLOCK SAID THE OPPOSITE UNTIL FW20b, and how it changed is the
    // part worth keeping.
    //
    // It read: "has /application registered but NOT live ... if this ever
    // fails it is because /application shipped, IN WHICH CASE THE CTA SHOULD
    // START RENDERING, and the shell test that asserts its absence is the one
    // to update." The page shipped, this went red, and that instruction was
    // wrong - following it would have put a button reading "Suivre mes jours"
    // on every public page of a product that cannot track a day.
    //
    // R85 asks whether the TARGET EXISTS. That was the only question while a
    // planned route meant both "no page" and "no feature". /application
    // separates them: the page is real and the application is not, so the
    // shell asks PRODUCT_STATE.appExists as well - the same distinction
    // /releve-annuel has drawn since FW20.
    const application = PUBLIC_ROUTES.find((route) => route.path === '/application');

    expect(application).toBeDefined();
    expect(application?.status).toBe('live');
  });

  it('means the header CTA has a target, and still renders nothing', () => {
    // BOTH HALVES, because either alone is now misleading. R85 is satisfied -
    // the href resolves - and the button is absent anyway.
    //
    // THE GATE IS trackerExists (R186), not appExists. The button promises
    // tracking, so it waits for a released app a person can record days with.
    // When this flag flips the shell renders the CTA and this test is the one
    // to update - which is why the flag, not a hardcoded false, is asserted.
    expect(ctaHrefIfLive(SHELL_COPY.ctaHref)).toBe('/application');
    expect(
      PRODUCT_STATE.trackerExists,
      'the tracker now exists - the shell should render its CTA and this test is the one to update',
    ).toBe(false);
  });

  it('still points the CTA at /application, so it flips with no code change', () => {
    // The href stays in lib/fr and stays correct; only its VISIBILITY is
    // conditional. Flipping appExists is now the whole change.
    expect(SHELL_COPY.ctaHref).toBe('/application');
  });
});
