// web/tests/unit/export/css-page.test.ts
//
// The @page reader and the stated comparison, proven on CSS and HTML whose
// every byte this file controls. FW-PRINT-PAGE-PIN (R991).
//
// The claim - "the @page size the server serves is the paper the renderer
// asks for" - is asserted against the image in tests/db/container-pdf.test.ts,
// which needs Docker and runs only when its paths change (R936, R990). The
// helpers that claim goes through run here, in `pnpm test`, in every gate and
// in gate:clone.

import { describe, expect, it } from 'vitest';
import { PDF_FORMAT } from '@/lib/export/pdf';
import {
  CSS_PAGE_SIZE_FOR_FORMAT,
  atPageSizes,
  cssPageSizeFor,
  pageSizeRefusal,
  stylesheetHrefs,
} from '@/tests/support/css-page';

describe('R991: the comparison of the renderer format with the @page size is stated (R345)', () => {
  it("states that the renderer's 'A4' is the CSS keyword `a4`", () => {
    // THE VALUE IS THE ASSERTION (R171): this is the one pairing the product
    // relies on, written as both vocabularies spell it.
    expect(cssPageSizeFor('A4')).toBe('a4');
  });

  it('states nothing else, so another paper is a deliberate act', () => {
    expect(Object.keys(CSS_PAGE_SIZE_FOR_FORMAT)).toEqual(['A4']);
  });

  it("covers the format lib/export/pdf.ts actually asks for, read from the renderer (R181)", () => {
    // The renderer's own constant, not a copy of it: a renderer moved to a
    // paper with no stated keyword fails HERE, in every gate, before the
    // container step is ever reached.
    expect(cssPageSizeFor(PDF_FORMAT)).toBe(CSS_PAGE_SIZE_FOR_FORMAT[PDF_FORMAT]);
  });

  it.each([['Letter'], ['Ledger'], ['Tabloid'], ['a4']])(
    'refuses by name a format with no stated keyword: %s',
    (format) => {
      // 'a4' lowercase is NOT the renderer's spelling; the table is keyed by
      // Playwright's names, exactly, so no case folding stands in for a
      // statement.
      expect(() => cssPageSizeFor(format)).toThrow(/R991: no CSS page-size keyword is stated/u);
      expect(() => cssPageSizeFor(format)).toThrow(JSON.stringify(format));
    },
  );
});

describe('R991: the served @page size is compared whole', () => {
  it('accepts exactly the stated keyword', () => {
    expect(pageSizeRefusal('A4', ['a4'])).toBeNull();
  });

  it.each([
    ['letter', 'a different paper (the R992 plant)'],
    ['a4 landscape', 'A4 turned landscape: R982 measured every page go landscape'],
    ['a4 portrait', 'an orientation the renderer does not state'],
    ['210mm 297mm', 'explicit lengths, which need a tolerance this check does not hold'],
    ['a5', 'a smaller ISO paper'],
    ['auto', "the browser's own choice"],
  ])('refuses `size: %s` (%s), naming the rule and both values', (served) => {
    const refusal = pageSizeRefusal('A4', [served]);

    expect(refusal).not.toBeNull();
    expect(refusal).toContain('R991');
    expect(refusal).toContain(`\`size: ${served}\``);
    expect(refusal).toContain('"A4"');
    expect(refusal).toContain('`size: a4`');
  });

  it('refuses no @page rule at all, distinctly', () => {
    expect(pageSizeRefusal('A4', [])).toMatch(/^R991: the served CSS carries no @page rule/u);
  });

  it('refuses an @page rule with no size, distinctly', () => {
    expect(pageSizeRefusal('A4', [null])).toMatch(/^R991: the served @page rule declares no size/u);
  });

  it('refuses two @page rules even when both say a4, distinctly', () => {
    expect(pageSizeRefusal('A4', ['a4', 'a4'])).toMatch(/^R991: the served CSS carries 2 @page rules/u);
  });
});

describe('R991: the @page reader', () => {
  it('reads minified CSS, the shape the compiled stylesheet has', () => {
    expect(atPageSizes('.a{color:red}@page{size:a4;margin:0}.b{margin:0}')).toEqual(['a4']);
  });

  it('reads the source shape, lowercased and with whitespace collapsed', () => {
    expect(atPageSizes('@page {\n  size:  A4   Landscape ;\n  margin: 0;\n}')).toEqual(['a4 landscape']);
  });

  it('drops !important and reads the last size a rule declares', () => {
    expect(atPageSizes('@page{size:letter;size:a4!important}')).toEqual(['a4']);
  });

  it('reports an @page rule with no size as null, and one with a selector', () => {
    expect(atPageSizes('@page{margin:0}@page :first{size:a4}')).toEqual([null, 'a4']);
  });

  it('does not read a @page written inside a comment', () => {
    expect(atPageSizes('/* @page{size:letter} */.a{size:auto}')).toEqual([]);
  });

  it('finds nothing in CSS that has no @page rule', () => {
    expect(atPageSizes('.page{size:a4}')).toEqual([]);
  });
});

describe('R991: the stylesheets a page links', () => {
  it('reads every rel=stylesheet link, whatever the attribute order', () => {
    const html =
      '<head><link rel="stylesheet" href="/_next/static/css/a.css" data-precedence="next"/>' +
      '<link href="/_next/static/css/b.css?dpl=x&amp;y=1" rel="stylesheet">' +
      '<link rel="preload" href="/font.woff2" as="font"/>' +
      '<link rel="icon" href="/icon.svg"/></head>';

    expect(stylesheetHrefs(html)).toEqual(['/_next/static/css/a.css', '/_next/static/css/b.css?dpl=x&y=1']);
  });

  it('finds none in a page that links none', () => {
    expect(stylesheetHrefs('<html><head><title>x</title></head></html>')).toEqual([]);
  });
});
