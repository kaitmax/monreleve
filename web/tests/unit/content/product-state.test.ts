// web/tests/unit/content/product-state.test.ts
//
// RULING R172: STATEMENTS ABOUT THE PRODUCT'S OWN STATE COME FROM ONE MODULE.
//
// THE MODULE IS THE EASY HALF. FW20 wrote three pages in one task, each
// internally consistent, every suite green, and the contradiction lived only
// BETWEEN them: /a-propos said the site holds a register of days, /tarifs
// priced a statement document, /releve-annuel said neither is built. A
// constants file fixes that exactly as well as a convention does - which is
// to say, until the next page.
//
// SO THIS FILE ASKS THE FOUR QUESTIONS A CONSTANTS FILE CANNOT ANSWER:
//
//   1. Are the facts TRUE? A boolean nobody checks is a boolean that stays
//      whatever it was typed as. Each flag is asserted against the evidence
//      its comment names - the Prisma model, the route directory, the absent
//      android/ - so shipping the tracker without flipping the flag fails
//      here rather than in a sentence somebody reads in production.
//
//   2. Does flipping one CHANGE EVERY PAGE THAT DEPENDS ON IT? The prompt's
//      own words: "a module three pages read but nothing cross-checks is
//      three pages again."
//
//   3. Does each wired sentence ACTUALLY DEPEND on its flag? A getter that
//      takes the state and ignores it satisfies question 2 by being in the
//      table. This is R154's shape - a mechanism is proven to deliver, not
//      proven not to fail - and it is the check my own R154 work got wrong
//      once already by covering bodies and not headings.
//
//   4. Is there a page NOBODY WIRED? This is the original defect and the only
//      question whose answer changes as the product grows. It scans lib/fr
//      for claim-shaped prose and requires every hit to be wired or exempt
//      with a stated reason.
//
// QUESTION 4 IS WHY THIS FILE IS WORTH ITS LENGTH. It found a fourth instance
// that FW20's read-through could not: HOME_COPY.description, the home page's
// META DESCRIPTION, promising "puis tenez le registre horodate de vos
// journees". A read-through reads pages; a meta description is never on one.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCT_STATE, type ProductState } from '@/lib/content/product-state';
import { HOME_COPY } from '@/lib/fr';
import { A_PROPOS_COPY } from '@/lib/fr/a-propos';
import { LEGAL_COPY } from '@/lib/fr/legal';
import { RELEVE_COPY } from '@/lib/fr/releve-annuel';
import { TARIFS_COPY } from '@/lib/fr/tarifs';
import { CLAIM_PATTERNS, EXEMPT, claimsIn } from '../../support/product-claims';
import { quotedSpans, withoutComments } from '../../support/quoted-spans';

const WEB = process.cwd();
const FR = join(WEB, 'lib', 'fr');

// ---------------------------------------------------------------------------
// 1. THE FACTS ARE TRUE
// ---------------------------------------------------------------------------

/**
 * The evidence each flag's comment names, as a predicate.
 *
 * READ FROM THE FILESYSTEM AND THE SCHEMA, never from another constant. A
 * flag checked against a second constant is two constants agreeing with each
 * other, which is what R171 forbids one layer down: the test names the role -
 * "there is a model that records a day" - rather than a literal that happens
 * to match today.
 */
