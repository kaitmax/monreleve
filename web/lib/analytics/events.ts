// web/lib/analytics/events.ts
//
// SPEC 15's event set, as pure data. No transport here - see track.ts.
//
// THE PAYLOAD IS THE PRIVACY SURFACE, and it is the reason this module is
// separate from the thing that sends it. An analytics payload is the easiest
// place in a product to leak something: adding a field is one word, nothing
// downstream objects, the dashboard gets richer, and the privacy page quietly
// becomes false. Keeping the payloads as pure functions means the whole
// surface can be enumerated by a test - every key, across every event -
// rather than reviewed call site by call site.
//
// WHAT IS DELIBERATELY NOT CARRIED: the rate, the day count, the canton, the
// employment rate, the email address. `calculated` carries NOTHING. That
// somebody ran a calculation is the signal SPEC 15 asks for - "Real usage,
// not bounces" - and what they calculated is theirs. It is the same line the
// OG card draws, for the same reason: a user's fiscal position is not ours to
// move around.
//
// result_status IS THE EXCEPTION, AND IT IS THE POINT OF THE SET. SPEC 15:
// "the most valuable signal - the closest thing to a direct test of whether
// frontaliers are actually near these thresholds. If nobody lands outside
// `compliant`, the premise is weak." It carries the Status and nothing else:
// a bucket, not a number, and four buckets cannot identify anybody.

import type { Status } from '@/lib/ui/core/zones';

/** SPEC 15's table, verbatim. comparator_calculated arrives with FW19. */
export const EVENT_NAMES = [
  'page_view',
  'calculated',
  'result_status',
  'accordion_opened',
  'missions_declared',
  'email_submitted',
  'share_clicked',
  'contextual_link_clicked',
  'app_cta_clicked',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/**
 * Every key any payload may carry.
 *
 * A CLOSED SET, asserted by enumeration in the tests. Each one is a category
 * rather than a value a user typed:
 *
 *   path      the route, which is in the URL bar anyway
 *   status    one of four Status buckets
 *   section   which accordion, by its id
 *   declared  whether missions were declared - a boolean, not how many
 *   source    which surface an action came from, from a closed list
 *   method    how a link was shared, from a closed list
 *   target    which contextual link, by name
 */
export const PAYLOAD_KEYS = [
  'path',
  'status',
  'section',
  'declared',
  'source',
  'method',
  'target',
] as const;

export type PayloadKey = (typeof PAYLOAD_KEYS)[number];

/** A payload value is a category, a flag or a count - never free text. */
export type PayloadValue = string | number | boolean;

export interface AnalyticsEvent {
  readonly name: EventName;
  readonly data?: Readonly<Partial<Record<PayloadKey, PayloadValue>>>;
}

/** Where an action happened. Closed, because "source" invites a free string. */
export type EventSource = 'calculateur' | 'alertes' | 'guide';

/** How a link was shared. SPEC 9.4's two mechanisms. */
export type ShareMethod = 'copy' | 'share';

export const pageView = (path: string): AnalyticsEvent => ({
  name: 'page_view',
  data: { path },
});

/**
 * SPEC 15: "Real usage, not bounces."
 *
 * NO PAYLOAD AT ALL, and that is the decision rather than an omission. The
 * obvious fields - the rate, the days, the canton - are exactly the user's
 * fiscal position, and a count of calculations answers the question SPEC
 * asks without any of them.
 */
export const calculated = (): AnalyticsEvent => ({ name: 'calculated' });

export const resultStatus = (status: Status): AnalyticsEvent => ({
  name: 'result_status',
  data: { status },
});

export const accordionOpened = (section: string): AnalyticsEvent => ({
  name: 'accordion_opened',
  data: { section },
});

/** A boolean, never a number: how many missions is the user's business. */
export const missionsDeclared = (declared: boolean): AnalyticsEvent => ({
  name: 'missions_declared',
  data: { declared },
});

export const emailSubmitted = (source: EventSource): AnalyticsEvent => ({
  name: 'email_submitted',
  data: { source },
});

export const shareClicked = (method: ShareMethod): AnalyticsEvent => ({
  name: 'share_clicked',
  data: { method },
});

export const contextualLinkClicked = (target: string): AnalyticsEvent => ({
  name: 'contextual_link_clicked',
  data: { target },
});

export const appCtaClicked = (source: EventSource): AnalyticsEvent => ({
  name: 'app_cta_clicked',
  data: { source },
});
