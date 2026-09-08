// @vitest-environment jsdom
// web/tests/unit/pages/mentions-legales.test.tsx
//
// RULING R84 - THE PLACEHOLDER TEST IS EXACT. "Each legal page declares the
// entity constants it consumes; the test asserts the rendered [A COMPLETER]
// count equals the number of those constants that are empty - N when N are
// empty, zero when all are filled."
//
// WHY EXACT RATHER THAN "AT LEAST ONE". A test that only asserted a
// placeholder appears while something is empty would pass on a page that had
// silently stopped rendering six of its seven values: one placeholder is still
// one placeholder. Exactness turns the count into a census, so an OMISSION
// fails as loudly as a leak.
//
// THE PER-FIELD SWEEP IS WHAT MAKES THE DECLARATION HONEST. Filling every
// field except one and demanding exactly one placeholder proves that this
// particular field is rendered, and rendered ONCE. Without it the declaration
// could list a field the page never prints, or the prose could repeat a value
// twice, and the all-empty count would still add up by accident.
//
// A CONSEQUENCE WORTH KNOWING: the prose may name each consumed value exactly
// once. Later sections say "l'editeur" rather than repeating the company name,
// which is ordinary legal French and is also what keeps this count meaningful.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  MENTIONS_LEGALES_FIELDS,
  MentionsLegalesContent,
} from '@/app/(public)/mentions-legales/MentionsLegalesContent';
import { LEGAL_ENTITY } from '@/lib/content/legal-entity';
import {
  FILLED_ENTITY,
  complianceClaimsIn,
  describePlaceholderCensus,
  expectNoComplianceClaims,
} from './placeholder-census';
import { MENTIONS_LEGALES_COPY } from '@/lib/fr/mentions-legales';

describePlaceholderCensus({
  page: '/mentions-legales',
  Content: MentionsLegalesContent,
  fields: MENTIONS_LEGALES_FIELDS,
  // The editor identity block and the host, at minimum.
  minimumFields: 5,
});

describe('the page shape', () => {
  it('has exactly one h1', () => {
    const { container } = render(<MentionsLegalesContent entity={LEGAL_ENTITY} />);

    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('sets the prose measure through Container article', () => {
    // FD13:23 - 680 px, about 70 characters a line. Asserted through the data
    // attribute because CSS Module class names are hashed.
    const { container } = render(<MentionsLegalesContent entity={LEGAL_ENTITY} />);

    expect(container.querySelectorAll('[data-width="article"]')).toHaveLength(1);
  });

  it('gives every section a heading below the h1', () => {
    const { container } = render(<MentionsLegalesContent entity={LEGAL_ENTITY} />);

    expect(container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll('h3')).toHaveLength(0);
  });
});

describe('the vocabulary SPEC section 20 forbids', () => {
  it('never claims the record is certified, attested or compliant', () => {
    // Declare, enregistre, horodate - never certifie, atteste, conforme. A
    // legal page is exactly where a well-meaning edit reaches for those words.
    const { container } = render(<MentionsLegalesContent entity={FILLED_ENTITY} />);
    const text = (container.textContent ?? '').toLowerCase();

    for (const banned of ['certifi', 'attest', 'conforme']) {
      expect(text, banned).not.toContain(banned);
    }
  });
});

describe('the copy module, including the strings the page does not render', () => {
  it('makes no compliance claim anywhere in it', () => {
    // Not only the rendered text: the meta description reaches search results
    // and is not in the DOM. Probing a "service conforme au RGPD" edit there
    // left the rendered-text assertion green, which is why this one exists.
    expectNoComplianceClaims(MENTIONS_LEGALES_COPY);
  });

  it('and the walker that checks it can actually find one', () => {
    // Otherwise the assertion above passes on any object at all, including one
    // whose shape the walker silently skips.
    expect(complianceClaimsIn({ nested: { list: ['un service conforme'] } })).toBe(1);
  });
});
