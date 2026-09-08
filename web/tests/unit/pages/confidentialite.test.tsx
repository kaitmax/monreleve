// @vitest-environment jsdom
//
// web/tests/unit/pages/confidentialite.test.tsx
//
// Ruling R84's census comes from the shared helper. What is here is what is
// specific to the privacy notice - and for this page that is the FACTUAL
// CLAIMS, because the prompt requires every one of them to be true of the code
// as it exists or as it is specified.
//
// WHY PIN THE CLAIMS AT ALL, given the copy is mine. Because the sentences
// below are the product's central promises and they are the ones a future
// copy edit is most likely to soften or drop by accident. SPEC 13.1's hard
// rule - "coordinates never leave the sampling function" - is asserted three
// times across the codebase already (the API rejection test at FW23, the
// detection fence, DESIGN-SYSTEM section 2); this is the assertion that the
// PAGE SAYING SO does not quietly disappear. A notice that stops mentioning
// the guarantee is how a guarantee stops being one.
//
// These assertions name concepts, not sentences: "coordonn" and "30 jours"
// rather than a full phrase, so an editor may rewrite the prose freely and
// only fails by removing the fact.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  CONFIDENTIALITE_FIELDS,
  ConfidentialiteContent,
} from '@/app/(public)/confidentialite/ConfidentialiteContent';
import { LEGAL_ENTITY } from '@/lib/content/legal-entity';
import {
  FILLED_ENTITY,
  complianceClaimsIn,
  describePlaceholderCensus,
  expectNoComplianceClaims,
} from './placeholder-census';
import { CONFIDENTIALITE_COPY } from '@/lib/fr/confidentialite';

describePlaceholderCensus({
  page: '/confidentialite',
  Content: ConfidentialiteContent,
  fields: CONFIDENTIALITE_FIELDS,
  // The controller, its address, the DPO, the contact address and the host.
  minimumFields: 5,
});

function pageText(): string {
  const { container } = render(<ConfidentialiteContent entity={FILLED_ENTITY} />);

  return (container.textContent ?? '').toLowerCase();
}

describe('the page shape', () => {
  it('has exactly one h1', () => {
    const { container } = render(<ConfidentialiteContent entity={LEGAL_ENTITY} />);

    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('sets the prose measure through Container article', () => {
    const { container } = render(<ConfidentialiteContent entity={LEGAL_ENTITY} />);

    expect(container.querySelectorAll('[data-width="article"]')).toHaveLength(1);
  });

  it('is sectioned, and only one level deep', () => {
    const { container } = render(<ConfidentialiteContent entity={LEGAL_ENTITY} />);

    expect(container.querySelectorAll('h2').length).toBeGreaterThanOrEqual(8);
    expect(container.querySelectorAll('h3')).toHaveLength(0);
  });
});

describe('the coordinate guarantee, which is the product (SPEC 13.1, D18)', () => {
  it('states that no coordinate is recorded or transmitted', () => {
    const text = pageText();

    expect(text).toContain('coordonn');
    expect(text).toContain('jamais');
  });

  it('says the country is determined on the device and the fix discarded', () => {
    const text = pageText();

    expect(text).toContain('appareil');
    expect(text).toContain('polygone');
  });

  it('says the API refuses a payload carrying one', () => {
    // The guarantee is enforced, not merely promised - FW23 posts such a
    // payload and expects a 400. A notice that claimed only good intentions
    // would be claiming less than the code does.
    expect(pageText()).toContain('refuse');
  });

  it('mentions no movement history and no place name', () => {
    const text = pageText();

    expect(text).toContain('déplacement');
    expect(text).toContain('lieu');
  });
});

describe('retention, which is a number and therefore easy to lose', () => {
  it('states the 30-day purge of unconfirmed signups (SPEC 8, AlertSubscriber)', () => {
    expect(pageText()).toContain('30 jours');
  });

  it('states that account data is kept until deletion', () => {
    expect(pageText()).toContain('suppression');
  });
});

describe('the rights, and how to use them (D11)', () => {
  it('names the export and its formats', () => {
    const text = pageText();

    expect(text).toContain('export');
    expect(text).toContain('json');
    expect(text).toContain('csv');
  });

  it('names both texts that grant them', () => {
    const text = pageText();

    expect(text).toContain('rgpd');
    expect(text).toContain('lpd');
  });

  it('names the supervisory authority to complain to', () => {
    expect(pageText()).toContain('cnil');
  });
});

describe('the public site collects nothing by default', () => {
  it('says there is no cookie', () => {
    // SPEC 10: "no session cookie on any public route - the zero cookies on
    // the public surface guarantee is total again". e2e/home.spec.ts asserts
    // the behaviour; this asserts the page still says so.
    expect(pageText()).toContain('cookie');
  });

  it('says the email is given, not taken', () => {
    expect(pageText()).toContain('adresse e-mail');
  });
});

describe('the vocabulary SPEC section 20 forbids', () => {
  it('never claims the record is certified, attested or compliant', () => {
    for (const banned of ['certifi', 'attest', 'conforme']) {
      expect(pageText(), banned).not.toContain(banned);
    }
  });
});

describe('the copy module, including the strings the page does not render', () => {
  it('makes no compliance claim anywhere in it', () => {
    // Not only the rendered text: the meta description reaches search results
    // and is not in the DOM. Probing a "service conforme au RGPD" edit there
    // left the rendered-text assertion green, which is why this one exists.
    expectNoComplianceClaims(CONFIDENTIALITE_COPY);
  });

  it('and the walker that checks it can actually find one', () => {
    // Otherwise the assertion above passes on any object at all, including one
    // whose shape the walker silently skips.
    expect(complianceClaimsIn({ nested: { list: ['un service conforme'] } })).toBe(1);
  });
});
