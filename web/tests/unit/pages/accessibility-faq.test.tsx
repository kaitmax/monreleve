// @vitest-environment jsdom
//
// web/tests/unit/pages/accessibility-faq.test.tsx
//
// FW15 increment 6: the inline FAQ, open and closed, and the keyboard path
// through it.
//
// BOTH STATES, BECAUSE THEY ARE DIFFERENT DOCUMENTS. A collapsed <details> and
// an open one expose different accessibility trees - the open one adds its
// panel's content to the reading order and changes the summary's expanded
// state - and a page that is clean in one can be broken in the other. That is
// the same reason accessibility-calculateur.test.tsx renders four states
// rather than one.
//
// THE KEYBOARD PATH IS ASSERTED SEPARATELY FROM AXE, because axe cannot press
// anything. What makes the native element the right choice is that Enter and
// Space toggle it and the summary is focusable without a tabindex from us -
// properties of the platform, but properties this product now depends on, so
// they are held by a test rather than by a comment.
//
// WHAT AXE CANNOT SEE HERE: jsdom has no layout, so colour-contrast comes back
// INCOMPLETE and no size is measurable. The FAQ's colours come from tokens
// audited in tests/unit/tokens/contrast.test.ts, and its appearance is in the
// calculateur baselines.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import * as matchers from 'vitest-axe/matchers';
import CalculateurPage from '@/app/(public)/calculateur-teletravail-frontalier/page';
import { FAQ_COPY } from '@/lib/fr/faq';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';

expect.extend(matchers);

afterEach(cleanup);

const mount = () =>
  render(
    <PublicShell>
      <CalculateurPage />
    </PublicShell>,
  );

const faq = (container: HTMLElement): HTMLElement => {
  const section = container.querySelector('[data-faq]');

  if (!(section instanceof HTMLElement)) throw new Error('no FAQ on the page');

  return section;
};

describe('the FAQ has no axe violations', () => {
  it('closed, which is how every reader first meets it', async () => {
    const { container } = mount();

    expect(faq(container).querySelectorAll('details[open]').length).toBe(0);

    expect(await axe(container)).toHaveNoViolations();
  });

  it('with every answer open at once, which is the heaviest state', async () => {
    const { container } = mount();

    for (const details of faq(container).querySelectorAll('details')) {
      details.open = true;
    }

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe('the keyboard path through the accordion', () => {
  it('reaches every question without a tabindex of ours', () => {
    // A <summary> is focusable by the platform. If the component ever grew a
    // div-with-onClick, this is what would fail - and it is the property that
    // made the native element worth choosing.
    const { container } = mount();
    const summaries = [...faq(container).querySelectorAll('summary')];

    expect(summaries.length).toBe(3);

    for (const summary of summaries) {
      expect(summary.getAttribute('tabindex')).toBeNull();

      summary.focus();

      expect(document.activeElement).toBe(summary);
    }
  });

  it('toggles the answer open and shut, and jsdom really does it', () => {
    // MEASURED BEFORE IT WAS WRITTEN, because the first version of this
    // test set details.open by hand and would have passed against a
    // component that did nothing. jsdom implements the summary activation
    // behaviour - probed: false, click, true - so the toggle asserted here
    // is the real one.
    //
    // THE KEYBOARD ITSELF IS ASSERTED IN A REAL BROWSER, in
    // e2e/faq.spec.ts. jsdom does not map Enter on a summary to an
    // activation, and a test that pretended otherwise would be asserting
    // its own stub.
    const { container } = mount();
    const first = faq(container).querySelector('details');
    const summary = first?.querySelector('summary');

    expect(first?.open).toBe(false);

    fireEvent.click(summary as Element);

    expect(first?.open).toBe(true);

    fireEvent.click(summary as Element);

    expect(first?.open).toBe(false);
  });

  it('contributes no tab stop from a closed answer', () => {
    // The closed panel's content is in the DOM - that is the whole point, for
    // the crawler - so the risk is the opposite of the calculator's: content
    // present and reachable by Tab when it should not be. A paragraph is not
    // focusable, and this says so rather than assuming it.
    const { container } = mount();
    const focusable = faq(container).querySelectorAll(
      'details:not([open]) a, details:not([open]) button, details:not([open]) input',
    );

    expect(focusable.length).toBe(0);
  });
});

describe('the FAQ is part of the page outline', () => {
  it('carries a real heading, so a screen reader can jump to it', () => {
    mount();

    expect(screen.getByRole('heading', { name: FAQ_COPY.heading })).toBeDefined();
  });
});
