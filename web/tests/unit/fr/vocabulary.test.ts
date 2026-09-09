// web/tests/unit/fr/vocabulary.test.ts
//
// The guard's own test. tests/support/vocabulary.ts decides what counts as a
// forbidden claim on every page and in every head; a guard nobody checks is a
// guard that eventually permits everything, and this one has already been
// wrong once in the over-strict direction.
//
// WHAT WENT WRONG THE FIRST TIME. The check banned the substrings 'certifi',
// 'attest' and 'conforme'. It then failed FW11's calculator copy for the
// sentence "l'accord-cadre europeen ... suppose un CERTIFICAT A1 en cours de
// validite" - the name of a document SPEC 7.1 itself calls "a valid A1
// certificate". A product forbidden from naming it cannot explain the rule it
// exists to track, and 'attest' would have forbidden SPEC 9.5's launch guide
// at /guides/attestation-employeur-teletravail.
//
// BOTH DIRECTIONS ARE ASSERTED HERE, and the permissive one matters as much:
// loosening a guard to unblock yourself is how guards die, so the claims it
// must still catch are listed beside the nouns it must now allow.

import { describe, expect, it } from 'vitest';
import {
  CLAIM_PATTERNS,
  FORBIDDEN_CLAIMS,
  PERMITTED_NOUNS,
  complianceClaims,
} from '@/tests/support/vocabulary';

describe('the claims SPEC section 20 forbids', () => {
  it.each([...FORBIDDEN_CLAIMS])('catches %s', (claim) => {
    expect(complianceClaims(claim).length).toBeGreaterThan(0);
  });

  it('has something to catch, so the loop is not vacuous', () => {
    expect(FORBIDDEN_CLAIMS.length).toBeGreaterThanOrEqual(8);
  });
});

describe('the document nouns it must permit', () => {
  it.each([...PERMITTED_NOUNS])('allows %s', (noun) => {
    expect(complianceClaims(noun)).toEqual([]);
  });

  it('permits the exact sentence that exposed the over-strict version', () => {
    // Verbatim from lib/fr/calculateur.ts. If this ever fails, the guard has
    // drifted back to a substring match and the calculator's copy is blocked.
    const sentence =
      "À partir d'un quart de télétravail, l'accord-cadre européen s'applique " +
      'et suppose un certificat A1 en cours de validité.';

    expect(complianceClaims(sentence)).toEqual([]);
  });
});

describe('the patterns themselves', () => {
  it('names each pattern, so a failure says which rule it broke', () => {
    // The message a developer sees is the whole value of the guard at 2 a.m.
    expect(complianceClaims('un relevé certifié')).toEqual(['certifié / certifie / certifier']);
    expect(complianceClaims('des relevés conformes')).toEqual([
      'conforme / conformes / conformité',
    ]);
  });

  it('reports every claim in a text carrying more than one', () => {
    const both = 'nos relevés certifiés sont conformes';

    expect(complianceClaims(both)).toHaveLength(2);
  });

  it('is case-insensitive, because a heading may be capitalised', () => {
    expect(complianceClaims('Relevé CERTIFIÉ')).toHaveLength(1);
  });

  it('leaves "conformément" alone', () => {
    // "conformément à la réglementation" describes what a rule requires; it
    // does not claim the record satisfies it. The accented e also means it
    // cannot match the whole-word pattern, which is belt and braces.
    expect(complianceClaims("conformément à l'article 10")).toEqual([]);
  });

  it('still catches "conformité", which IS a claim', () => {
    expect(complianceClaims('la conformité de nos relevés')).toHaveLength(1);
  });

  it('carries three patterns and no more', () => {
    // SPEC section 20 names three words. A fourth would be a decision.
    expect(CLAIM_PATTERNS).toHaveLength(3);
  });
});
