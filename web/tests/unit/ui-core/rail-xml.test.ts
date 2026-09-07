// web/tests/unit/ui-core/rail-xml.test.ts
//
// renderRailSvg's output is the ONLY string in this product that bypasses
// React's escaping: tasks/todo.md:153 designates FW8's wrapper as "the only
// permitted dangerouslySetInnerHTML". So every character this repo has been
// able to treat as ordinary text until now becomes markup here, and an
// ampersand in a band name or an aria-label would produce broken XML in three
// renderers at once - the browser, the PDF and the OG raster.
//
// The escaping is therefore written here, deliberately, and NOT delegated to
// XMLSerializer: that is a DOM API, it does not exist in Node, and it would
// produce different bytes in the browser than in the test runner - destroying
// the byte-identity SPEC 19 and 21 require. The lib/ui/core fence now blocks
// it outright (see rail-fence.test.ts).
//
// The five XML entity characters are all covered, not just the three that
// break text nodes, because the same strings go into ATTRIBUTES - the
// aria-label above all - where a quote is what breaks out.

import { describe, expect, it } from 'vitest';
import { escapeXml } from '@/lib/ui/core/rail/xml';

describe('every XML entity character is escaped', () => {
  const CASES: ReadonlyArray<readonly [string, string, string]> = [
    ['ampersand', '&', '&amp;'],
    ['less-than', '<', '&lt;'],
    ['greater-than', '>', '&gt;'],
    ['double quote', '"', '&quot;'],
    ['apostrophe', "'", '&apos;'],
  ];

  for (const [name, raw, escaped] of CASES) {
    it(`escapes the ${name}`, () => {
      expect(escapeXml(raw)).toBe(escaped);
    });
  }

  it('escapes all five at once, in one pass', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });

  it('escapes the ampersand FIRST, so an escape is never double-escaped', () => {
    // The ordering bug that looks fine on every single-character test: if
    // '<' were replaced before '&', the '&' of '&lt;' would then be replaced
    // and the output would read '&amp;lt;'. One character in, one entity out.
    expect(escapeXml('<')).toBe('&lt;');
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
    expect(escapeXml('a & b < c')).toBe('a &amp; b &lt; c');
  });

  it('leaves ordinary French text alone, accents and all', () => {
    // The copy really does contain these: statuses.ts carries U+2019.
    expect(escapeXml('Sécurité sociale France')).toBe('Sécurité sociale France');
    expect(escapeXml('le régime ne s’applique plus')).toBe('le régime ne s’applique plus');
  });

  it('leaves the mandated separators untouched', () => {
    // U+00A0 and U+202F are not XML-significant and must survive byte-exact:
    // they are the codepoints SPEC 6.4 mandates and FW6 asserted.
    const withSeparators = `34,6\u00A0%`;
    expect(escapeXml(withSeparators)).toBe(withSeparators);
    expect(escapeXml(withSeparators).charCodeAt(4)).toBe(0x00a0);
    expect(escapeXml(`1\u202F234,5`).charCodeAt(1)).toBe(0x202f);
  });
});

describe('it cannot be broken out of', () => {
  it('neutralises a tag-closing payload', () => {
    const payload = '</text><script>alert(1)</script><text>';

    expect(escapeXml(payload)).not.toContain('<script');
    expect(escapeXml(payload)).not.toContain('</text>');
    expect(escapeXml(payload)).toBe(
      '&lt;/text&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;text&gt;',
    );
  });

  it('neutralises an attribute-closing payload', () => {
    // The aria-label case: a quote ends the attribute and everything after it
    // becomes markup. This is why the quote characters are in the set.
    const payload = '" onload="alert(1)';

    expect(escapeXml(payload)).toBe('&quot; onload=&quot;alert(1)');
    expect(escapeXml(payload)).not.toContain('"');
  });

  it('treats a template-literal interpolation as literal text', () => {
    // A ${...} arriving as DATA is not interpolated - interpolation happens
    // when the template is PARSED, not when a string flows through it - and
    // this pins that, because the rail builds its markup from template
    // literals and the intuition that a ${} in the data might execute is a
    // reasonable one to check rather than assert.
    const raw = '${1 + 1}';

    expect(escapeXml(raw)).toBe('${1 + 1}');
    expect(escapeXml(raw)).not.toBe('2');
    expect(escapeXml(raw)).toContain('${');
  });

  it('survives a payload combining all of it', () => {
    const nasty = `\${x}" & <b>'</b>`;

    expect(escapeXml(nasty)).toBe('${x}&quot; &amp; &lt;b&gt;&apos;&lt;/b&gt;');
  });
});

describe('the escaped output actually parses as XML', () => {
  // The assertions above pin the exact bytes; this pins the PROPERTY those
  // bytes exist for, so a future rewrite that changes the entities but keeps
  // the document well-formed still passes.
  const parseable = (text: string): boolean => {
    const doc = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><text aria-label="${text}">${text}</text></svg>`;
    // No DOMParser here: lib/ui/core is DOM-free and so is its test surface.
    // A minimal well-formedness check is enough - an unescaped < or & or a
    // stray quote inside the attribute is exactly what would break it.
    const insideAttribute = doc.slice(doc.indexOf('aria-label="') + 'aria-label="'.length);
    const attributeValue = insideAttribute.slice(0, insideAttribute.indexOf('"'));

    return (
      attributeValue === text &&
      !/&(?!(amp|lt|gt|quot|apos);)/.test(text) &&
      !/[<>]/.test(text)
    );
  };

  for (const payload of [
    'Sécurité sociale France',
    '</text><script>alert(1)</script>',
    '" onload="alert(1)',
    `&<>"'`,
    '${1 + 1}',
    'Imposition Suisse & France',
  ]) {
    it(`escaped ${JSON.stringify(payload.slice(0, 24))} is well-formed`, () => {
      expect(parseable(escapeXml(payload))).toBe(true);
    });
  }

  it('and the UNescaped payloads are not - so the check above is not vacuous', () => {
    expect(parseable('</text><script>')).toBe(false);
    expect(parseable('" onload="x')).toBe(false);
    expect(parseable('a & b')).toBe(false);
  });
});
