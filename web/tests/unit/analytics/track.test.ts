// web/tests/unit/analytics/track.test.ts
//
// The transport, and the two properties that matter while there is nothing
// to transport to: it does nothing, and it cannot break the page.
//
// "DEGRADES SILENTLY WHEN THE SCRIPT IS ABSENT" IS THE ONLY PATH TODAY.
// SPEC 15 implies it for ad blockers; FW15 lives in it, because no collector
// ships (see track.ts for the measurement). That makes these assertions the
// current behaviour rather than a contingency, which is the best possible
// position for a contingency to be tested from.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculated, resultStatus } from '@/lib/analytics/events';
import { hasCollector, setCollector, track } from '@/lib/analytics/track';

afterEach(() => {
  setCollector(null);
});

describe('with no collector installed', () => {
  it('has none by default, which is the shipped state', () => {
    expect(hasCollector()).toBe(false);
  });

  it('sends nothing and throws nothing', () => {
    expect(() => {
      track(calculated());
      track(resultStatus('social-switch'));
    }).not.toThrow();
  });
});

describe('with a collector installed', () => {
  it('passes the event through unchanged', () => {
    const seen: unknown[] = [];

    setCollector((event) => seen.push(event));

    track(resultStatus('regime-lost'));

    expect(seen).toEqual([{ name: 'result_status', data: { status: 'regime-lost' } }]);
  });

  it('returns the previous collector, so a test can restore it', () => {
    const first = (): void => undefined;

    setCollector(first);

    expect(setCollector(null)).toBe(first);
  });
});

describe('a collector that throws cannot break the page', () => {
  it('swallows the error and keeps working afterwards', () => {
    // THE REASON THIS IS NOT DEFENSIVE DECORATION. track() is called from
    // inside a React event handler on the calculator. An exception there
    // surfaces as a calculator that stops responding to input - an
    // unacceptable price for a metric, and one that would be blamed on the
    // engine rather than on analytics.
    const seen: unknown[] = [];

    setCollector(() => {
      throw new Error('collector is having a bad day');
    });

    expect(() => {
      track(calculated());
    }).not.toThrow();

    setCollector((event) => seen.push(event));
    track(calculated());

    expect(seen.length).toBe(1);
  });

  it('does not report the failure anywhere a user could see it', () => {
    // A console error in production is a support ticket about a page that
    // works. There is no user-visible consequence of a lost event and every
    // alternative to silence has one.
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    setCollector(() => {
      throw new Error('again');
    });
    track(calculated());

    expect(error).not.toHaveBeenCalled();

    error.mockRestore();
  });
});