const EVIDENCE: Record<keyof ProductState, () => boolean> = {
  calculatorExists: () =>
    existsSync(join(WEB, 'app', '(public)', 'calculateur-teletravail-frontalier', 'page.tsx')),

  guidesExist: () =>
    existsSync(join(WEB, 'content', 'guides')) &&
    readdirSync(join(WEB, 'content', 'guides')).some((name) => name.endsWith('.mdx')),

  alertsExist: () => existsSync(join(WEB, 'app', 'api', 'alertes', 'route.ts')),

  // SPEC 8's day record. The model is the thing that makes a day durable, and
  // no route can record one without it.
  trackerExists: () => /^\s*model\s+Entry\b/m.test(readFileSync(join(WEB, 'prisma', 'schema.prisma'), 'utf8')),

  // SPEC 12's document needs the tracker beneath it AND the print route R53
  // reserves. /releve-annuel being live is NOT evidence - that is the offer
  // page, and the distinction is the one the module comment calls
  // load-bearing.
  dossierExists: () =>
    EVIDENCE.trackerExists() && existsSync(join(WEB, 'app', 'releve', 'print')),

  comparatorExists: () => existsSync(join(WEB, 'app', '(public)', 'calculateur-lamal-cmu')),

  appExists: () => existsSync(join(WEB, '..', 'android')),
};

describe('the flags are facts, checked against the code', () => {
  for (const flag of Object.keys(PRODUCT_STATE) as Array<keyof ProductState>) {
    it(`${flag} matches the evidence its comment names`, () => {
      expect(
        PRODUCT_STATE[flag],
        `PRODUCT_STATE.${flag} disagrees with the code. Either the capability ` +
          'shipped and the flag was not flipped, or the flag was flipped ahead ' +
          'of the build. Both put a false sentence on a public page.',
      ).toBe(EVIDENCE[flag]());
    });
  }

  it('checks every flag, so a shortened list cannot pass', () => {
    expect(Object.keys(EVIDENCE).sort()).toEqual(Object.keys(PRODUCT_STATE).sort());
  });
});

// ---------------------------------------------------------------------------
// 2 and 3. FLIPPING A FLAG CHANGES EVERY PAGE THAT DEPENDS ON IT
// ---------------------------------------------------------------------------

interface Wired {
  /** Named in the failure message: page and field. */
  readonly where: string;
  /**
   * The lib/fr file the sentence lives in.
   *
   * CARRIED SO THE SCAN CAN BE PER FLAG RATHER THAN PER FILE. A file-level
   * allowance says "somebody wired something in here once", which lets a
   * second, unwired claim about a DIFFERENT capability ride in beside a wired
   * one - and lib/fr/index.ts is 500 lines of exactly the place that would
   * happen.
   */
  readonly file: string;
  readonly render: (state: ProductState) => string;
}

const FISCAL = '40 %';
const SOCIAL = '49,9 %';

/**
 * Which copy depends on which fact.
 *
 * THE TABLE IS THE CLAIM AND THE TEST IS THE PROOF. Listing a getter here
 * asserts that its sentence is false in the other state; the assertions below
 * make that assertion falsifiable by rendering both states and requiring the
 * strings to differ.
 */
