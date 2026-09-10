// @vitest-environment jsdom
//
// web/tests/unit/pages/provisional-notice.test.tsx
//
// FW12 increment 5: R110's notice gets somewhere to send the reader.
//
// WHAT WAS ALREADY TRUE BEFORE THIS INCREMENT, and this file does not claim
// otherwise. FW11 shipped the notice itself: both triggers, the absence on
// Geneva case (c), the "review is pending" sentence and the vocabulary guard
// are asserted in calculateur-accordion.test.tsx and were green before
// increment 5 began. Rewriting them here to manufacture a RED run would be
// theatre, so those tests stay where they are and this file covers the part
// that was missing.
//
// WHAT WAS MISSING IS THE DESTINATION. The notice named a reading and said
// review was pending, and then stopped - a reader told that their own
// calculation depends on an unsettled interpretation had nowhere to go and
// nothing to read. /sources shipped as increment 0 with all three readings
// published on it, and the two surfaces were not connected.
//
// AND THE LINK IS PER READING, not to the page. "Vous trouverez plus de
// details sur /sources" makes the reader find their own reading among three;
// the notice already knows which one it is talking about, so it says so in the
// fragment. Which means the fragment has to EXIST - a deep link to an id
// nothing renders is the R85 failure in miniature, a promise the page does not
// keep - so the anchor is asserted against the sources page itself rather than
// against a constant that both sides share.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { CalculatorForm } from '@/app/(public)/calculateur-teletravail-frontalier/CalculatorForm';
import SourcesPage from '@/app/(public)/sources/page';
import {
  PROVISIONAL_IDS,
  PUBLISHED_PROVISIONAL_IDS,
  type ProvisionalId,
  readingAnchor,
} from '@/lib/content/provisional';
import { CALCULATEUR_COPY } from '@/lib/fr/calculateur';
import { PROVISIONAL_COPY } from '@/lib/fr/provisional';

afterEach(cleanup);

beforeAll(() => {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    return undefined;
  };
});

const FORM = CALCULATEUR_COPY.form;

const setUp = () => render(<CalculatorForm taxYear={2026} />);

const field = (label: string): HTMLInputElement =>
  screen.getByLabelText(label) as HTMLInputElement;
const radio = (name: string): HTMLInputElement =>
  screen.getByRole('radio', { name }) as HTMLInputElement;

const type = (element: HTMLInputElement, value: string) => {
  fireEvent.change(element, { target: { value } });
};

const chooseCanton = () => {
  fireEvent.change(screen.getByLabelText(FORM.canton.label), { target: { value: 'GE' } });
};

const openAdvanced = () => {
  fireEvent.click(screen.getByRole('button', { name: FORM.advanced.summary }));
};

/** P1: mission days in France AND in a third state, so the order matters. */
const triggerP1 = () => {
  chooseCanton();
  type(field(FORM.days.label), '40');
  fireEvent.click(radio(FORM.missions.yes));
  type(field(FORM.missions.france.label), '6');
  type(field(FORM.missions.thirdState.label), '4');
};

/** P3: the exact method at part time, so the cap's proration matters. */
const triggerP3 = () => {
  chooseCanton();
  type(field(FORM.days.label), '40');
  type(field(FORM.rate.label), '80');
  openAdvanced();
  fireEvent.click(radio(FORM.method.exact));
};

const noticeLinks = (): HTMLAnchorElement[] => {
  const notice = document.querySelector('[data-notice="provisional"]');

  if (notice === null) throw new Error('no provisional notice rendered');

  return [...notice.querySelectorAll('a')];
};

