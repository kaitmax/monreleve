// web/lib/ui/react/JsonLd/JsonLd.tsx
//
// A <script type="application/ld+json"> element, and the only place in the
// product that emits one.
//
// WHY A COMPONENT FOR FIVE LINES. Because the alternative is the same script
// element written at every page that wants structured data, and structured
// data is the kind of thing that acquires a second, subtly different
// implementation. One component; two calculators and every future guide emit
// through it.
//
// NO dangerouslySetInnerHTML, AND THAT IS A MEASUREMENT RATHER THAN A
// PREFERENCE. Every JSON-LD example written for React says to use it, on the
// reasoning that React escapes a string child as HTML text and an HTML parser
// does not decode entities inside a script element - so "&" would reach the
// JSON parser as "&amp;" and the document would carry malformed JSON that
// nothing looking at React's output would notice.
//
// That reasoning is out of date. React 19, rendered and read:
//
//   in:   {"a":"x & y","b":"</script>","c":"<z>"}
//   out:  {"a":"x & y","b":"</script>","c":"<z>"}
//
// It does NOT entity-escape a script element's text - "&" and "<z>" come
// through unchanged - and it neutralises the one sequence that matters by
// escaping the "s" of a closing tag into s, which is valid inside a JSON
// string and parses back to "</script>". So a text child is both correct and
// safe, and the product keeps the property that
// tests/unit/meta/inner-html.test.ts pins: exactly ONE injection site, in
// ThresholdRail, where the rail's SVG has no alternative.
//
// serialiseLd STAYS ANYWAY, and escapes every "<" as <. Belt and braces:
// the safety of this element should be a property of our serialiser rather
// than of a framework behaviour nobody here controls.

import { serialiseLd } from '@/lib/content/jsonld';

export interface JsonLdProps {
  /** Any JSON-serialisable structured-data object. */
  readonly data: unknown;
}

export function JsonLd({ data }: JsonLdProps) {
  return <script type="application/ld+json">{serialiseLd(data)}</script>;
}
