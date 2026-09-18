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
import {
  CLAIM_PATTERNS,
  EXEMPT,
  MUST_NOT_FLAG,
  PRODUCED_THE_RULE,
  claimsIn,
} from '../../support/product-claims';
import { quotedSpans, withoutComments } from '../../support/quoted-spans';

const WEB = process.cwd();
const FR = join(WEB, 'lib', 'fr');

// ---------------------------------------------------------------------------
// 1. THE FACTS ARE TRUE
// ---------------------------------------------------------------------------

/**
 * RULING R186: A FLAG ASSERTS A USER-FACING CAPABILITY, AND ITS PROXY IS THE
 * LAST THING THAT MAKES THAT CAPABILITY TRUE, NEVER THE FIRST.
 *
 * THE DEFECT THIS CORRECTS IS MINE, FROM FW20b. trackerExists asserted
 * against /^\s*model\s+Entry\b/m in prisma/schema.prisma - the FIRST thing
 * that makes a tracker possible rather than the last. A table is not a
 * tracker: nobody can record a day until an API, a client and a release
 * exist.
 *
 * LEFT ALONE, FW21’s SCHEMA COMMIT WOULD HAVE FLIPPED IT - and flipping
 * trackerExists rewrites four public surfaces at once: the home page’s meta
 * description regains "puis tenez le registre horodaté de vos journées",
 * /a-propos claims the site holds a register, /releve-annuel stops saying
 * the register is not built, and $legal-01 tells every page’s footer that
 * each recorded day is timestamped. Four pages would have gone from honest
 * to false ON A COMMIT THAT ADDS A TABLE, which is the exact defect R172 was
 * created to prevent, reintroduced by R172’s own detector.
 *
 * SO EACH FLAG CARRIES ITS CAPABILITY IN WORDS. The sentence is what the
 * flag being true PROMISES A READER; the proxy is the artefact whose
 * existence makes that promise keepable. Where they disagree, the sentence
 * wins and the proxy is wrong.
 */
interface Flag {
  /** What a reader may do when this is true. Written as a promise to them. */
  readonly capability: string;
  /** The artefact whose existence settles it, named for the report. */
  readonly proxy: string;
  /** Why this artefact is the LAST one, rather than an earlier enabler. */
  readonly last: string;
  readonly check: () => boolean;
}

const ANDROID = join(WEB, '..', 'android');

const EVIDENCE: Record<keyof ProductState, Flag> = {
  calculatorExists: {
    capability: 'A reader can enter their days and get their annual rate.',
    proxy: 'app/(public)/calculateur-teletravail-frontalier/page.tsx',
    last:
      'The engine and the form both exist behind it, but neither is reachable ' +
      'until the route renders. The page is what a reader can open.',
    check: () =>
      existsSync(join(WEB, 'app', '(public)', 'calculateur-teletravail-frontalier', 'page.tsx')),
  },

  guidesExist: {
    capability: 'A reader can read the rules, sourced.',
    proxy: 'content/guides/*.mdx',
    last:
      'The registry, the MDX pipeline and the claims map all precede an ' +
      'article. An article with no file is a route that 404s.',
    check: () =>
      existsSync(join(WEB, 'content', 'guides')) &&
      readdirSync(join(WEB, 'content', 'guides')).some((name) => name.endsWith('.mdx')),
  },

  alertsExist: {
    capability: 'A reader can subscribe to regulatory alerts.',
    proxy: 'app/api/alertes/route.ts',
    last:
      'The AlertSubscriber model and the capture card come first; the route ' +
      'is what turns a filled form into a subscription. Delivery is degraded ' +
      'without RESEND_API_KEY, which is configuration rather than existence.',
    check: () => existsSync(join(WEB, 'app', 'api', 'alertes', 'route.ts')),
  },

  trackerExists: {
    capability: 'A reader can record a day, and it is timestamped by the server.',
    proxy: 'a released Android client (AN14), under android/',
    last:
      'THE SCHEMA IS THE FIRST THING, NOT THE LAST. Between prisma/schema ' +
      '.prisma and a day somebody can record sit the entries API (FW23), ' +
      'auth (FW22), the client that calls them, and a release that puts it ' +
      'on a phone. Each of those is necessary; the release is the one that ' +
      'is sufficient, because nothing before it lets a reader do anything.',
    check: () => existsSync(ANDROID),
  },

  dossierExists: {
    capability: 'A reader can export the Relevé annuel as a document.',
    proxy: 'app/releve/print, plus the tracker beneath it',
    last:
      'Already correct before R186, and it is the pattern the others now ' +
      'follow: a document needs entries to be about, so it requires the ' +
      'tracker AND the route R53 reserves. /releve-annuel being `live` is ' +
      'NOT evidence - that is the offer page, and the distinction is the one ' +
      'lib/content/product-state.ts calls load-bearing.',
    check: () => EVIDENCE.trackerExists.check() && existsSync(join(WEB, 'app', 'releve', 'print')),
  },

  comparatorExists: {
    capability: 'A reader can compare LAMal and CMU costs.',
    proxy: 'app/(public)/calculateur-lamal-cmu/',
    last:
      'Blocked on a premium-data licence rather than on code (PARK-4, R157 ' +
      'option 3), so the route is both the last step and the one that cannot ' +
      'be taken yet.',
    check: () => existsSync(join(WEB, 'app', '(public)', 'calculateur-lamal-cmu')),
  },

  appExists: {
    capability: 'A reader can install the application.',
    proxy: 'the android/ directory',
    last:
      'It shares a proxy with trackerExists TODAY and they are different ' +
      'claims: an app could ship that cannot yet record a day. When android/ ' +
      'lands, trackerExists takes the narrower marker - a release that talks ' +
      'to the entries API - and these two separate. Recorded so the sharing ' +
      'is a known approximation rather than a discovered one.',
    check: () => existsSync(ANDROID),
  },
};

describe('the flags are facts, checked against the code', () => {
  for (const flag of Object.keys(PRODUCT_STATE) as Array<keyof ProductState>) {
    it(`${flag} matches the evidence its comment names`, () => {
      expect(
        PRODUCT_STATE[flag],
        `PRODUCT_STATE.${flag} disagrees with the code. Either the capability ` +
          'shipped and the flag was not flipped, or the flag was flipped ahead ' +
          'of the build. Both put a false sentence on a public page.',
      ).toBe(EVIDENCE[flag].check());
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
    for (const sentence of PRODUCED_THE_RULE) {
      expect(claimsIn(sentence).length, `not recognised as a claim: ${sentence}`).toBeGreaterThan(
        0,
      );
    }
  });

  it('does not flag prose that mentions the words without claiming them', () => {
    for (const sentence of MUST_NOT_FLAG) {
      expect(claimsIn(sentence).map((claim) => claim.what), `false positive: ${sentence}`).toEqual(
        [],
      );
    }
  });
});
