// @vitest-environment jsdom
//
// web/lib/ui/react/GuideInlineCta/GuideInlineCta.test.tsx
//
// FD13's inline calculator card - the one new component FW18b authorises.
//
// IT IS NOT THE CLOSING CARD. GuideCta ends every guide and FD13 says "this
// exact card ends every guide on the site - one CTA, no variants". This one
// sits MID-ARTICLE, at the point the arithmetic stops being doable mentally,
// and SPEC 9.5 is what puts it there: "every guide to a calculator, TWICE:
// inline at the moment the reader realises they cannot do the math, and the
// end Tile."
//
// NO PROPS, FOR GuideCta's REASON. A `variant`, a `title` or an `href` prop
// is the seam through which seven articles grow seven different calls to
// action pointing at five places. The copy comes from lib/fr and the
// destination is the calculator, in every article, always.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CALCULATOR_PATH } from '@/lib/content/routes';
import { GUIDES_COPY } from '@/lib/fr/guides';
import { GuideInlineCta } from './GuideInlineCta';

afterEach(cleanup);

describe('the inline calculator card', () => {
  it('links the calculator, and only the calculator', () => {
    render(<GuideInlineCta />);

    const links = screen.getAllByRole('link');

    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute('href')).toBe(CALCULATOR_PATH);
  });

  it('carries its prose and its action from lib/fr', () => {
    // BY VALUE, from the copy module, so an emptied constant fails here
    // rather than rendering a card with a blank line in it (R154).
    //
    // BY textContent, NOT getByText - RULING R71, and this test met it the
    // hard way. The sentence ends in a question mark, so R91 puts a U+00A0
    // before it; getByText NORMALISES that to an ordinary space and then
    // cannot match the string it was given. The matcher cannot see a
    // codepoint at all, which is the whole reason R71 forbids it here.
    const { container } = render(<GuideInlineCta />);

    expect(container.querySelector('p')?.textContent).toBe(GUIDES_COPY.inlineCtaBody);
    expect(screen.getByRole('link').textContent).toBe(GUIDES_COPY.ctaAction);
  });

  it('has real copy to render, so the assertions above are not vacuous', () => {
    // Two empty strings would satisfy getByText and toBe perfectly well.
    expect(GUIDES_COPY.inlineCtaBody.length).toBeGreaterThan(20);
    expect(GUIDES_COPY.ctaAction.length).toBeGreaterThan(5);
  });

  it('reuses the closing card action rather than inventing a second wording', () => {
    // ONE ACTION, ONE WORDING. Both cards send the reader to the same page to
    // do the same thing; two labels for that is two strings to keep in step,
    // and the day they diverge a reader meets two different promises for one
    // destination. The PROSE differs, because the moment differs.
    render(<GuideInlineCta />);

    expect(screen.getByRole('link').textContent).toBe(GUIDES_COPY.ctaAction);
    expect(GUIDES_COPY.inlineCtaBody).not.toBe(GUIDES_COPY.ctaBody);
  });

  it('is an aside, not a section, so it stays out of the document outline', () => {
    // The closing card is an aside for the same reason. A <section> with no
    // heading is an unnamed region; a mid-article card that announced itself
    // as a section would sit in the outline between two real ones.
    const { container } = render(<GuideInlineCta />);

    expect(container.querySelector('aside')).toBeTruthy();
    expect(container.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
  });

  it('marks itself so the mesh and the e2e can find it', () => {
    const { container } = render(<GuideInlineCta />);

    expect(container.querySelector('[data-guide-inline-cta]')).toBeTruthy();
  });
});