const WIRING: ReadonlyArray<{
  readonly flag: keyof ProductState;
  readonly wired: readonly Wired[];
}> = [
  {
    flag: 'trackerExists',
    wired: [
      {
        where: '/ description',
        file: 'index.ts',
        render: (s) => HOME_COPY.description(FISCAL, SOCIAL, s),
      },
      { where: '/a-propos lead', file: 'a-propos.ts', render: (s) => A_PROPOS_COPY.lead(s) },
      {
        where: '/releve-annuel stateBody',
        file: 'releve-annuel.ts',
        render: (s) => RELEVE_COPY.stateBody(s),
      },
      // EVERY PUBLIC PAGE'S FOOTER, which is why it is the worst of the five.
      { where: 'the standing disclaimer', file: 'legal.ts', render: (s) => LEGAL_COPY.standing(s) },
    ],
  },
  {
    flag: 'dossierExists',
    wired: [
      {
        where: '/tarifs positionDetail',
        file: 'tarifs.ts',
        render: (s) => TARIFS_COPY.positionDetail(s),
      },
      { where: '/releve-annuel description', file: 'releve-annuel.ts', render: (s) => RELEVE_COPY.description(s) },
      { where: '/releve-annuel lead', file: 'releve-annuel.ts', render: (s) => RELEVE_COPY.lead(s) },
      { where: '/releve-annuel purposeHeading', file: 'releve-annuel.ts', render: (s) => RELEVE_COPY.purposeHeading(s) },
      { where: '/releve-annuel contentsHeading', file: 'releve-annuel.ts', render: (s) => RELEVE_COPY.contentsHeading(s) },
      { where: '/releve-annuel contentsIntro', file: 'releve-annuel.ts', render: (s) => RELEVE_COPY.contentsIntro(s) },
      { where: '/releve-annuel vocabularyHeading', file: 'releve-annuel.ts', render: (s) => RELEVE_COPY.vocabularyHeading(s) },
      { where: '/releve-annuel vocabularyBody', file: 'releve-annuel.ts', render: (s) => RELEVE_COPY.vocabularyBody(s) },
      { where: '/releve-annuel stateBody', file: 'releve-annuel.ts', render: (s) => RELEVE_COPY.stateBody(s) },
    ],
  },
  {
    flag: 'comparatorExists',
    wired: [
      {
        where: '/tarifs positionDetail',
        file: 'tarifs.ts',
        render: (s) => TARIFS_COPY.positionDetail(s),
      },
    ],
  },
  {
    flag: 'calculatorExists',
    wired: [
      { where: '/a-propos lead', file: 'a-propos.ts', render: (s) => A_PROPOS_COPY.lead(s) },
      {
        where: '/tarifs positionDetail',
        file: 'tarifs.ts',
        render: (s) => TARIFS_COPY.positionDetail(s),
      },
    ],
  },
  {
    flag: 'guidesExist',
    wired: [
      {
        where: '/tarifs positionDetail',
        file: 'tarifs.ts',
        render: (s) => TARIFS_COPY.positionDetail(s),
      },
    ],
  },
];

/**
 * Flags no sentence depends on yet, each with the reason.
 *
 * SAID OUT LOUD RATHER THAN OMITTED, so an empty column reads as a decision
 * rather than as an oversight - the same reason gate:changed prints test:a11y
 * in its selection and then does not run it.
 */
const NOT_YET_WIRED: ReadonlyArray<{ readonly flag: keyof ProductState; readonly why: string }> = [
  {
    flag: 'appExists',
    why: '/application is FW20b increment 4, and it is the whole page rather than one sentence.',
  },
  {
    flag: 'alertsExist',
    why: 'No page states whether the alert list exists; /alertes IS the statement.',
  },
];

describe('flipping a flag changes every page that depends on it', () => {
  for (const { flag, wired } of WIRING) {
    const flipped: ProductState = { ...PRODUCT_STATE, [flag]: !PRODUCT_STATE[flag] };

    for (const { where, render } of wired) {
      it(`${flag} -> ${where}`, () => {
        const before = render(PRODUCT_STATE);
        const after = render(flipped);

        expect(before.length, `${where} rendered nothing in the shipped state`).toBeGreaterThan(0);
        expect(after.length, `${where} rendered nothing with ${flag} flipped`).toBeGreaterThan(0);

        // THE POINT OF THE INCREMENT. A getter that takes the state and
        // ignores it passes every other assertion in this file.
        expect(
          after,
          `${where} is listed as depending on ${flag} and did not change when ` +
            'it flipped. Either the sentence does not derive from the module, ' +
            'or it should not be in the table.',
        ).not.toBe(before);
      });
    }
  }

  it('accounts for every flag, wired or stated as not wired', () => {
    const covered = [...WIRING.map((row) => row.flag), ...NOT_YET_WIRED.map((row) => row.flag)];

    expect(covered.sort()).toEqual(Object.keys(PRODUCT_STATE).sort());
  });
});

// ---------------------------------------------------------------------------
// 4. NOTHING CLAIMS A CAPABILITY WITHOUT BEING WIRED TO IT
// ---------------------------------------------------------------------------

