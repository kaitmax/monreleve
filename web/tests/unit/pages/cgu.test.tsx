// @vitest-environment jsdom
//
// web/tests/unit/pages/cgu.test.tsx
//
// Ruling R84's census comes from the shared helper. What is here is specific
// to the terms of use, and the centre of it is one sentence.
//
// THE "NOT TAX ADVICE" SENTENCE IS ASSERTED VERBATIM, from lib/fr, at the
// prompt's instruction - and it is the one assertion on this page worth being
// strict about. Everything else in these conditions is boilerplate a reader
// skims; that sentence is the boundary of what the product claims to be. SPEC
// 9.7: "/cgu must state explicitly: record-keeping tool, not tax advice."
//
// Verbatim rather than by keyword, unlike the privacy notice's pins. There the
// point was that prose could be rewritten as long as the fact survived; here
// the wording IS the fact, because a softened version of this sentence - "ne
// remplace pas un conseil fiscal", say - is a different and weaker statement.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CGU_FIELDS, CguContent } from '@/app/(public)/cgu/CguContent';
import { LEGAL_ENTITY } from '@/lib/content/legal-entity';
import { CGU_COPY } from '@/lib/fr/cgu';
import {
  FILLED_ENTITY,
  complianceClaimsIn,
  describePlaceholderCensus,
  expectNoComplianceClaims,
} from './placeholder-census';

describePlaceholderCensus({
  page: '/cgu',
  Content: CguContent,
  fields: CGU_FIELDS,
  // Three: the editor, the registered office that fixes the jurisdiction, and
  // the contact address. Fewer than the other two legal pages because the
  // identity block belongs to /mentions-legales and the controller to
  // /confidentialite - repeating them here would print placeholders for facts
  // stated elsewhere.
  minimumFields: 3,
  // R84, and the number is stated rather than derived: /cgu declares legalName, address and contactEmail - all three filled in FW20c, so the page now shows no gap at all.
  shippedPlaceholders: 0,
});

function pageText(): string {
  const { container } = render(<CguContent entity={FILLED_ENTITY} />);

  return container.textContent ?? '';
}

describe('the sentence the whole page exists for (SPEC 9.7)', () => {
  it('states, verbatim from lib/fr, that this is not tax advice', () => {
    expect(pageText()).toContain(CGU_COPY.notTaxAdvice);
  });

  it('and that sentence names tax advice, the employer and the administrations', () => {
    // Asserting the constant is rendered is not enough on its own: the
    // constant could be edited into something that no longer says any of it.
    // This is what "explicitly" in SPEC 9.7 means, checked.
    const sentence = CGU_COPY.notTaxAdvice.toLowerCase();

    expect(sentence).toContain('conseil fiscal');
    expect(sentence).toContain('employeur');
    expect(sentence).toContain('administration');
  });

  it('describes the service as recording and formatting, not advising', () => {
    const text = pageText().toLowerCase();

    expect(text).toContain('enregistr');
    expect(text).toContain('met en forme');
  });
});

describe('the obligations it puts on the reader', () => {
  it('says the accuracy of declared days is theirs', () => {
    const text = pageText().toLowerCase();

    expect(text).toContain('exactitude');
    expect(text).toContain('déclar');
  });

  it('says the service does not verify what is declared', () => {
    // The other half of the same fact, and the more uncomfortable half. A
    // record-keeping tool that implied it checked anything would be claiming
    // the one thing it cannot do.
    expect(pageText().toLowerCase()).toContain('ne vérifie pas');
  });
});

describe('access and price (D3)', () => {
  it('states free in 2027 and paid from 2028', () => {
    const text = pageText();

    expect(text).toContain('2027');
    expect(text).toContain('2028');
  });
});

describe('leaving', () => {
  it('states that the account can be deleted and what that destroys', () => {
    const text = pageText().toLowerCase();

    expect(text).toContain('suppression');
    expect(text).toContain('relevé');
  });
});

describe('the page shape', () => {
  it('has exactly one h1', () => {
    const { container } = render(<CguContent entity={LEGAL_ENTITY} />);

    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('sets the prose measure through Container article', () => {
    const { container } = render(<CguContent entity={LEGAL_ENTITY} />);

    expect(container.querySelectorAll('[data-width="article"]')).toHaveLength(1);
  });

  it('is sectioned, and only one level deep', () => {
    const { container } = render(<CguContent entity={LEGAL_ENTITY} />);

    expect(container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(6);
    expect(container.querySelectorAll('h3')).toHaveLength(0);
  });
});

describe('the copy module, including the strings the page does not render', () => {
  it('makes no compliance claim anywhere in it', () => {
    expectNoComplianceClaims(CGU_COPY);
  });

  it('and the walker that checks it can actually find one', () => {
    expect(complianceClaimsIn({ nested: { list: ['un service conforme'] } })).toBe(1);
  });
});
