// web/tests/unit/pages/og-metadata.test.ts
//
// The openGraph and twitter blocks, and the R81 condition they sit behind.
//
// WHY THEY ARE DECLARED RATHER THAN CONVENTIONAL. Next has a file convention -
// app/opengraph-image.png - that emits these tags by itself. Increment 1
// measured what it emits when no origin is configured:
//
//   <meta property="og:image" content="http://localhost:3000/opengraph-image.png?...">
//   <meta name="twitter:image" content="http://localhost:3000/opengraph-image.png?...">
//
// and e2e/guard.runtime.spec.ts failed on "no localhost URL reaches the
// rendered head at all". R81's reasoning is about canonicals and carries over
// without modification: a URL pointing at localhost is an INSTRUCTION rather
// than an absence, and absence is the safer failure. The convention has no
// conditional form, so the card is served from public/ and named here, where
// the same canonicalsAvailable() gate that governs the canonical governs it.
//
// THE ALT TEXT IS THE CARD'S OWN ACCESSIBLE NAME. renderRailSvg writes
// RAIL_SOCIAL_ARIA into the SVG's aria-label; reusing it for og:image:alt
// means the description a screen reader hears from the page and the one a
// social platform publishes cannot disagree, and neither can drift from the
// picture - they are the same string.

import { TEST_ORIGIN } from '../../../lib/content/identity';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ruleSetFor } from '@/lib/calc-engine';
import { OG_CARD } from '@/lib/content/og';
import { currentTaxYear } from '@/lib/content/tax-year';
import { RAIL_SOCIAL_ARIA } from '@/lib/fr/rail';
import { formatPercent } from '@/lib/ui/core';
import { SOCIAL_HEIGHT, SOCIAL_WIDTH } from '@/lib/ui/core/rail/geometry';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('the card the metadata names', () => {
  it('names a file that is actually in public/', () => {
    // A PATH TYPO IS INVISIBLE TO EVERY OTHER TEST HERE. The metadata would
    // be well-formed, the tags would render, and the card would 404 in a
    // crawler - which nobody sees until a link is shared. So the declared
    // path is resolved against the tree.
    expect(existsSync(join(process.cwd(), 'public', OG_CARD.path))).toBe(true);
  });

  it('carries the dimensions from the generator, not typed ones', () => {
    expect(OG_CARD.width).toBe(SOCIAL_WIDTH);
    expect(OG_CARD.height).toBe(SOCIAL_HEIGHT);
  });

  it("uses the card's own accessible name as its alt text", () => {
    expect(OG_CARD.alt).toBe(RAIL_SOCIAL_ARIA);
  });
});

describe('SPEC 14: the calculator names the threshold and the year', () => {
  // "<title>/description name the 40% threshold and the year." The copy has
  // taken both as arguments since FW11 and nothing asserted that they arrive.
  // A description is the one string a searcher reads before deciding to
  // click, and a stale year in it is the kind of wrongness that looks fine in
  // review because the sentence still reads well.
  it('puts the fiscal ceiling and the tax year in the description', async () => {
    const page = await import('@/app/(public)/calculateur-teletravail-frontalier/page');
    const meta = page.generateMetadata();
    const year = currentTaxYear();
    const rules = ruleSetFor(year);
    const percent = rules.fiscalCeiling * 100;

    const ceiling = formatPercent(percent, Number.isInteger(percent) ? 0 : 1);

    expect(meta.description).toContain(ceiling);
    expect(meta.description).toContain(String(year));

    // Non-vacuity: a description that happened to be empty would satisfy
    // neither, but one built from a DIFFERENT year would satisfy the first
    // alone. The year asserted is the resolved one, not a literal.
    expect(String(meta.title).length).toBeGreaterThan(0);
    expect(year).toBeGreaterThan(2024);
  });
});

describe('R81: the tags are omitted while the origin is the stand-in', () => {
  it('declares no openGraph image with no origin configured', async () => {
    // The test environment has no NEXT_PUBLIC_SITE_URL, which is the
    // condition the runtime guard runs under.
    const layout = await import('@/app/(public)/layout');

    expect(layout.metadata.openGraph).toBeUndefined();
    expect(layout.metadata.twitter).toBeUndefined();
  });

  it('declares both once an origin exists', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', TEST_ORIGIN);
    vi.resetModules();

    const layout = await import('@/app/(public)/layout');
    const images = layout.metadata.openGraph?.images;

    expect(Array.isArray(images)).toBe(true);

    const [card] = images as { url: string; width: number; height: number; alt: string }[];

    expect(card?.url).toBe(OG_CARD.path);
    expect(card?.width).toBe(SOCIAL_WIDTH);
    expect(card?.height).toBe(SOCIAL_HEIGHT);
    expect(card?.alt).toBe(RAIL_SOCIAL_ARIA);

    // summary_large_image is the 1,91:1 card. The default 'summary' crops to
    // a square thumbnail, which would cut both ticks off the rail - the one
    // thing the picture exists to show.
    //
    // Read through a narrowed shape rather than off Metadata['twitter']:
    // that type is a union of card kinds and `card` is not a property every
    // member carries, so tsc rejects the direct read. The assertion is the
    // same; only the way it reaches the value changes.
    const twitter = layout.metadata.twitter as { card?: string } | undefined;

    expect(twitter?.card).toBe('summary_large_image');
  });

  it('moves both together, so neither can be left behind the gate', async () => {
    // THE FAILURE THIS FORBIDS: og behind the condition and twitter outside
    // it, which would leave twitter:image pointing at localhost while every
    // og assertion passed. The two are read from the same build in both
    // arms above; this states the invariant in one place.
    const without = await import('@/app/(public)/layout');
    const bothAbsent =
      without.metadata.openGraph === undefined && without.metadata.twitter === undefined;

    vi.stubEnv('NEXT_PUBLIC_SITE_URL', TEST_ORIGIN);
    vi.resetModules();

    const with_ = await import('@/app/(public)/layout');
    const bothPresent =
      with_.metadata.openGraph !== undefined && with_.metadata.twitter !== undefined;

    expect(bothAbsent).toBe(true);
    expect(bothPresent).toBe(true);
  });
});
