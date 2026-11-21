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
import { complianceClaims } from '@/tests/support/vocabulary';
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
import { CONFIDENTIALITE_COPY, DISCLOSED_RECORDS, NEVER_STATEMENTS, WEB_STATEMENTS } from '@/lib/fr/confidentialite';
import { PURGE_AFTER_DAYS } from '@/lib/alerts/lifetimes';
import { DAYS_BEFORE } from '@/lib/rappel/window';

describePlaceholderCensus({
  page: '/confidentialite',
  Content: ConfidentialiteContent,
  fields: CONFIDENTIALITE_FIELDS,
  // The controller, its address, the DPO, the contact address and the host.
  minimumFields: 5,
  // R84, and the number is stated rather than derived: dpoContact, euRepresentative and chRepresentative. The two representatives are the GDPR Art. 27 and nLPD Art. 14 questions awaiting advice; the DPO is a fourth gap FW20c's prompt did not name.
  shippedPlaceholders: 3,
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

describe('the issuance record and the verification page (R329, R330)', () => {
  it('discloses what the issuance record holds and that the page shows only the printed fields', () => {
    const text = pageText().toLowerCase();

    // What it holds (R329) and the verification page behaviour (R330): it
    // shows what is printed, and never the account.
    expect(text).toContain('identifiant unique');
    expect(text).toContain('page de vérification');
    expect(text).toContain('jamais votre compte');
  });

  it('discloses that name-change DATES are kept, never the former value (R331)', () => {
    const text = pageText().toLowerCase();

    expect(text).toContain('modifié');
    // "ancienne valeur" without the elided article, so the assertion carries no
    // French elision literal outside lib/fr (R126).
    expect(text).toContain('ancienne valeur');
  });

  it('states how long the issuance records and name-change dates are kept', () => {
    const text = pageText().toLowerCase();

    expect(text).toContain('relevés que vous générez');
    expect(text).toContain('suppression de votre compte');
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

describe('R919: the deadline reminder, in one sentence, on the rendered page', () => {
  /** The rendered text, case kept: the sentence is compared whole. */
  const rendered = (): string =>
    render(<ConfidentialiteContent entity={FILLED_ENTITY} />).container.textContent ?? '';

  it('renders the third case: what is kept, why, until when', () => {
    expect(rendered()).toContain(DISCLOSED_RECORDS.deadlineReminder);
  });

  it('states the lead time and the purge with the constants the job and the purge use (R153, R181)', () => {
    expect(DISCLOSED_RECORDS.deadlineReminder).toContain(`${DAYS_BEFORE} jours`);
    expect(DISCLOSED_RECORDS.deadlineReminder).toContain(`${PURGE_AFTER_DAYS} jours`);
  });

  it('renders the lead counting three cases, before the cases it counts', () => {
    const text = rendered();

    expect(text).toContain(WEB_STATEMENTS.emailCases);
    expect(WEB_STATEMENTS.emailCases).toContain('trois cas seulement');
    expect(text.indexOf(WEB_STATEMENTS.emailCases)).toBeLessThan(text.indexOf(DISCLOSED_RECORDS.deadlineReminder));
  });
});

describe('R1222 (A6 F5b): what automatic mode sends, as the Data safety form declares it', () => {
  // docs/play-release.md section 2 declares Approximate location COLLECTED
  // (Android Ruling 18 Q-DS1): a day the person validated from a detection
  // proposal is sent and stored; a position never is. The page said only the
  // second half, under the "never recorded" heading. These assertions name
  // concepts, not the sentence (the file's own rule), and read the sentence
  // through its key (R206). No elided French here (R126).
  const rendered = (): string =>
    render(<ConfidentialiteContent entity={FILLED_ENTITY} />).container.textContent ?? '';

  it('renders the automatic-mode statement, by its key, in the never list', () => {
    expect(typeof NEVER_STATEMENTS.automaticMode).toBe('string');
    expect(CONFIDENTIALITE_COPY.never).toContain(NEVER_STATEMENTS.automaticMode);
    expect(rendered()).toContain(NEVER_STATEMENTS.automaticMode);
  });

  it('says the position is never sent AND the validated day is, with what detection proposed', () => {
    const statement = NEVER_STATEMENTS.automaticMode;

    expect(statement).toContain('jamais votre position');
    expect(statement).toContain('la journée que vous aurez validée');
    expect(statement).toContain('la détection vous avait proposé');
    expect(statement).toContain('sera enregistrée avec son origine');
  });

  it('points at the record it creates, and that record is rendered ABOVE it and names detection', () => {
    // "plus haut" is a claim about the layout, so the layout is asserted.
    const text = rendered();

    expect(NEVER_STATEMENTS.automaticMode).toContain('plus haut');
    expect(DISCLOSED_RECORDS.provenance).toContain('détection automatique');
    expect(text.indexOf(DISCLOSED_RECORDS.provenance)).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(DISCLOSED_RECORDS.provenance)).toBeLessThan(text.indexOf(NEVER_STATEMENTS.automaticMode));
  });
});

describe('the vocabulary SPEC section 20 forbids', () => {
  it('never claims the record is certified, attested or compliant', () => {
    // Through the shared guard, which distinguishes the CLAIM from the
    // document noun - "un certificat A1" is legitimate, "certifie" is not.
    // See tests/support/vocabulary.ts.
    expect(complianceClaims(pageText())).toEqual([]);
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
