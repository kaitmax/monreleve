// web/tests/support/css-page.ts
//
// The @page rule, read from the stylesheet the server SERVES. FW-PRINT-PAGE-PIN
// (R991).
//
// ============================================================================
// WHY THE SERVED CSS, AND NOT print.module.scss
// ============================================================================
//
// The page size has two homes (R993): lib/export/pdf.ts asks Chromium for a
// paper `format`, and app/releve/print/print.module.scss declares
// `@page { size: ... }`. Measured in FW-PDF-RENDER-GATE (R982), the second is
// not inert while the renderer sets no preferCSSPageSize: `size: letter` kept
// A4 paper and paginated 9 pages as 10, and no assertion anywhere failed,
// because both renderers read the same CSS and agreed with each other.
//
// What the renderer lays the document on is the rule in the COMPILED CSS the
// print route links, not the line in the source: the SCSS compiler and the
// minifier stand between the two. So the comparison is made on the bytes the
// server hands a browser, and these helpers are pure so that the parsing and
// the stated comparison are proven in `pnpm test` (tests/unit/export/
// css-page.test.ts), while the claim itself runs against the image in
// tests/db/container-pdf.test.ts.

/**
 * The CSS page-size keyword for each paper format the renderer may ask for.
 *
 * STATED, NOT INFERRED (R345). Playwright's `format` takes paper names, CSS
 * Paged Media's `size` takes page-size keywords, and the two vocabularies are
 * not the same list: Playwright's "Ledger" is 17 x 11 in where CSS's `ledger`
 * is 11 x 17, and "Tabloid" or "A6" have no CSS keyword at all. So no rule of
 * the form "lowercase it" is assumed. Each pairing this product relies on is
 * written here and asserted in the unit test; a format with no entry is a
 * refusal by name, never a guess.
 *
 * A4 is the only paper this product prints (SPEC 21 criterion 12). ISO 216
 * A4 is 210 x 297 mm under both names, and CSS keywords are ASCII
 * case-insensitive, so the served value is lowercased before it is compared.
 */
export const CSS_PAGE_SIZE_FOR_FORMAT: Readonly<Record<string, string>> = Object.freeze({
  A4: 'a4',
});

/** The keyword the served @page rule must carry for `format`, or a refusal. */
export function cssPageSizeFor(format: string): string {
  const keyword = CSS_PAGE_SIZE_FOR_FORMAT[format];

  if (keyword === undefined) {
    throw new Error(
      `R991: no CSS page-size keyword is stated for the renderer's format ${JSON.stringify(format)}. ` +
        'State it in CSS_PAGE_SIZE_FOR_FORMAT (tests/support/css-page.ts) with its dimensions under both names.',
    );
  }

  return keyword;
}

/**
 * Every stylesheet a page links, in document order, as written in the HTML.
 *
 * Each `<link>` tag is read whole and its attributes separately, so the order
 * Next.js writes `rel` and `href` in does not decide whether a sheet is found.
 */
export function stylesheetHrefs(html: string): string[] {
  const hrefs: string[] = [];

  for (const tag of html.match(/<link\b[^>]*>/giu) ?? []) {
    const rel = /\srel\s*=\s*["']([^"']*)["']/iu.exec(tag)?.[1];
    const href = /\shref\s*=\s*["']([^"']*)["']/iu.exec(tag)?.[1];

    if (rel === undefined || href === undefined) continue;
    if (!rel.toLowerCase().split(/\s+/u).includes('stylesheet')) continue;

    hrefs.push(href.replace(/&amp;/gu, '&'));
  }

  return hrefs;
}

/**
 * Every `@page` rule's `size` in a stylesheet: lowercased, whitespace
 * collapsed, or null for an @page rule that declares no size.
 *
 * Comments are removed first, so a `@page` written in prose is not a rule.
 * Declarations are read at the rule's top level only; an @page rule in this
 * product holds no nested margin boxes, and one that did would be read as a
 * refusal-worthy surprise rather than parsed around.
 */
export function atPageSizes(css: string): (string | null)[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//gu, '');
  const sizes: (string | null)[] = [];

  for (const rule of source.matchAll(/@page\b[^{]*\{([^}]*)\}/giu)) {
    const body = rule[1] ?? '';
    let size: string | null = null;

    for (const declaration of body.split(';')) {
      const colon = declaration.indexOf(':');

      if (colon === -1) continue;
      if (declaration.slice(0, colon).trim().toLowerCase() !== 'size') continue;

      size = declaration
        .slice(colon + 1)
        .replace(/!important/giu, '')
        .trim()
        .replace(/\s+/gu, ' ')
        .toLowerCase();
    }

    sizes.push(size);
  }

  return sizes;
}

/**
 * Null when the served @page rules state the paper the renderer asks for;
 * otherwise one sentence naming R991, the CSS value and the renderer's value.
 *
 * THE WHOLE VALUE IS COMPARED, against the stated keyword alone. `a4
 * landscape` is refused although it names A4: the orientation keyword is what
 * turned every page landscape in R982's measurement, and the renderer states
 * no orientation either. Explicit dimensions (`210mm 297mm`) are refused too:
 * comparing lengths needs a tolerance, which is the PDF reader's job
 * (tests/support/pdf-pages.ts), not this one's.
 *
 * Zero rules and more than one are refusals of their own, distinct from a
 * mismatch: no rule means nothing states the CSS page, and two mean which one
 * wins is a cascade question nobody asserted.
 */
export function pageSizeRefusal(format: string, sizes: readonly (string | null)[]): string | null {
  const expected = cssPageSizeFor(format);
  const wanted = `the renderer asks for format ${JSON.stringify(format)}, which is \`size: ${expected}\``;

  if (sizes.length === 0) {
    return `R991: the served CSS carries no @page rule, so nothing states the CSS page; ${wanted}`;
  }

  if (sizes.length > 1) {
    return (
      `R991: the served CSS carries ${sizes.length} @page rules (sizes ${sizes
        .map((size) => (size === null ? '(none)' : `\`${size}\``))
        .join(', ')}); one is expected, so which one wins is unasserted; ${wanted}`
    );
  }

  const [served] = sizes;

  if (served === null || served === undefined) {
    return `R991: the served @page rule declares no size; ${wanted}`;
  }

  if (served !== expected) {
    return `R991: the served @page rule says \`size: ${served}\`, but ${wanted}`;
  }

  return null;
}
