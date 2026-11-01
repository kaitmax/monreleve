// @vitest-environment jsdom
// web/lib/ui/react/ResultCard/ResultCard.test.tsx
//
// FW-CALCS-A2, R733. A frame: every attribute the content's contracts rely on
// (id, aria-live, tabIndex, data-*) lands on the element unchanged, in either
// tone and as whichever element the caller asks for.

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResultCard } from './ResultCard';

const FIGURE = '42';

describe('ResultCard', () => {
  it('passes the caller’s attributes through, as a section by default', () => {
    const host = document.createElement('div');

    host.innerHTML = renderToStaticMarkup(
      <ResultCard id="resultat" aria-live="polite" tabIndex={-1} data-panel="x">
        <p>{FIGURE}</p>
      </ResultCard>,
    );

    const root = host.firstElementChild;

    expect(root?.tagName).toBe('SECTION');
    expect(root?.getAttribute('id')).toBe('resultat');
    expect(root?.getAttribute('aria-live')).toBe('polite');
    expect(root?.getAttribute('tabindex')).toBe('-1');
    expect(root?.getAttribute('data-panel')).toBe('x');
    expect(root?.textContent).toBe(FIGURE);
  });

  it('renders the brand tone with another class, as the element asked for', () => {
    const host = document.createElement('div');

    host.innerHTML =
      renderToStaticMarkup(
        <ResultCard tone="brand" element="div">
          <p>{FIGURE}</p>
        </ResultCard>,
      ) + renderToStaticMarkup(<ResultCard element="article">{FIGURE}</ResultCard>);

    const [brand, surface] = [...host.children];

    expect(brand?.tagName).toBe('DIV');
    expect(surface?.tagName).toBe('ARTICLE');
    expect(brand?.className).not.toBe(surface?.className);
  });
});
