// web/tests/unit/fr/dossier.test.ts
//
// The document's own words. FW24 increment 5.
//
// The four standing copy guards (R91, R126, R147, R155) already scan this file
// along with every other lib/fr module - and caught two real violations on its
// first run. What they cannot check is what SPEC 12 asks of THIS document in
// particular, which is what this file is for.

import { describe, expect, it } from 'vitest';
import { DOSSIER_COPY } from '@/lib/fr/dossier';

/** Every string the module holds, functions included, flattened once. */
function everyString(value: unknown, sample = { fiscal: '40 %', social: '49,9 %' }): string[] {
  if (typeof value === 'string') return [value];

  if (typeof value === 'function') {
    // Called with plausible arguments so the RESULT is scanned too. A rule that
    // only looked at constants would miss every sentence that interpolates -
    // and the threshold sentence, the one SPEC 12 names explicitly, is a
    // function.
    try {
      return everyString((value as (...args: unknown[]) => unknown)(sample.fiscal, sample.social));
    } catch {
      try {
        return everyString((value as (...args: unknown[]) => unknown)(2026));
      } catch {
        return [];
      }
    }
  }

  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap((child) => everyString(child, sample));
  }

  return [];
}

const ALL = everyString(DOSSIER_COPY);

describe('the document exists at all', () => {
  it('found the strings, so nothing below passes vacuously', () => {
    // R63's shape. Every assertion in this file is "no string does X", and an
    // empty list satisfies all of them.
    expect(ALL.length).toBeGreaterThan(40);
    expect(ALL).toContain('Relevé annuel de télétravail');
  });
});

describe('SPEC 12: the vocabulary is constrained', () => {
  // THE FILE WHERE THIS MATTERS MOST. Auto-detection makes overclaiming
  // tempting - the product knows a great deal about where somebody was - and
  // overclaiming is the fastest way to make this document worthless in front of
  // an administration.
  it.each(['certifié', 'attesté', 'conforme', 'validé', 'approuvé'])(
    'never says %s',
    (forbidden) => {
      const offenders = ALL.filter((text) => text.toLowerCase().includes(forbidden));

      expect(offenders, `${forbidden} appears in the document`).toEqual([]);
    },
  );

  it('does say the words SPEC 12 permits, so the ban is not achieved by silence', () => {
    // BOTH DIRECTIONS. A document that said nothing about its own status would
    // pass all five bans above and tell a reader nothing about what it is.
    const joined = ALL.join(' ').toLowerCase();

    expect(joined).toContain('déclar');
    expect(joined).toContain('enregistr');
    expect(joined).toContain('horodat');
  });
});

describe('SPEC 12 item 3: the zone sentence names BOTH thresholds', () => {
  it('states the two figures it is given', () => {
    const sentence = DOSSIER_COPY.zone.thresholds('40 %', '49,9 %');

    expect(sentence).toContain('40 %');
    expect(sentence).toContain('49,9 %');
  });

  it('takes them as arguments rather than holding them', () => {
    // R73/R153: a string containing 40 would go stale on a rule change with
    // nothing failing. Called with different figures, the sentence must follow.
    const other = DOSSIER_COPY.zone.thresholds('35 %', '45 %');

    expect(other).toContain('35 %');
    expect(other).not.toContain('40 %');
  });

  it('says the two seuils are different administrations, not one rule twice', () => {
    // The single most common misreading of this product: that there is one
    // threshold with two numbers. The sentence has to prevent it.
    expect(DOSSIER_COPY.zone.thresholds('40 %', '49,9 %')).toMatch(/administration/u);
  });
});

