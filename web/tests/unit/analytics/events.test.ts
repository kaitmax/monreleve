// web/tests/unit/analytics/events.test.ts
//
// SPEC 15's event set, and the rule that matters more than the list:
// NO PERSONAL DATA IN ANY PAYLOAD.
//
// WHY AN ALLOW-LIST AND NOT A REVIEW. An analytics payload is the easiest
// place in a product to leak something, because adding a field is one word
// and nothing downstream objects: the event still fires, the dashboard gets
// richer, and the privacy page quietly becomes false. The param schema has
// the same shape of test for the same reason (SPEC 9.4), and this is that
// pattern applied to the other direction of travel.
//
// THE KEY SET IS ENUMERATED ACROSS EVERY BUILDER, so a field added to one
// event fails here even if every other assertion passes.
//
// result_status IS THE ONE THE OPERATOR ASKED FOR BY NAME: "the closest thing
// to a direct test of whether frontaliers are actually near these
// thresholds". It carries the Status enum, and the test below is exhaustive
// over that union rather than over a list typed here - a fifth status added
// to zones.ts and not to the event would otherwise ship as a silently
// missing category.

import { describe, expect, it } from 'vitest';
import {
  EVENT_NAMES,
  PAYLOAD_KEYS,
  accordionOpened,
  appCtaClicked,
  calculated,
  contextualLinkClicked,
  emailSubmitted,
  missionsDeclared,
  pageView,
  resultStatus,
  shareClicked,
} from '@/lib/analytics/events';
import { STATUS_PRESENTATION } from '@/lib/ui/core/zones';
import type { Status } from '@/lib/ui/core/zones';

const STATUSES = Object.keys(STATUS_PRESENTATION) as Status[];

/** One of each, so the enumeration below covers the whole set. */
const EVERY_EVENT = [
  pageView('/calculateur-teletravail-frontalier'),
  calculated(),
  resultStatus('compliant'),
  accordionOpened('options-avancees'),
  missionsDeclared(true),
  emailSubmitted('calculateur'),
  shareClicked('copy'),
  contextualLinkClicked('sources'),
  appCtaClicked('calculateur'),
];

describe('SPEC 15 event set', () => {
  it('names the nine events and no others', () => {
    expect([...EVENT_NAMES].sort()).toEqual(
      [
        'accordion_opened',
        'app_cta_clicked',
        'calculated',
        'contextual_link_clicked',
        'email_submitted',
        'missions_declared',
        'page_view',
        'result_status',
        'share_clicked',
      ].sort(),
    );
  });

  it('has a builder for every name, and builds nothing else', () => {
    // R63 in event form: a builder removed, or a name added with no builder,
    // is a gap that every other test here would pass over.
    expect([...EVERY_EVENT.map((event) => event.name)].sort()).toEqual([...EVENT_NAMES].sort());
  });
});

describe('no payload carries personal data', () => {
  it('uses only allow-listed keys, across every event', () => {
    const used = [...new Set(EVERY_EVENT.flatMap((event) => Object.keys(event.data ?? {})))];

    expect(used.sort()).toEqual([...PAYLOAD_KEYS].sort());
  });

  it('carries no value that could identify a person', () => {
    // THE ASSERTION THAT OUTLIVES THE KEY LIST. A key called "source" is
    // harmless; a key called "source" holding an email address is not. So
    // the VALUES are checked too: every payload value must be a string from
    // a closed vocabulary, a boolean, or a number - never free text a user
    // typed.
    for (const event of EVERY_EVENT) {
      for (const [key, value] of Object.entries(event.data ?? {})) {
        expect(typeof value, `${event.name}.${key}`).not.toBe('object');
        expect(String(value), `${event.name}.${key}`).not.toContain('@');
      }
    }
  });

  it('never carries a rate, a day count or a canton', () => {
    // The calculator's inputs ARE the user's fiscal position. `calculated`
    // deliberately carries nothing at all: that somebody calculated is the
    // signal, and what they calculated is theirs. This is the same line the
    // OG card draws.
    //
    // THE PAYLOADS ONLY, NOT THE NAMES, and the first version of this test
    // got that wrong: it serialised whole events and failed on
    // `email_submitted`, which is SPEC 15's own name for the event. The
    // claim is about what an event CARRIES - a name is a category, and this
    // one names an action rather than describing a person.
    const serialised = JSON.stringify(EVERY_EVENT.map((event) => event.data ?? {}));

    for (const forbidden of ['taux', 'canton', 'jours', 'rate', 'days', 'email']) {
      expect(serialised.toLowerCase()).not.toContain(forbidden);
    }
  });
});

describe('result_status carries the Status enum', () => {
  it('accepts every status the product can produce', () => {
    // EXHAUSTIVE OVER THE UNION, read from zones.ts rather than typed here.
    // A fifth status added there and not handled here would otherwise be a
    // category that silently never appears in the data.
    expect(STATUSES.length).toBe(4);

    for (const status of STATUSES) {
      const event = resultStatus(status);

      expect(event.name).toBe('result_status');
      expect(event.data?.status).toBe(status);
    }
  });

  it('produces a distinct payload per status, not one repeated', () => {
    // R120: fixtures that cannot disagree prove nothing. If resultStatus
    // ignored its argument, every assertion above would still pass.
    const emitted = new Set(STATUSES.map((status) => JSON.stringify(resultStatus(status))));

    expect(emitted.size).toBe(STATUSES.length);
  });
});
