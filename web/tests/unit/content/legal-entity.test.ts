// web/tests/unit/content/legal-entity.test.ts
//
// RULING R52: the legal entity, its address, the data controller and the
// hosting details are open questions (SPEC 22, question 14). The three legal
// pages are written in full French with every entity-specific value as a
// VISIBLE [A COMPLETER] placeholder, collected in one module so the operator
// fills it once.
//
// RULING R84 makes the test exact: each legal page declares the constants it
// consumes, and the rendered placeholder count equals the number of those
// constants that are empty - N when N are empty, zero when all are filled.
// That exactness is what this module's helpers exist to support, and it is
// stronger than it looks: a page that quietly stopped rendering a value would
// LOWER the count, so the assertion catches an omission as well as a leak.
//
// WHITESPACE COUNTS AS EMPTY. A single space would satisfy a length check and
// print as nothing, which is the one failure mode R52 exists to prevent: a
// legal page that looks filled in and states no company name.

import { describe, expect, it } from 'vitest';
import {
  LEGAL_ENTITY,
  LEGAL_ENTITY_FIELDS,
  entityValue,
  isComplete,
  missingFields,
  type LegalEntity,
} from '@/lib/content/legal-entity';
import { LEGAL_PLACEHOLDER } from '@/lib/fr/legal';

/** Every field filled, for the "all filled" direction. */
const FILLED: LegalEntity = Object.fromEntries(
  LEGAL_ENTITY_FIELDS.map((field) => [field, `valeur-${field}`]),
) as unknown as LegalEntity;

describe('the shipped constants are empty, deliberately', () => {
  it('has every field empty', () => {
    // The whole point of R52. A default that guessed - "frontalier SAS" - would
    // be a claim about a company that does not exist yet, printed on the page
    // where a reader is most entitled to rely on it.
    for (const field of LEGAL_ENTITY_FIELDS) {
      expect(LEGAL_ENTITY[field], field).toBe('');
    }
  });

  it('is not complete', () => {
    expect(isComplete(LEGAL_ENTITY)).toBe(false);
  });

  it('reports every field as missing', () => {
    expect([...missingFields(LEGAL_ENTITY)].sort()).toEqual([...LEGAL_ENTITY_FIELDS].sort());
  });
});

describe('the field list matches the shape, so nothing can be forgotten', () => {
  it('lists exactly the keys of the entity', () => {
    // Two sources of truth - the interface and the array - and this is what
    // keeps them one. A field added to the interface but not the array would
    // never be checked for emptiness and would never print a placeholder.
    expect([...LEGAL_ENTITY_FIELDS].sort()).toEqual(Object.keys(LEGAL_ENTITY).sort());
  });

  it('lists each field once', () => {
    expect(new Set(LEGAL_ENTITY_FIELDS).size).toBe(LEGAL_ENTITY_FIELDS.length);
  });

  it('covers the nine values the prompt names', () => {
    expect([...LEGAL_ENTITY_FIELDS].sort()).toEqual([
      'address',
      'contactEmail',
      'dataController',
      'dpoContact',
      'hostingAddress',
      'hostingProvider',
      'legalName',
      'legalForm',
      'registrationNumber',
    ].sort());
  });
});

describe('the render helper', () => {
  it('returns the placeholder for an empty field', () => {
    expect(entityValue(LEGAL_ENTITY, 'legalName')).toBe(LEGAL_PLACEHOLDER);
  });

  it('returns the value for a filled field', () => {
    expect(entityValue(FILLED, 'legalName')).toBe('valeur-legalName');
  });

  it('takes the placeholder from lib/fr rather than declaring one', () => {
    // A second copy of the string would be a second thing to change, and the
    // page test counts occurrences OF THE lib/fr ONE - so a drifted copy would
    // read as zero placeholders on a page full of them.
    expect(LEGAL_PLACEHOLDER).toContain('COMPLÉTER');
    expect(LEGAL_PLACEHOLDER).toBe('[À COMPLÉTER]');
    expect(entityValue(LEGAL_ENTITY, 'address')).toBe(LEGAL_PLACEHOLDER);
  });

  it('trims, so a value of spaces is still missing', () => {
    const spaces: LegalEntity = { ...FILLED, legalName: '   ' };

    expect(entityValue(spaces, 'legalName')).toBe(LEGAL_PLACEHOLDER);
    expect(missingFields(spaces)).toEqual(['legalName']);
    expect(isComplete(spaces)).toBe(false);
  });

  it('does not trim a real value away', () => {
    const padded: LegalEntity = { ...FILLED, address: '  12 rue des Alpes  ' };

    expect(entityValue(padded, 'address')).toBe('12 rue des Alpes');
  });
});

describe('a filled set', () => {
  it('is complete and has nothing missing', () => {
    expect(isComplete(FILLED)).toBe(true);
    expect(missingFields(FILLED)).toEqual([]);
  });

  it('renders no placeholder for any field', () => {
    for (const field of LEGAL_ENTITY_FIELDS) {
      expect(entityValue(FILLED, field), field).not.toBe(LEGAL_PLACEHOLDER);
    }
  });
});