describe('the status is a WORD, for the monochrome photocopy', () => {
  it('gives every badge a label that reads without colour', () => {
    // SPEC 12: every status carries a word as well as a colour, and the three
    // status tokens are the only colour in the file. A badge whose label was
    // "Attention" would depend on the colour to mean anything.
    for (const badge of [
      DOSSIER_COPY.zone.badgeUnder,
      DOSSIER_COPY.zone.badgeOverFiscal,
      DOSSIER_COPY.zone.badgeOverSocial,
    ]) {
      expect(badge.length).toBeGreaterThan(10);
      expect(badge.toLowerCase()).toMatch(/seuil/u);
    }
  });

  it('has exactly THREE badges, because the engine has three statuses (R240)', () => {
    // A `badgeNearFiscal` sat here unrendered until FW26. SPEC line 291 makes
    // the 30 % and 38 % steps IN-BAND ALERTS, "not new statuses", so a fourth
    // badge asserts a status the engine cannot produce - and the renderer's
    // three-way branch would read as missing a case rather than as complete.
    //
    // Asserted as a COUNT rather than by naming the absent one, because the
    // next speculative badge will have a different name.
    const badges = Object.keys(DOSSIER_COPY.zone).filter((key) => key.startsWith('badge'));

    expect(badges.sort()).toEqual(['badgeOverFiscal', 'badgeOverSocial', 'badgeUnder']);
  });

  it('distinguishes the two seuils in the badge labels themselves', () => {
    // A reader holding a photocopy must be able to tell WHICH threshold was
    // crossed. Two badges both reading "Seuil dépassé" would not.
    expect(DOSSIER_COPY.zone.badgeOverFiscal).not.toBe(DOSSIER_COPY.zone.badgeOverSocial);
    expect(DOSSIER_COPY.zone.badgeOverFiscal.toLowerCase()).toContain('imposition');
    expect(DOSSIER_COPY.zone.badgeOverSocial.toLowerCase()).toContain('sociale');
  });
});

describe('the annex says what its own marks mean', () => {
  it('explains the late flag without calling it a fault', () => {
    const note = DOSSIER_COPY.annex.lateNote;

    expect(note).toContain('Saisie tardive');
    // NOT A JUDGEMENT. SPEC 11.3 allows backfilling; the flag records when the
    // server heard, and the document should not editorialise about it.
    expect(note.toLowerCase()).not.toMatch(/retard|faute|oubli|manquement/u);
  });

  it('says which timestamp is the server one', () => {
    // The whole evidential claim. A reader seeing two dates must know which is
    // attributed by the server and which the device asserted.
    expect(DOSSIER_COPY.annex.deviceTimeNote.toLowerCase()).toContain('serveur');
    expect(DOSSIER_COPY.annex.lateNote.toLowerCase()).toContain('serveur');
  });

  it('prints unlogged days rather than skipping them', () => {
    // SPEC 12 item 5: a document that silently omits dates invites the question
    // of what else it omits.
    expect(DOSSIER_COPY.annex.notRecorded).toBe('Non renseigné');
  });

  it('keeps the three provenances distinct, which is what D17 asks', () => {
    const three = [
      DOSSIER_COPY.annex.provenanceManual,
      DOSSIER_COPY.annex.provenanceConfirmed,
      DOSSIER_COPY.annex.provenanceCorrected,
    ];

    expect(new Set(three).size).toBe(3);
  });
});

describe('R183: the document footer is unconditional', () => {
  it('states the server timestamp as a fact, with no product-state branch', () => {
    // The SITE footer's version is conditional on trackerExists, because there
    // the clause is a claim about what the product does. HERE it is always
    // true: every entry in an exported dossier carries a server timestamp, or
    // it would not be in the document.
    //
    // R183 exists because one constant rendered on two surfaces had to be true
    // on both, and the honest answer was two constants.
    expect(typeof DOSSIER_COPY.footer.timestamps).toBe('string');
    expect(DOSSIER_COPY.footer.timestamps).toContain('horodatage');
  });

  it('says the document rests on declarations, and is not advice', () => {
    expect(DOSSIER_COPY.footer.declaration.toLowerCase()).toContain('déclarations');
    expect(DOSSIER_COPY.footer.notAdvice.toLowerCase()).toContain('conseil fiscal');
  });
});
