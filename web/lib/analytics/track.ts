// web/lib/analytics/track.ts
//
// Where an event goes. Today: nowhere, and that is a measured state rather
// than a stub.
//
// FW15 COULD NOT SHIP A COLLECTOR. SPEC 15 asks for Umami, self-hosted, with
// a same-origin script, and there is no instance to proxy or copy from (FW28
// deploys one), no npm package to vendor (@umami/browser and umami-browser
// are both 404; @umami/node is a server-side client), and committing a copy
// of a third-party script is an ask-first item under SPEC 20. So
// /confidentialite still says the site does not measure its audience yet,
// e2e/analytics.spec.ts holds that sentence on every public route, and this
// module has no default destination.
//
// NO VENDOR IS NAMED HERE, DELIBERATELY. Writing `window.umami?.track(...)`
// would bake in a decision the operator has not made - FW28 may proxy
// Umami's script, or may send from our own code to a same-origin endpoint,
// which needs no third-party script at all. A collector is INSTALLED rather
// than looked up, so the choice stays open and the call sites never change.
//
// WHY THE CALL SITES EXIST ANYWAY. WHERE each event fires is the expensive
// knowledge - that `result_status` belongs on every recomputation rather than
// on submit, that `missions_declared` is a boolean at the radio rather than a
// count in the payload. Encoding it now, with tests that install a fake
// collector and assert the payloads, means the task that gets a backend adds
// one function instead of rediscovering nine call sites.
//
// IT NEVER THROWS AND NEVER BLOCKS. An analytics failure must not be able to
// break a calculation: the whole call is wrapped, and a collector that throws
// is discarded rather than retried. This is also the ad-blocker path SPEC 15
// implies and the prompt asks for - with no collector installed, every call
// is a no-op and the page is unaffected.

import type { AnalyticsEvent } from './events';

export type Collector = (event: AnalyticsEvent) => void;

let collector: Collector | null = null;

/**
 * Install the destination. Called by whoever ships a collector; called by
 * tests with a fake.
 *
 * Returns the previous collector so a test can restore it, which is cheaper
 * and less error-prone than a separate reset.
 */
export function setCollector(next: Collector | null): Collector | null {
  const previous = collector;

  collector = next;

  return previous;
}

/** Whether anything is listening. Useful to a test, and to nothing else. */
export const hasCollector = (): boolean => collector !== null;

/**
 * Send one event, or do nothing.
 *
 * The try/catch is not defensive decoration: a collector is third-party-ish
 * code by definition - it is whatever FW28 installs - and this function is
 * called from inside a React event handler on the product's one interactive
 * page. An exception there would surface as a calculator that stops
 * responding, which is an unacceptable price for a metric.
 */
export function track(event: AnalyticsEvent): void {
  if (collector === null) return;

  try {
    collector(event);
  } catch {
    // Swallowed on purpose. There is no user-visible consequence of a lost
    // event, and every alternative has one.
  }
}
