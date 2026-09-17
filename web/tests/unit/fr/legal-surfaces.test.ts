// web/tests/unit/fr/legal-surfaces.test.ts
//
// RULING R183: THE SITE FOOTER AND THE DOCUMENT FOOTER CARRY DIFFERENT
// STRINGS.
//
// SPEC 12 item 6 specifies the timestamp sentence for THE DOCUMENT, where it
// is always true: every entry in an exported dossier carries a server
// recording timestamp, because there is no way to be in the dossier without
// one. SPEC 17.6 put the same $legal-01 token in the SITE footer, where the
// identical sentence is a claim about a PRODUCT STATE - and that claim was
// false on every public page from FW8 to FW20b.
//
// WHY THIS SUPERSEDES FW20b'S FIX. FW20b made the single shared string
// conditional on trackerExists (PARK-14). That was right about the defect and
// wrong about the remedy: one constant rendered on two surfaces has to be true
// on both, and the honest answer is two constants rather than a branch. It is
// R165's lifted-copy rule - copy retrofitted across surfaces is authored per
// instance or written generic, never taken from one and reused - arriving on
// a legal string.
//
// THE DOCUMENT'S STAYS VERBATIM AND UNCONDITIONAL, which is the half that
// would be easy to lose. Making BOTH strings conditional would be tidier and
// would be wrong: a dossier that omitted the timestamp sentence would be
// understating what it actually carries, and SPEC 12 specifies the wording.

import { describe, expect, it } from 'vitest';
import { LEGAL_COPY } from '@/lib/fr/legal';
import { PRODUCT_STATE, type ProductState } from '@/lib/content/product-state';

/** SPEC 12 item 6's clause, as the document must always carry it. */
const TIMESTAMP_CLAUSE = 'Chaque jour enregistré est horodaté par le service.';

const tracked: ProductState = { ...PRODUCT_STATE, trackerExists: true };
const untracked: ProductState = { ...PRODUCT_STATE, trackerExists: false };

describe('the document footer (SPEC 12 item 6)', () => {
  it('carries the timestamp clause, verbatim', () => {
    expect(LEGAL_COPY.documentStanding).toContain(TIMESTAMP_CLAUSE);
  });

  it('is a constant, not a function of product state', () => {
    // THE ASSERTION IS THE TYPE, and it is worth making because the obvious
    // "consistency" edit is to give this the same signature as the site's.
    // A document exists only once there are entries to put in it, so the
    // state that would make the clause false is a state in which the document
    // cannot be produced at all.
    expect(typeof LEGAL_COPY.documentStanding).toBe('string');
  });

  it('says what the site footer says about advice, because that part is shared', () => {
    expect(LEGAL_COPY.documentStanding).toContain('ne constitue pas un conseil fiscal');
  });
});

describe('the site footer (SPEC 17.6)', () => {
  it('omits the timestamp clause while there is no register', () => {
    expect(LEGAL_COPY.standing(untracked)).not.toContain(TIMESTAMP_CLAUSE);
  });

  it('carries it once the register exists', () => {
    expect(LEGAL_COPY.standing(tracked)).toContain(TIMESTAMP_CLAUSE);
  });

  it('is what the product renders today, and today it omits the clause', () => {
    // Pinned against the SHIPPED state rather than a constructed one, so this
    // fails the day trackerExists flips and somebody re-reads both surfaces.
    expect(PRODUCT_STATE.trackerExists, 'the register now exists - re-read both strings').toBe(
      false,
    );
    expect(LEGAL_COPY.standing(PRODUCT_STATE)).not.toContain(TIMESTAMP_CLAUSE);
  });
});

describe('the two surfaces are two strings', () => {
  it('differ today, which is the whole ruling', () => {
    expect(LEGAL_COPY.standing(PRODUCT_STATE)).not.toBe(LEGAL_COPY.documentStanding);
  });

  it('agree once the register exists, because then both sentences are true', () => {
    // NOT AN ACCIDENT AND WORTH ASSERTING. Two strings does not mean two
    // WORDINGS: the site's string converges on the document's the moment the
    // claim it makes becomes true. If these ever diverge in the tracked state,
    // one of the two surfaces has quietly acquired its own legal wording,
    // which is the drift R84's census exists to prevent.
    expect(LEGAL_COPY.standing(tracked)).toBe(LEGAL_COPY.documentStanding);
  });
});