describe('the notice sends the reader to the reading itself', () => {
  it('carries exactly one link per named reading', () => {
    // One reading named, one link. Two links for one reading is a reader
    // choosing between identical destinations; a single link for two readings
    // sends them to one of the two.
    setUp();
    triggerP1();

    expect(noticeLinks()).toHaveLength(1);
  });

  it('points at that reading on /sources, not at the page', () => {
    setUp();
    triggerP1();

    expect(noticeLinks()[0]?.getAttribute('href')).toBe(`/sources#${readingAnchor('P1')}`);
  });

  it('names a different reading for a different trigger', () => {
    // NON-VACUITY FOR THE FRAGMENT. A link hardcoded to P1's anchor passes
    // the assertion above and is wrong for every other reading.
    setUp();
    triggerP3();

    expect(noticeLinks()[0]?.getAttribute('href')).toBe(`/sources#${readingAnchor('P3')}`);
  });

  it('links both readings when the input touches both', () => {
    setUp();
    triggerP1();
    type(field(FORM.rate.label), '80');
    openAdvanced();
    fireEvent.click(radio(FORM.method.exact));

    const hrefs = noticeLinks().map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual([`/sources#${readingAnchor('P1')}`, `/sources#${readingAnchor('P3')}`]);
  });

  it('gives the link text of its own rather than a bare URL', () => {
    // SPEC 16 and the shell's own rule: a link's accessible name has to say
    // where it goes. "/sources" is a path, not a description.
    setUp();
    triggerP1();

    const text = noticeLinks()[0]?.textContent ?? '';

    expect(text.length).toBeGreaterThan(8);
    expect(text).not.toContain('/sources');
    expect(text).toBe(PROVISIONAL_COPY.readMore);
  });

  it('renders no link when there is no notice', () => {
    // Geneva case (c): 24 mission days in France and none in a third state.
    // The reference calculation carries no caveat, so it carries no link.
    setUp();
    chooseCanton();
    type(field(FORM.days.label), '84');
    fireEvent.click(radio(FORM.missions.yes));
    type(field(FORM.missions.france.label), '24');

    expect(document.querySelector('[data-notice="provisional"]')).toBeNull();
    expect(document.querySelectorAll('a[href^="/sources#"]')).toHaveLength(0);
  });
});

describe('the fragment it points at exists on /sources', () => {
  // THE HALF THAT MAKES THE HREF MEAN ANYTHING. Both sides could agree on a
  // string and neither render an element with that id, and the reader would
  // land at the top of a page of three readings having been promised one.
  const sourcesIds = (): Set<string> => {
    const { container } = render(<SourcesPage />);

    return new Set([...container.querySelectorAll('[id]')].map((node) => node.id));
  };

  it.each(PROVISIONAL_IDS)('%s has an anchor to land on', (id) => {
    expect(sourcesIds()).toContain(readingAnchor(id));
  });

  it('gives every published reading one, trigger or not', () => {
    // P2 has no input trigger, so no notice ever links to it - and it is the
    // reading whose only disclosure was once a route that did not exist.
    // Anchoring it too costs nothing and makes the set uniform.
    const ids = sourcesIds();

    for (const id of PUBLISHED_PROVISIONAL_IDS) {
      expect(ids, id).toContain(readingAnchor(id));
    }
  });

  it('builds the anchor from the id rather than repeating it', () => {
    // Non-vacuity for readingAnchor: it has to be a function OF the id, or
    // the two assertions above pass against one constant string.
    const anchors = PUBLISHED_PROVISIONAL_IDS.map((id) => readingAnchor(id));

    expect(new Set(anchors).size).toBe(PUBLISHED_PROVISIONAL_IDS.length);
    for (const id of PUBLISHED_PROVISIONAL_IDS) {
      expect(readingAnchor(id)).toContain(id);
    }
  });
});

describe('it is a disclosure, not a problem', () => {
  it('sits outside the warning list', () => {
    // INFO, NOT WARNING, and the prompt is explicit about the distinction: a
    // pending reading is a disclosure about a rule's status, while every
    // banner in the panel's list is a consequence of the user's own numbers.
    // Rendering it among them would make a correct calculation look like it
    // had eight problems instead of seven.
    setUp();
    triggerP1();

    const notice = document.querySelector('[data-notice="provisional"]');

    expect(notice).not.toBeNull();
    expect(notice?.closest('[data-panel="warnings"]')).toBeNull();
    expect(notice?.querySelector('[data-warning]')).toBeNull();
  });

  it('survives an input the engine rejects', () => {
    // THE PROPERTY THAT KEPT THIS NOTICE OUT OF THE RESULT PANEL. It is
    // derived from the INPUT, so it is right while the numbers are still
    // invalid - and the panel renders only when there is a result. A reader
    // mid-correction is exactly the reader who should still be told which
    // reading their configuration depends on.
    setUp();
    triggerP1();

    expect(document.querySelector('[data-notice="provisional"]')).not.toBeNull();

    type(field(FORM.rate.label), '0');

    expect(document.querySelector('[data-notice="provisional"]')).not.toBeNull();
    expect(noticeLinks()).toHaveLength(1);
  });

  it('names the pending reading it is about, in the notice itself', () => {
    // Non-vacuity for [data-notice]: the attribute has to be on the element
    // that carries the copy, not on a wrapper somewhere else.
    setUp();
    triggerP1();

    const notice = document.querySelector('[data-notice="provisional"]');
    const text = notice?.textContent ?? '';
    const id: ProvisionalId = 'P1';

    expect(text).toContain(PROVISIONAL_COPY.lead);
    expect(text).toContain(PROVISIONAL_COPY.items[id].interpretation);
    expect(text).toContain(PROVISIONAL_COPY.pending);
  });
});
