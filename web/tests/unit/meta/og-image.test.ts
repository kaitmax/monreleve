// web/tests/unit/meta/og-image.test.ts
//
// The shipped social card, checked without a browser.
//
// WHY THE CARD IS A COMMITTED PNG AND NOT A RENDERED ROUTE. SPEC 6.3 names
// one implementation of the rail - "Pure function, one implementation,
// rendered in the browser, the PDF, and the OG image" - and the string it
// returns is written in var() references. Measured in this increment, against
// next/og, which is the framework's own answer and needs no dependency:
//
//   a nested <img> SVG rasterises its SHAPES and drops every <text> node.
//     The bands, the ticks and the canvas painted correctly; the product
//     name, both tick labels and the band legend were simply absent, and the
//     PNG was byte-identical whether a font was passed to ImageResponse or
//     not - 4784 bytes either way. resvg has no font database and no way to
//     be given one through that API.
//   an INLINE svg element tree refuses outright: "<text> nodes are not
//     currently supported, please convert them to <path>".
//
// So a rendered route would have shipped a bar on a grey field with no words
// on it - the exact failure geometry.ts calls "compliant and says nothing",
// and silent. The alternatives were a second rasteriser (a dependency, a
// committed font binary, and a SECOND IMPLEMENTATION of the product's
// signature element) or a typeface that is not the product's.
//
// The card is instead rendered by the renderer the product already uses, in
// the container ruling R37 pins, through the real cascade where var()
// resolves and the self-hosted Inter is the real one - the same machinery
// that has produced every other baseline in this repository since FW7. The
// shipped file is that render.
//
// AND IT IS NOT UNDER app/, WHICH IS R81 AND WAS MEASURED TOO - the last
// test in this file carries what the head contained and which guard caught
// it.
//
// WHAT THIS FILE ADDS THAT THE CONTAINER CANNOT. e2e/og.visual.spec.ts fails
// only when somebody runs docker. This reads the tree on every commit: the
// shipped card must still be the render the container last produced. That is
// the drift check, and it is the reason the baseline and the asset are two
// files rather than one - a file can be regenerated and not shipped, and
// that gap has to be visible in the fast suite.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOCIAL_HEIGHT, SOCIAL_WIDTH } from '@/lib/ui/core/rail/geometry';

const ROOT = process.cwd();

/** What Next serves at /opengraph-image.png, and what a crawler fetches. */
const SHIPPED = join(ROOT, 'public', 'opengraph-image.png');

/** Where it must NOT be. See the R81 test at the bottom of this file. */
const CONVENTION = join(ROOT, 'app', 'opengraph-image.png');

/** What the container wrote. The shipped file is a copy of this one. */
const BASELINE = join(ROOT, 'tests', 'visual', 'baselines', 'og-card.png');

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('the shipped OG card', () => {
  it('exists where Next serves it from', () => {
    expect(
      existsSync(SHIPPED),
      'public/opengraph-image.png is missing. Next serves it at ' +
        '/opengraph-image.png; without it every share of this product is a ' +
        'bare link.',
    ).toBe(true);
  });

  it('is a PNG, checked by signature rather than by extension', () => {
    const bytes = readFileSync(SHIPPED);

    expect(bytes.length).toBeGreaterThan(1000);
    expect([...bytes.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  });

  it(`is ${String(SOCIAL_WIDTH)} x ${String(SOCIAL_HEIGHT)}, from the IHDR chunk (R128)`, () => {
    // THE NUMBERS COME FROM geometry.ts, not from this file. SPEC 6.3 sets the
    // social variant at 1200 x 630 and the generator already encodes that; a
    // second copy here could agree with a card the generator no longer makes.
    //
    // And the check is not decorative. The rail gallery's social tiles are
    // 1200 x 636 PNGs: an inline-block host adds a descender row under the
    // SVG, and six pixels of grey at the bottom of a social card is the kind
    // of defect that ships because nobody reads a picture's dimensions.
    const bytes = readFileSync(SHIPPED);

    expect(bytes.readUInt32BE(16)).toBe(SOCIAL_WIDTH);
    expect(bytes.readUInt32BE(20)).toBe(SOCIAL_HEIGHT);
  });

  it('is byte-identical to the baseline the container produced', () => {
    // THE DRIFT CHECK. The card is generated in the container and copied here
    // by scripts/og-sync.mjs. If the rail changes and the baseline is
    // regenerated, this fails until the shipped card is regenerated too -
    // which is the whole point of keeping the two files distinct.
    expect(existsSync(BASELINE), 'tests/visual/baselines/og-card.png is missing').toBe(true);

    const shipped = readFileSync(SHIPPED);
    const baseline = readFileSync(BASELINE);

    expect(
      shipped.equals(baseline),
      'public/opengraph-image.png is not the card the container last ' +
        'rendered. Run pnpm test:visual to see the diff, then pnpm og:sync.',
    ).toBe(true);
  });

  it('is NOT at app/opengraph-image.png, where the convention would claim localhost (R81)', () => {
    // THE MEASUREMENT THIS RECORDS, because the convention is the obvious
    // place to put this file and somebody will move it back.
    //
    // app/opengraph-image.png is Next's metadata file convention: it injects
    // the tags itself, resolved against metadataBase. With the card there and
    // the origin unset, every public page carried
    //
    //   <meta property="og:image" content="http://localhost:3000/opengraph-image.png?56ee358a35a09d24">
    //   <meta name="twitter:image" content="http://localhost:3000/...">
    //
    // and e2e/guard.runtime.spec.ts failed on "no localhost URL reaches the
    // rendered head at all". R81's reasoning carries over exactly: a
    // canonical pointing at localhost is an INSTRUCTION rather than an
    // absence, and an og:image is the same kind of claim - an address for a
    // card that nothing can fetch.
    //
    // The convention has no conditional form. Served from public/ and
    // DECLARED instead, the declaration can sit behind canonicalsAvailable()
    // the way the canonical already does.
    expect(
      existsSync(CONVENTION),
      'The card is back under app/, where Next injects og:image and ' +
        'twitter:image against metadataBase. With no configured origin that ' +
        'is a localhost URL in the head of every public page, which R81 ' +
        'refuses. Serve it from public/ and declare it behind ' +
        'canonicalsAvailable().',
    ).toBe(false);
  });
});