/**
 * Which flag each lib/fr file is wired FOR, read off the table above.
 *
 * DERIVED RATHER THAN LISTED, because a second hand-kept list is a list that
 * disagrees with the first one the day either is edited - the reason
 * tests/support/typed-figures.ts was extracted at all.
 */
const WIRED_FOR = new Map<string, Set<string>>();

for (const { flag, wired } of WIRING) {
  for (const { file } of wired) {
    const flags = WIRED_FOR.get(file) ?? new Set<string>();

    flags.add(flag);
    WIRED_FOR.set(file, flags);
  }
}

/** R155's test, reused: a reader-facing sentence contains a space. */
const isProse = (span: string): boolean => span.includes(' ');

interface Hit {
  readonly file: string;
  readonly line: number;
  readonly what: string;
  readonly flag: string;
  readonly span: string;
}

function scanFr(): readonly Hit[] {
  const hits: Hit[] = [];

  for (const file of readdirSync(FR).filter((name) => name.endsWith('.ts'))) {
    // SPANS, NOT LINES. Every file below carries a comment quoting the very
    // sentence it exists to forbid, and a line-level scan reports each of
    // those as a defect.
    const source = withoutComments(readFileSync(join(FR, file), 'utf8'));

    source.split('\n').forEach((line, index) => {
      for (const span of quotedSpans(line).filter(isProse)) {
        for (const claim of claimsIn(span)) {
          hits.push({ file, line: index + 1, what: claim.what, flag: claim.flag, span });
        }
      }
    });
  }

  return hits;
}

describe('no page claims a capability the module does not grant', () => {
  it('finds nothing in lib/fr that is neither wired nor exempt', () => {
    const exempt = new Set(EXEMPT.map((entry) => entry.file));

    const unwired = scanFr().filter(
      (hit) => !(WIRED_FOR.get(hit.file)?.has(hit.flag) ?? false) && !exempt.has(hit.file),
    );

    expect(
      unwired.map((hit) => `lib/fr/${hit.file}:${String(hit.line)} ${hit.what} — ${hit.span}`),
      'A sentence asserts a capability and nothing ties it to PRODUCT_STATE. ' +
        'Wire it, or add it to EXEMPT with the reason it is not a build claim.',
    ).toEqual([]);
  });

  it('the vocabulary is not empty, and every exemption names a file that exists', () => {
    expect(CLAIM_PATTERNS.length).toBeGreaterThan(0);

    for (const { file, why } of EXEMPT) {
      expect(existsSync(join(FR, file)), `EXEMPT names lib/fr/${file}, which is gone`).toBe(true);
      expect(why.length, `EXEMPT ${file} has no reason`).toBeGreaterThan(40);
    }
  });

  /**
   * NON-VACUITY, and the reason R169's corollary exists: an absence assertion
   * is satisfied by absence. A vocabulary that matches nothing would pass the
   * scan above on an empty repository.
   */
  it('recognises the sentences that produced the rule', () => {
    const produced = [
      'Calculez votre part et les jours qui restent, puis tenez le registre horodaté de vos journées.',
      'Ce site calcule votre part de télétravail annuelle et tient un registre de journées.',
      'Le service met en forme un relevé annuel à partir de ces journées.',
      'Ce site publie un comparateur de coût.',
      'Chaque jour enregistré est horodaté par le service.',
    ];

    for (const sentence of produced) {
      expect(claimsIn(sentence).length, `not recognised as a claim: ${sentence}`).toBeGreaterThan(0);
    }
  });

  it('does not flag prose that mentions the words without claiming them', () => {
    const innocent = [
      'Une date de relevé, consignée avec la règle.',
      'Le registre journalier et le document qui en découle ne sont pas construits.',
      'Ce site ne dispose d’aucune donnée de primes. Il ne publie donc pas de comparateur de coût.',
      'Ce document n’existe pas encore.',
    ];

    for (const sentence of innocent) {
      expect(claimsIn(sentence).map((claim) => claim.what), `false positive: ${sentence}`).toEqual(
        [],
      );
    }
  });
});
