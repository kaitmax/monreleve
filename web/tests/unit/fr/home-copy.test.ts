// web/tests/unit/fr/home-copy.test.ts
//
// FW34's home body, the guards that do not need a browser (§7.2 items 6, 7, 8
// and the trust-date function). The served-page versions - every interpolation
// delivered into the HTML, the present-tense and vocabulary sweeps, the
// reachability census, D40 and the mobile layout - live in e2e/home.spec.ts.

import { describe, expect, it } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';
import { HOME_COPY } from '@/lib/fr';
import { SHELL_COPY } from '@/lib/fr/shell';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { SOURCE_ENTRIES } from '@/lib/content/sources';
import { currentTaxYear } from '@/lib/content/tax-year';
import { guideScope } from '@/lib/guides/scope';
import { publishedGuides } from '@/lib/guides/registry';
import { formatDate } from '@/lib/ui/core';

const SCOPE = guideScope(currentTaxYear());

// FD11's five card-2 topic slugs, in its order (mirrors page.tsx).
const CARD_TWO_TOPICS = [
  'teletravail-frontalier-40-pourcent',
  'seuil-social-49-9-pourcent',
  'jours-de-mission-hors-suisse',
  'attestation-employeur-teletravail',
  'droit-option-lamal-cmu',
];

describe('every regulatory block carries a non-empty SourceId[] (§7.2 item 7)', () => {
  const blocks: ReadonlyArray<readonly [string, readonly string[]]> = [
    ['hero lead 1 (fiscal)', HOME_COPY.lead.fiscal.sources],
    ['hero lead 2 (social)', HOME_COPY.lead.social.sources],
    ['card 1 (calculator)', HOME_COPY.cards.calculator.sources],
    ['Pourquoi 01', HOME_COPY.pourquoi.items[0].sources],
    ['Pourquoi 03', HOME_COPY.pourquoi.items[2].sources],
  ];

  for (const [name, sources] of blocks) {
    it(`${name} cites at least one source`, () => {
      expect(sources.length).toBeGreaterThan(0);
    });
  }
});

describe('the typed date beside {fiscal} is pinned to the engine (§7.2 item 7 tripwire)', () => {
  it('fails if the current year diverges from 2026', () => {
    expect(
      ruleSetFor(currentTaxYear()).fiscalCeiling,
      'The current tax year\'s fiscal ceiling differs from 2026. The literal ' +
        '"1er janvier 2026" typed beside {fiscal} is now a stale date-figure ' +
        'pairing in TWO places: the home hero lead (HOME_COPY.lead.fiscal) and ' +
        'the pillar opener (teletravail-frontalier-40-pourcent.mdx).',
    ).toBe(ruleSetFor(2026).fiscalCeiling);
  });
});

describe('the hero lead and the meta description stay different sentences (R206, §7.2 item 8)', () => {
  it('neither contains the other', () => {
    const lead = [
      HOME_COPY.lead.fiscal.text(SCOPE.fiscal),
      HOME_COPY.lead.social.text(SCOPE.social, SCOPE.a1Threshold),
      HOME_COPY.lead.tracker(PRODUCT_STATE),
    ].join(' ');
    const description = HOME_COPY.description(SCOPE.fiscal, SCOPE.social, PRODUCT_STATE);

    expect(lead.includes(description)).toBe(false);
    expect(description.includes(lead)).toBe(false);
  });
});

describe('card 2 derives its count and topics (§7.2 item 6)', () => {
  it('writes the count in words and changes with the number', () => {
    expect(HOME_COPY.cards.guides.body(7, 'les sujets')).toContain('Sept');
    expect(HOME_COPY.cards.guides.body(8, 'les sujets')).toContain('Huit');
    expect(HOME_COPY.cards.guides.body(7, 'les sujets')).not.toContain('Huit');
  });

  it('has at least five published guides, so "Un guides" cannot occur', () => {
    expect(publishedGuides().length).toBeGreaterThanOrEqual(5);
  });

  it('the five card-2 topics are published guides whose labels it will show', () => {
    for (const slug of CARD_TWO_TOPICS) {
      const guide = publishedGuides().find((one) => one.frontmatter.slug === slug);

      expect(guide, `card-2 topic is not a published guide: ${slug}`).toBeDefined();
      expect((guide?.frontmatter.breadcrumbLabel ?? '').length).toBeGreaterThan(0);
    }
  });
});

describe('the trust verification date is a pure function of review (§5.3, §7.2 item 5)', () => {
  it('shows the formatted date, with its sentence, when a date is set', () => {
    expect(HOME_COPY.trust.verification.status('2026-09-09', SHELL_COPY.reviewPending)).toBe(
      formatDate('2026-09-09'),
    );
    expect(HOME_COPY.trust.verification.body('2026-09-09')).not.toBeNull();
  });

  it('shows the pending notice and no second sentence when null (R51)', () => {
    expect(HOME_COPY.trust.verification.status(null, SHELL_COPY.reviewPending)).toBe(
      SHELL_COPY.reviewPending,
    );
    expect(HOME_COPY.trust.verification.body(null)).toBeNull();
  });
});

describe('the hero and cards interpolate their thresholds (R154, function level)', () => {
  it('delivers fiscal, social and a1Threshold into the sentences that name them', () => {
    expect(HOME_COPY.heading(SCOPE.fiscal)).toContain(SCOPE.fiscal);
    expect(HOME_COPY.lead.fiscal.text(SCOPE.fiscal)).toContain(SCOPE.fiscal);
    expect(HOME_COPY.lead.social.text(SCOPE.social, SCOPE.a1Threshold)).toContain(SCOPE.social);
    expect(HOME_COPY.lead.social.text(SCOPE.social, SCOPE.a1Threshold)).toContain(SCOPE.a1Threshold);
    expect(HOME_COPY.cards.calculator.body(SCOPE.fiscal, SCOPE.social)).toContain(SCOPE.fiscal);
    expect(HOME_COPY.cards.calculator.body(SCOPE.fiscal, SCOPE.social)).toContain(SCOPE.social);
  });

  it('names the publishers it is handed, in the SOURCES column', () => {
    const publishers = [...new Set(SOURCE_ENTRIES.map((entry) => entry.sourceName))].join(', ');

    expect(HOME_COPY.trust.sources.body(publishers)).toContain(publishers);
  });
});
