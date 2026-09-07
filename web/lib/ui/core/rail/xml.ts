// web/lib/ui/core/rail/xml.ts
//
// The rail builds markup by hand, so it escapes by hand.
//
// renderRailSvg's output is the only string in this product that bypasses
// React's escaping - tasks/todo.md designates FW8's wrapper as "the only
// permitted dangerouslySetInnerHTML". Every string that reaches it is
// therefore markup, not text: an ampersand in a band name, or a quote in an
// aria-label, produces a broken document in three renderers at once.
//
// NOT XMLSerializer, and not any DOM API. Three reasons, in order of weight:
// it does not exist in Node, so the PDF and OG paths would have no escaping
// at all; it would produce different bytes in the browser than in the test
// runner, destroying the byte-identity SPEC 19 and 21 require; and it is a
// DOM dependency inside lib/ui/core, which the fence now rejects outright.
//
// ALL FIVE entity characters, not the three that break a text node. The same
// strings go into attributes - the aria-label above all - and there a quote
// is what breaks out.

/**
 * Escape a string for use as XML text OR as a double-quoted attribute value.
 *
 * The ampersand goes FIRST and must stay first. Replacing '<' before '&'
 * would then find the '&' of the '&lt;' just written and escape it again,
 * turning one character into '&amp;lt;'. Every single-character test passes
 * either way, which is why the ordering has its own test.
 */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
