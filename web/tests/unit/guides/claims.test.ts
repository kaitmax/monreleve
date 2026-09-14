// web/tests/unit/guides/claims.test.ts
//
// RULING R146, THE SOURCE RULE, and it governs FW17 and FW18 entirely.
//
// "Every regulatory statement in a guide is either (a) traceable to a line in
// docs/regulatory-sources.md that is TRANSCRIPTION VERIFIED, or (b) written
// as an open question naming its uncertainty, or (c) not written. There is no
// fourth option."
//
// WHY IT IS A TEST AND NOT A REVIEW. A guide is the surface where this
// product's credibility is earned or lost, and it is read by people who will
// ACT on it - a frontalier deciding whether to work a third day from home in
// November. The failure mode is not a wrong number, which somebody would
// catch. It is a plausible paraphrase: a sentence that sounds like the rule,
// was written from memory, and cites nothing. Nothing in a French prose file
// distinguishes that from a sourced one, which is why the citation has to be
// structural.
//
// THE KEY UNIVERSE IS THE PRODUCT'S OWN REGISTRY - the eight rows of
// docs/regulatory-sources.md and the three provisional readings, as
// lib/content/sources.ts and lib/content/provisional.ts already hold them.
// An invented key is the worst failure available here, because it reads as
// sourced.
//
// TWO ROWS ARE PENDING and that is the whole reason case (b) exists:
// dayClassification and residence1983Cantons were NOT reached by the
// 09.09.2026 pass - the published cases count days rather than hours, and
// Geneve is a source canton. /sources already says so publicly. A guide may
// use them only in prose that says so too.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLISHED_PROVISIONAL_IDS } from '@/lib/content/provisional';
import { SOURCE_ENTRIES, SOURCE_IDS } from '@/lib/content/sources';
import { CLAIM_KEYS, frontmatterSchema } from '@/lib/guides/frontmatter';
import { allGuides } from '@/lib/guides/registry';
import type { Guide } from '@/lib/guides/registry';

/** Rows the Checkpoint A pass actually read. R146's case (a). */
const VERIFIED = new Set<string>(
  SOURCE_ENTRIES.filter((entry) => entry.status === 'transcribed').map((entry) => entry.id),
);

/** Rows it could not reach, plus the three open readings. R146's case (b). */
const UNRESOLVED = new Set<string>([
  ...SOURCE_ENTRIES.filter((entry) => entry.status === 'pending').map((entry) => entry.id),
  ...PUBLISHED_PROVISIONAL_IDS,
]);

/** Where an article must send a reader whose claim is not settled. */
const SOURCES_PATH = '/sources';

describe('the key universe is the product registry, not a list kept here', () => {
  it('is the eight source rows plus the three provisional readings', () => {
    expect([...CLAIM_KEYS].sort()).toEqual(
      [...SOURCE_IDS, ...PUBLISHED_PROVISIONAL_IDS].sort(),
    );
  });

  it('splits into six verified and five unresolved, which is the state of the record', () => {
    // NON-VACUITY WITH TEETH: if a future pass verified the two pending rows,
    // this fails and whoever did it updates the guides' hedging in the same
    // change. The numbers are the record of 09.09.2026, not a preference.
    expect(VERIFIED.size).toBe(6);
    expect(UNRESOLVED.size).toBe(5);
    expect([...UNRESOLVED].sort()).toEqual(
      ['P1', 'P2', 'P3', 'dayClassification', 'residence1983Cantons'].sort(),
    );
  });
});

/**
 * The rule, as a function, so the test and the report agree on what it says.
 *
 * Returns the reasons an article fails R146, empty when it complies.
 */
function violations(guide: Guide): string[] {
  const found: string[] = [];
  const { claims, slug } = guide.frontmatter;

  for (const claim of claims) {
    // (a) traceable to a verified row.
    if (VERIFIED.has(claim.key) && !claim.unresolved) continue;

    // A verified row marked unresolved is its own kind of lie: it tells a
    // reader the rule is open when the record says it was read off the
    // source.
    if (VERIFIED.has(claim.key) && claim.unresolved) {
      found.push(`${slug}: ${claim.key} is verified but is marked unresolved`);
      continue;
    }

    // (b) an open question naming its uncertainty, and linking /sources.
    if (!claim.unresolved) {
      found.push(
        `${slug}: ${claim.key} is not a verified row and is not marked unresolved`,
      );
      continue;
    }

    if (!guide.body.includes(SOURCES_PATH)) {
      found.push(`${slug}: ${claim.key} is unresolved but the article does not link ${SOURCES_PATH}`);
    }

    // The disclosure must be visible as a disclosure, not buried in a
    // sentence. The kit's warning block is what the article has for that.
    if (!guide.body.includes('<Avertissement>')) {
      found.push(`${slug}: ${claim.key} is unresolved but the article carries no Avertissement`);
    }
  }

  return found;
}

