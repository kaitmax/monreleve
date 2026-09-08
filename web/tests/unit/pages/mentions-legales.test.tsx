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

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MENTIONS_LEGALES_FIELDS,
  MentionsLegalesContent,
} from '@/app/(public)/mentions-legales/MentionsLegalesContent';
import {
  LEGAL_ENTITY,
  LEGAL_ENTITY_FIELDS,
  type LegalEntity,
  type LegalEntityField,
} from '@/lib/content/legal-entity';
import { LEGAL_PLACEHOLDER } from '@/lib/fr/legal';

afterEach(cleanup);

/** A complete entity, so the "all filled" direction has something to render. */
const FILLED: LegalEntity = Object.fromEntries(
  LEGAL_ENTITY_FIELDS.map((field) => [field, `valeur-${field}`]),
) as unknown as LegalEntity;

function except(field: LegalEntityField): LegalEntity {
  return { ...FILLED, [field]: '' };
}

function placeholders(entity: LegalEntity): number {
  const { container } = render(<MentionsLegalesContent entity={entity} />);
  const text = container.textContent ?? '';

  return text.split(LEGAL_PLACEHOLDER).length - 1;
}

describe('the declaration itself', () => {
  it('names only real entity fields', () => {
    for (const field of MENTIONS_LEGALES_FIELDS) {
      expect(LEGAL_ENTITY_FIELDS, field).toContain(field);
    }
  });

  it('names each field once', () => {
    expect(new Set(MENTIONS_LEGALES_FIELDS).size).toBe(MENTIONS_LEGALES_FIELDS.length);
  });

  it('is not empty, so the counts below are not vacuous', () => {
    // An emptied declaration would make every assertion here read "0 === 0".
    // Mentions legales names the editor and the host at minimum.
    expect(MENTIONS_LEGALES_FIELDS.length).toBeGreaterThanOrEqual(5);
  });
});

describe('the placeholder count is exact (R84)', () => {
  it('equals the number of declared constants while all are empty', () => {
    // The shipped state. Every declared field is empty, so every one of them
    // prints a placeholder - no more, no fewer.
    expect(placeholders(LEGAL_ENTITY)).toBe(MENTIONS_LEGALES_FIELDS.length);
  });

  it('is zero once every constant is filled', () => {
    expect(placeholders(FILLED)).toBe(0);
  });

  it.each([...MENTIONS_LEGALES_FIELDS])('is exactly one when only %s is empty', (field) => {
    // Per-field, so each declared constant is proved to reach the page - and
    // to reach it once. See the module comment.
    expect(placeholders(except(field))).toBe(1);
  });
});

describe('the values actually render', () => {
  it('prints each filled value, so the page is not only labels', () => {
    const { container } = render(<MentionsLegalesContent entity={FILLED} />);
    const text = container.textContent ?? '';

    for (const field of MENTIONS_LEGALES_FIELDS) {
      expect(text, field).toContain(`valeur-${field}`);
    }
  });
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
    const { container } = render(<MentionsLegalesContent entity={FILLED} />);
    const text = (container.textContent ?? '').toLowerCase();

    for (const banned of ['certifi', 'attest', 'conforme']) {
      expect(text, banned).not.toContain(banned);
    }
  });
});
