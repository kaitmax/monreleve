// web/tests/unit/fr/typed-numbers.test.ts
//
// RULING R147 REACHES lib/fr, on the operator's Q52 answer: "yes, extend R147
// to lib/fr".
//
// R147 WAS WRITTEN FOR THE GUIDES and stopped at content/guides, which left
// the larger surface uncovered. lib/fr is where every French string in the
// product lives - the home page description, the nav, the notification
// bodies, the result panel - and it is prose a reader meets exactly as
// directly as an article's. A figure typed here goes stale in 2028 with every
// suite green, which is the whole failure R147 names.
//
// THE FILES ALREADY KNEW. lib/fr/metrics.ts, lib/fr/result.ts,
// lib/fr/statuses.ts, lib/fr/faq.ts and lib/fr/errors.ts each carry a comment
// saying so in their own words - metrics.ts: "These are functions rather than
// constants for one reason: 40 % and 49,9 % belong to the year's RuleSet
// (SPEC 7.7), so a string containing one is a second source of truth." Five
// files observed the rule and nothing enforced it, so the three that did not
// observe it were found by reading rather than by running. That is the
// difference this file makes.
//
// SPANS, NOT LINES, and that is not a detail. A line-level scan of lib/fr
// reports nineteen hits, every one of them inside a comment explaining why
// the figure must not be typed. The quoted span is the string a reader can
// actually receive.
//
// PROSE CONTAINS A SPACE; AN IDENTIFIER DOES NOT - R155's test, reused here
// for the same reason. '/guides/teletravail-frontalier-40-pourcent' is a slug
// that SPEC 14 makes PERMANENT, so the figure in it is frozen by a stronger
// rule than this one and must not be flagged.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';
import { TYPED_FIGURES, typedFiguresIn } from '../../support/typed-figures';
import { quotedSpans, withoutComments } from '../../support/quoted-spans';

const FR = join(process.cwd(), 'lib', 'fr');

/** Every figure above must actually be a RuleSet value, or the rule is fiction. */
const RULES = ruleSetFor(2026);

describe('the figures R147 names are the ones RuleSet carries', () => {
  it('matches the engine, so this scan is not guarding invented numbers', () => {
    // The same non-vacuity check the guide scan makes, and it belongs on both
    // sides: the two files now share one pattern list, so a RuleSet change
    // that nobody mirrored into it would silently weaken BOTH guards.
    expect(RULES.fiscalCeiling).toBe(0.4);
    expect(RULES.socialCeiling).toBe(0.499);
    expect(RULES.simplifiedBasisDays).toBe(240);
    expect(RULES.missionCapDays).toBe(10);
    expect(RULES.a1ThresholdRate).toBe(0.25);
  });

  it('carries every figure, so a shortened list cannot pass', () => {
    expect(TYPED_FIGURES.length).toBe(5);
  });
});

interface Hit {
  readonly file: string;
  readonly line: number;
  readonly what: string;
  readonly span: string;
}

/**
 * PROSE, by R155's test: a reader-facing sentence contains a space.
 *
 * A slug, a path, a token or a CSS value does not, and every one of those may
 * legitimately carry a digit sequence - '/guides/teletravail-frontalier-40-pourcent'
 * most of all, which SPEC 14 freezes permanently.
 */
const isProse = (span: string): boolean => span.includes(' ');

function scan(): readonly Hit[] {
  const hits: Hit[] = [];

  for (const file of readdirSync(FR).filter((name) => name.endsWith('.ts'))) {
    const source = withoutComments(readFileSync(join(FR, file), 'utf8'));

    source.split('\n').forEach((line, index) => {
      for (const span of quotedSpans(line)) {
        if (!isProse(span)) continue;

        for (const what of typedFiguresIn(span)) {
          hits.push({ file, line: index + 1, what, span: span.slice(0, 70) });
        }
      }
    });
  }

  return hits;
}

describe('no string in lib/fr types a regulatory figure (R147)', () => {
  it('reads the directory, so nothing below passes vacuously', () => {
    const files = readdirSync(FR).filter((name) => name.endsWith('.ts'));

    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain('shell.ts');
  });

  it('finds prose to scan, so the isProse filter is not eating everything', () => {
    // THE FILTER IS THE DANGEROUS PART. isProse rejecting every span would
    // make this file a guard over nothing and it would stay green forever.
    const spans = readdirSync(FR)
      .filter((name) => name.endsWith('.ts'))
      .flatMap((file) => withoutComments(readFileSync(join(FR, file), 'utf8')).split('\n'))
      .flatMap((line) => quotedSpans(line))
      .filter(isProse);

    expect(spans.length).toBeGreaterThan(200);
  });

  it('finds none in what is written today', () => {
    const found = scan().map(
      (hit) => `${hit.file}:${hit.line} ${hit.what} in "${hit.span}"`,
    );

    expect(found, found.join('\n')).toEqual([]);
  });

  it('would catch one, so the scan is proven to fire (R154)', () => {
    // POSITIVE PROOF. Every assertion above is an absence, and an absence is
    // satisfied by a scanner that finds nothing because it looks nowhere -
    // which is the exact shape of the blockJS defect R154 was written for.
    // So a known violation is put through the same path.
    const planted = `  label: 'Le seuil de 40 % et les 240 jours',`;
    const hits = quotedSpans(planted).filter(isProse).flatMap(typedFiguresIn);

    expect(hits).toContain('the fiscal ceiling');
    expect(hits).toContain('the simplified basis');
  });

  it('does not flag the permanent slug, which SPEC 14 freezes', () => {
    const slug = `  { label: 'Le plafond fiscal', href: '/guides/teletravail-frontalier-40-pourcent' },`;

    expect(quotedSpans(slug).filter(isProse).flatMap(typedFiguresIn)).toEqual([]);
  });
});
