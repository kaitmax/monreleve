// web/tests/support/markup.ts
//
// renderToStaticMarkup escapes, correctly. "Taux à déclarer à l'AFC" reaches
// the markup as "l&#x27;AFC", so a containment check against the French
// string in lib/fr fails against a component that is doing exactly the right
// thing. Both RateDisplay and LegalNote went red on their first run for that
// reason, which is what moved this out of one test file and into a shared one.
//
// DECODING IS THE HONEST FIX, rather than escaping the expectation. What a
// component owes is the text a READER sees; pinning "&#x27;" would make every
// copy assertion restate React's serialisation rules, and would go stale if
// React ever changed which characters it escapes.
//
// Deliberately narrow: the five entities React emits, and no HTML parser.
// A parser would also swallow real defects - unbalanced tags, a stray
// entity in the copy itself - by silently repairing them.
//
// It is not a .test.ts file, so the include globs do not collect it, in the
// same way tests/unit/calc-engine/arbitraries.ts is not collected.

const ENTITIES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&#x27;/g, String.fromCharCode(39)],
  [/&quot;/g, String.fromCharCode(34)],
  [/&lt;/g, String.fromCharCode(60)],
  [/&gt;/g, String.fromCharCode(62)],
  // Last, and this order is the point: decoding &amp; first would turn
  // "&amp;#x27;" - a literal ampersand that a component correctly escaped -
  // into an apostrophe, inventing text nobody rendered.
  [/&amp;/g, String.fromCharCode(38)],
];

/** The text a reader sees, from the markup a server renderer produced. */
export function text(html: string): string {
  return ENTITIES.reduce((carried, [pattern, character]) => carried.replace(pattern, character), html);
}