describe('every claim in every article resolves', () => {
  it('reads the articles on disk, so nothing below passes vacuously', () => {
    expect(allGuides().length).toBeGreaterThan(0);
  });

  it('reports no violation for what is written today', () => {
    const found = allGuides().flatMap(violations);

    expect(found, found.join('\n')).toEqual([]);
  });

  it('names a source key for every regulatory figure the prose carries', () => {
    // THE HALF A SCHEMA CANNOT CHECK. `claims` being well-formed says nothing
    // about whether it is COMPLETE - an article can assert the 40 % ceiling
    // and declare no claim at all. So: any article whose prose carries a
    // regulatory figure must declare at least one claim.
    //
    // R147's test is the sharper instrument and runs beside this one; this
    // catches the case where a figure arrives through an expression (which
    // R147 permits) with no citation behind it.
    for (const guide of allGuides()) {
      const carriesFigure = /\{[^}]*(fiscal|social|basis|missionCap|a1)/i.test(guide.body);

      if (!carriesFigure) continue;

      expect(
        guide.frontmatter.claims.length,
        `${guide.frontmatter.slug} renders a RuleSet figure and declares no claim`,
      ).toBeGreaterThan(0);
    }
  });
});

describe('R146 refuses what it is for', () => {
  const base = {
    title: 'Un titre assez long',
    description:
      'Une description assez longue pour passer le contrat de frontmatter sans se plaindre.',
    slug: 'un-article',
    cluster: 'cluster' as const,
    related: [],
    lastReviewed: '2026-09-09',
    reviewer: 'FW17',
    faq: [],
  };

  const withClaims = (claims: unknown): Guide => ({
    file: 'un-article.mdx',
    frontmatter: frontmatterSchema.parse({ ...base, claims }),
    body: 'Du texte avec [les sources](/sources).\n\n<Avertissement>\nUne reserve.\n</Avertissement>',
  });

  it('REFUSES AN INVENTED KEY at the schema, before any prose is read', () => {
    // The worst failure available on this surface: a citation that reads as
    // sourced and names nothing. It fails at parse, so an article carrying
    // one cannot build.
    expect(() =>
      frontmatterSchema.parse({
        ...base,
        claims: [{ key: 'avenantDe2023', says: 'Le plafond fiscal est de 40 pour cent.' }],
      }),
    ).toThrow();
  });

  it('REFUSES A PENDING KEY USED AS IF IT WERE SETTLED', () => {
    // residence1983Cantons is row 7: NOT reached by the 09.09.2026 pass,
    // because Geneve is a source canton and no published example gets there.
    // Stated flatly, it would be the product asserting something nobody has
    // checked - in the paragraph the prompt calls the most consequential in
    // the pillar.
    const guide = withClaims([
      {
        key: 'residence1983Cantons',
        says: 'Huit cantons relevent de l accord de 1983 et le statut y est en jeu.',
      },
    ]);

    expect(violations(guide)).toEqual([
      'un-article: residence1983Cantons is not a verified row and is not marked unresolved',
    ]);
  });

  it('accepts the same key once the prose names it unresolved and links /sources', () => {
    // R146 case (b), which is the whole point of having a case (b): the
    // article may still tell a reader about the distinction, as long as it
    // tells them what is and is not established.
    const guide = withClaims([
      {
        key: 'residence1983Cantons',
        says: 'Huit cantons relevent de l accord de 1983 et le statut y est en jeu.',
        unresolved: true,
      },
    ]);

    expect(violations(guide)).toEqual([]);
  });

  it('refuses an unresolved claim in an article that links no sources', () => {
    const guide: Guide = {
      ...withClaims([{ key: 'P1', says: 'L ordre d imputation reste ouvert.', unresolved: true }]),
      body: 'Du texte sans lien ni reserve.',
    };

    expect(violations(guide)).toHaveLength(2);
  });

  it('refuses a VERIFIED row marked unresolved, which is the opposite lie', () => {
    const guide = withClaims([
      {
        key: 'fiscalCeiling',
        says: 'Le plafond fiscal vaut quarante pour cent du temps de travail.',
        unresolved: true,
      },
    ]);

    expect(violations(guide)).toEqual([
      'un-article: fiscalCeiling is verified but is marked unresolved',
    ]);
  });

  it('accepts a verified key with no hedging, which is case (a)', () => {
    const guide = withClaims([
      {
        key: 'fiscalCeiling',
        says: 'Le plafond fiscal vaut quarante pour cent du temps de travail.',
      },
    ]);

    expect(violations(guide)).toEqual([]);
  });
});

describe('the registry this test trusts is the one the site publishes', () => {
  it('matches docs/regulatory-sources.md on which rows are pending', () => {
    // The document is the record; lib/content/sources.ts is what the site
    // renders from. If they disagreed, /sources would tell a reader one
    // thing and this test would enforce another.
    const doc = readFileSync(
      join(process.cwd(), '..', 'docs', 'regulatory-sources.md'),
      'utf8',
    );

    expect(doc).toContain('TRANSCRIPTION VERIFIED');

    for (const id of ['dayClassification', 'residence1983Cantons']) {
      expect(UNRESOLVED.has(id), `${id} must be pending`).toBe(true);
    }

    // The document names both pending rows in the same sentence, and says
    // why neither was reached.
    expect(doc).toContain('day-classification rule');
    expect(doc).toContain('1983-accord canton list');
  });
});
