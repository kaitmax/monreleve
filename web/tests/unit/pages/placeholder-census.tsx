// web/tests/unit/pages/placeholder-census.tsx
//
// RULING R84, once, for all three legal pages.
//
// "Each legal page declares the entity constants it consumes; the test asserts
// the rendered [A COMPLETER] count equals the number of those constants that
// are empty - N when N are empty, zero when all are filled."
//
// WHY A SHARED HELPER RATHER THAN THREE COPIES. Three transcriptions of the
// same census would drift, and the one that drifted would be the one nobody
// reread - a weaker version of the assertion passing quietly on the page that
// needed it most. Each page test still owns everything specific to it; only
// the count is shared.
//
// NOT A .test.tsx FILE, so vitest does not collect it: the include glob is
// tests/**/*.test.{ts,tsx}. It declares blocks when a real test file calls it.
//
// THE PER-FIELD SWEEP IS THE PART THAT MATTERS. Filling every field except one
// and demanding exactly one placeholder proves the field reaches the page, and
// reaches it ONCE. Without it a declaration could name a value the page never
// prints, or the prose could repeat one, and the all-empty total would still
// add up by accident. Both mutations were run against /mentions-legales and
// both went red - see REPORT-FW10.txt.

import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LEGAL_ENTITY,
  LEGAL_ENTITY_FIELDS,
  type LegalEntity,
  type LegalEntityField,
} from '@/lib/content/legal-entity';
import { LEGAL_PLACEHOLDER } from '@/lib/fr/legal';

/** A complete entity, so the "all filled" direction has something to render. */
export const FILLED_ENTITY: LegalEntity = Object.fromEntries(
  LEGAL_ENTITY_FIELDS.map((field) => [field, `valeur-${field}`]),
) as unknown as LegalEntity;

/** The value a filled field renders, so a page test can look for it. */
export function filledValue(field: LegalEntityField): string {
  return `valeur-${field}`;
}

interface CensusOptions {
  /** The route, for the test names. */
  readonly page: string;
  /** The page's prose component. Takes the entity, so both directions render. */
  readonly Content: (props: { readonly entity: LegalEntity }) => ReactNode;
  /** RULING R84's declaration: the constants this page consumes. */
  readonly fields: readonly LegalEntityField[];
  /** Below this the counts would be near-vacuous. */
  readonly minimumFields: number;
}

export function describePlaceholderCensus({
  page,
  Content,
  fields,
  minimumFields,
}: CensusOptions): void {
  afterEach(cleanup);

  function placeholders(entity: LegalEntity): number {
    const { container } = render(<Content entity={entity} />);
    const text = container.textContent ?? '';

    return text.split(LEGAL_PLACEHOLDER).length - 1;
  }

  describe(`${page} declares the constants it consumes`, () => {
    it('names only real entity fields', () => {
      for (const field of fields) {
        expect(LEGAL_ENTITY_FIELDS, field).toContain(field);
      }
    });

    it('names each field once', () => {
      expect(new Set(fields).size).toBe(fields.length);
    });

    it('names enough of them that the counts below are not vacuous', () => {
      // An emptied declaration would make every assertion here read 0 === 0.
      expect(fields.length).toBeGreaterThanOrEqual(minimumFields);
    });
  });

  describe(`${page} renders exactly as many placeholders as it has gaps (R84)`, () => {
    it('one per declared constant while all are empty', () => {
      // The shipped state: every declared field is empty, so every one of them
      // prints a placeholder - no more, and no fewer.
      expect(placeholders(LEGAL_ENTITY)).toBe(fields.length);
    });

    it('none once every constant is filled', () => {
      expect(placeholders(FILLED_ENTITY)).toBe(0);
    });

    it.each([...fields])('exactly one when only %s is empty', (field) => {
      expect(placeholders({ ...FILLED_ENTITY, [field]: '' })).toBe(1);
    });
  });

  describe(`${page} prints the values, not only the labels`, () => {
    it('shows every declared value once filled', () => {
      // The counterweight to the assertions above: a page that printed nothing
      // at all would score zero placeholders on a filled entity and pass.
      const { container } = render(<Content entity={FILLED_ENTITY} />);
      const text = container.textContent ?? '';

      for (const field of fields) {
        expect(text, field).toContain(filledValue(field));
      }
    });
  });
}

/**
 * SPEC section 20's vocabulary, over a whole copy module rather than over the
 * rendered page.
 *
 * WHY BOTH. The rendered-text version of this check is in each page test and
 * catches words that arrive from anywhere - a term, an entity value, a helper.
 * It cannot see the strings that are NOT rendered, and the meta description is
 * one of those: it goes into search results, which is arguably the worst place
 * to claim the service is "conforme au RGPD". Found by probing exactly that
 * edit and watching the page test stay green.
 *
 * Declare, enregistre, horodate - never certifie, atteste, conforme. A legal
 * page is where a well-meaning edit reaches for all three.
 */
export function expectNoComplianceClaims(copy: object): void {
  const offenders: string[] = [];

  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      for (const banned of ['certifi', 'attest', 'conforme']) {
        if (value.toLowerCase().includes(banned)) offenders.push(`${path}: ${banned}`);
      }

      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));

      return;
    }

    if (value !== null && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) walk(item, `${path}.${key}`);
    }
  };

  walk(copy, 'copy');

  expect(offenders, offenders.join(' | ')).toEqual([]);
}

/** Guards the walker above: a nested claim must actually be found. */
export function complianceClaimsIn(copy: object): number {
  try {
    expectNoComplianceClaims(copy);

    return 0;
  } catch {
    return 1;
  }
}
