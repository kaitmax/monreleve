// web/lib/ui/react/LegalNote/LegalNote.test.tsx
//
// SPEC 9.3 item 6: the standing disclaimer, $legal-01, on every calculating
// surface. DESIGN-SYSTEM.md section 5 lists it among the things that survive
// every redesign.
//
// RULING R58 OVERRIDES THE PROMPT HERE. FW8 asks for "Caption tertiary"; the
// tertiary token is #98A2B3, which is 2,42:1 on the canvas and 2,58:1 on a
// card - failing AA at BOTH the normal-text and the large-text bar. Setting
// the legal disclaimer, of all text, in the one colour nobody can read would
// be a poor joke. It is secondary, which is 4,68:1 and 4,97:1, and tertiary
// survives in this product only as a hairline.
//
// VOCABULARY (SPEC section 20): déclaré, enregistré, horodaté. Never
// certifié, attesté or conforme. A test asserts the absence, because the
// forbidden words are exactly the ones a well-meaning edit reaches for when
// making a disclaimer sound more reassuring.

import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LEGAL_COPY } from '@/lib/fr/legal';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { text } from '@/tests/support/markup';
import { LegalNote } from './LegalNote';

const render = (): string => renderToStaticMarkup(<LegalNote />);

describe('the standing disclaimer', () => {
  it('renders the text from lib/fr and declares none of its own', () => {
    expect(text(render())).toContain(LEGAL_COPY.standing(PRODUCT_STATE));
  });

  it('uses none of the forbidden words', () => {
    // SPEC section 20's vocabulary constraint, asserted on the COPY rather
    // than the markup so that it holds however the component wraps it.
    for (const forbidden of ['certifi', 'attest', 'conform']) {
      expect(LEGAL_COPY.standing(PRODUCT_STATE).toLowerCase()).not.toContain(forbidden);
    }
  });

  it('never emits a hex literal', () => {
    expect(render()).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});

describe('the stylesheet carries what markup cannot show (R61)', () => {
  const scss = readFileSync(new URL('./LegalNote.module.scss', import.meta.url), 'utf8');

  it('sits below a rule', () => {
    expect(scss).toContain('border-top');
  });

  it('is set in SECONDARY, not tertiary - ruling R58 over the FW8 prompt', () => {
    // Measured: #98A2B3 is 2,42:1 on the canvas and fails AA at both sizes.
    expect(scss).toContain('var(--colour-text-secondary)');
    expect(scss).not.toContain('var(--colour-text-tertiary)');
  });

  it('is Caption sized', () => {
    expect(scss).toContain('var(--type-caption-size)');
  });
});
