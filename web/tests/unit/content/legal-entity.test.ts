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

const STILL_OPEN = [
  'chRepresentative',
  'dpoContact',
  'euRepresentative',
] as const;

describe('the shipped constants are empty, deliberately', () => {
  /**
   * THE FOUR STILL OPEN, NAMED RATHER THAN COUNTED.
   *
   * FW10 shipped all nine empty and this asserted exactly that. FW20c filled
   * twelve of sixteen from values the operator verified against Companies
   * House and OVHcloud's legal pages, so the assertion changes shape: it now
   * names WHICH are open, because a count alone is satisfied by any four and
   * the identity of these four is the whole point.
   *
   * dpoContact IS THE FOURTH AND FW20c'S PROMPT NAMED ONLY THREE. It is not
   * an oversight in the fill - no DPO has been appointed - but it is a gap
   * the prompt did not account for, raised as a question rather than closed
   * by guessing.
   */
  it('leaves exactly the four open fields empty', () => {
    // The whole point of R52. A default that guessed - "Mon Relevé SAS" -
    // would be a claim about a company that does not exist, printed on the
    // page where a reader is most entitled to rely on it.
    for (const field of STILL_OPEN) {
      expect(LEGAL_ENTITY[field], field).toBe('');
    }
  });

  it('fills every other field, so the placeholders that remain are the real gaps', () => {
    const open = new Set<string>(STILL_OPEN);

    for (const field of LEGAL_ENTITY_FIELDS) {
      if (open.has(field)) continue;

      expect(LEGAL_ENTITY[field].trim(), `${field} is empty and is not a declared gap`).not.toBe(
        '',
      );
    }
  });

  it('names the natural person French law requires, supplied and not inferred', () => {
    // THE FIELD FLIPPED ON 18.09.2026 and the rule that kept it empty is the
    // reason it is trustworthy now: it could only ever be filled by somebody
    // telling us. A git author, a commit trailer or a Companies House officer
    // would each have been a claim about a person s legal responsibility made
    // by a script.
    //
    // SO THE ASSERTION IS THAT IT DOES NOT MATCH THE PLACES IT COULD HAVE
    // BEEN INFERRED FROM. It is not the company, and it is not the git
    // identity - which is what a future automated fill would reach for.
    expect(LEGAL_ENTITY.publicationDirector).toBe('Khalid Ait mouna');
    expect(LEGAL_ENTITY.publicationDirector).not.toBe(LEGAL_ENTITY.legalName);
    expect(LEGAL_ENTITY.publicationDirector).not.toContain('LTD');
  });

  it('is not complete', () => {
    expect(isComplete(LEGAL_ENTITY)).toBe(false);
  });

  it('reports exactly the four open fields as missing', () => {
    // It compared against the WHOLE field list while all nine were empty,
    // which was true and is no longer. Naming them keeps the assertion about
    // WHICH are open rather than how many.
    expect([...missingFields(LEGAL_ENTITY)].sort()).toEqual([...STILL_OPEN].sort());
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

  it('covers the sixteen values the legal pages need', () => {
    // NINE AT FW10, SIXTEEN AT FW20c. Seven arrived with the filled values:
    // an incorporation date, the host's telephone, website and registration -
    // the LCEN asks for the telephone - and three that are deliberately empty
    // so the pages state them as gaps rather than omitting them.
    expect([...LEGAL_ENTITY_FIELDS].sort()).toEqual(
      [
        'address',
        'chRepresentative',
        'contactEmail',
        'dataController',
        'dpoContact',
        'euRepresentative',
        'hostingAddress',
        'hostingPhone',
        'hostingProvider',
        'hostingRegistration',
        'hostingWebsite',
        'incorporatedOn',
        'legalForm',
        'legalName',
        'publicationDirector',
        'registrationNumber',
      ].sort(),
    );
  });
});

describe('the render helper', () => {
  it('returns the placeholder for an empty field', () => {
    // legalName IS FILLED NOW, so the empty case needs a field that is still
    // open - which is the point of naming them rather than counting them.
    expect(entityValue(LEGAL_ENTITY, 'euRepresentative')).toBe(LEGAL_PLACEHOLDER);
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
    expect(entityValue(LEGAL_ENTITY, 'euRepresentative')).toBe(LEGAL_PLACEHOLDER);
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
