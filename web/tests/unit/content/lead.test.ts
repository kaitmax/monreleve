// web/tests/unit/content/lead.test.ts
//
// FW-CALCS-A2, R732. The comparator's "ne compare pas" list sets each item's
// first sentence (or, for a one-sentence item, its first clause) in bold. The
// lead is SPLIT from the item, never retyped, so lead + " " + rest is the item
// - asserted for every item the page renders, at the arguments it renders
// them with.

import { describe, expect, it } from 'vitest';
import { splitLead } from '@/lib/content/lead';
import { formatChf } from '@/lib/lamal/format';
import { COMPARATOR_YEARS, EXCHANGE_RATE } from '@/lib/lamal/years';
import { LAMAL_COPY } from '@/lib/fr/lamal';
import { formatDate } from '@/lib/ui/core';

const newest = COMPARATOR_YEARS.reduce((a, b) => (b.year > a.year ? b : a));
const ITEMS = LAMAL_COPY.limits(
  formatChf(newest.premiums.franchiseChf.adult * 100),
  formatDate(EXCHANGE_RATE.date),
);

describe('splitLead', () => {
  it('reassembles every item of the comparator’s list exactly', () => {
    expect(ITEMS.length).toBe(10);

    for (const item of ITEMS) {
      const { lead, rest } = splitLead(item);

      expect(rest === '' ? lead : `${lead} ${rest}`).toBe(item);
      expect(lead.length).toBeGreaterThan(0);
      expect(rest.length, item).toBeGreaterThan(0);
    }
  });

  it('takes the first sentence, else the first clause, else the whole item', () => {
    // Neutral strings: the real items are asserted above, and French copy
    // lives in lib/fr only (R126).
    expect(splitLead('Alpha beta. Gamma, delta.')).toEqual({ lead: 'Alpha beta.', rest: 'Gamma, delta.' });
    expect(splitLead('Alpha beta, gamma delta.')).toEqual({ lead: 'Alpha beta,', rest: 'gamma delta.' });
    expect(splitLead('Alpha')).toEqual({ lead: 'Alpha', rest: '' });
  });
});
