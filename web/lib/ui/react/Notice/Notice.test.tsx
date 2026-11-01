// @vitest-environment jsdom
// web/lib/ui/react/Notice/Notice.test.tsx
//
// FW-CALCS-A2, R733. The error-style banner: a heading the caller can point
// aria-labelledby at, a decorative icon (the heading carries the meaning), the
// body, and the caller's data attribute on the element.

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LAMAL_COPY } from '@/lib/fr/lamal';
import { Notice } from './Notice';

const HEADING = LAMAL_COPY.banner.heading;
const BODY = LAMAL_COPY.banner.body;

describe('Notice', () => {
  it('renders the heading with its id, the body, a hidden icon and the caller’s attributes', () => {
    const host = document.createElement('div');

    host.innerHTML = renderToStaticMarkup(
      <Notice element="aside" heading={HEADING} headingId="titre" aria-labelledby="titre" data-banner="irrevocable">
        <p>{BODY}</p>
      </Notice>,
    );

    const root = host.querySelector('aside');

    expect(root?.getAttribute('data-banner')).toBe('irrevocable');
    expect(root?.getAttribute('aria-labelledby')).toBe('titre');
    expect(host.querySelector('#titre')?.textContent).toBe(HEADING);
    expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(root?.textContent).toBe(HEADING + BODY);
  });
});
