// web/tests/unit/fr/french-typography.test.ts
//
// RULING R91: "the codepoint registry asserts no ASCII space before : ; ? ! %
// in any lib/fr string - new copy complies or fails. Cheaper now than after
// twenty more strings."
//
// WHAT THE RULE IS. French typography puts a NO-BREAK SPACE (U+00A0) before a
// colon, a semicolon, a question mark, an exclamation mark and a percent sign.
// Not a nicety: with an ordinary space a line can break between the last word
// and the punctuation, so a narrow column renders "il vous reste" on one line
// and ":" alone on the next. At 320 px, which SPEC 16 requires, that happens.
//
// TWO SCANS, AND THE FIRST IS THE REAL ONE.
//
//   1. RUNTIME VALUES. Every lib/fr module is imported and every exported
//      value walked - strings, arrays, nested objects. This tests what SHIPS,
//      and it cannot be confused by a comment, a type annotation, or a URL.
//   2. SOURCE LINES. The runtime walk cannot see inside a function, and
//      lib/fr has several that build a sentence from an argument - shell.ts's
//      reviewDone is `Derniere verification reglementaire : ${date}`. So the
//      source is scanned too, skipping full-line comments.
//
// WHY BOTH RATHER THAN JUST THE SOURCE. A source scan alone has to decide what
// is a comment and what is a string, and it gets that wrong eventually - the
// FW10 inventory found 53 candidate sites of which 14 were prose in comments
// explaining the rule. A runtime walk has no such ambiguity for the values it
// can reach, so it carries the weight and the source scan covers the gap.
//
// THE CONSEQUENCE FOR ASSERTIONS, which is ruling R66/R71's territory and the
// reason this pass is not just a find-and-replace. Testing Library normalises
// U+00A0 to a space ON THE DOM SIDE ONLY. So `getByRole('link', { name: 'Le
// seuil de 40<U+00A0>%' })` does NOT match a DOM whose accessible name has been
// normalised to 'Le seuil de 40 %' - it goes red against correct copy. Every
// assertion that compares against one of these strings must read textContent
// and compare exactly, or use the constant on both sides. FW11's typography
// increment fixed the ones this pass broke; this comment is why.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.cwd(), 'lib', 'fr');

/** The five marks French sets off with a no-break space. */
const MARKS = [':', ';', '?', '!', '%'];

const SPACE = String.fromCharCode(32);
const NBSP = String.fromCharCode(0x00a0);

/** Every offending position in one string. */
function offences(value: string): string[] {
  const found: string[] = [];

  for (let index = 1; index < value.length; index += 1) {
    if (value[index - 1] === SPACE && MARKS.includes(value[index] ?? '')) {
      const from = Math.max(0, index - 28);

      found.push(`"...${value.slice(from, index + 1)}" (ASCII space before ${value[index]})`);
    }
  }

  return found;
}

const FILES = readdirSync(DIR).filter((name) => name.endsWith('.ts'));

// ---------------------------------------------------------------------------
// SCAN 1 - the values that actually ship
// ---------------------------------------------------------------------------

interface Walked {
  readonly strings: number;
  readonly functions: number;
  readonly offenders: string[];
}

async function walkModules(): Promise<Walked> {
  const offenders: string[] = [];
  let strings = 0;
  let functions = 0;

  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      strings += 1;
      for (const offence of offences(value)) offenders.push(`${path}: ${offence}`);

      return;
    }

    if (typeof value === 'function') {
      functions += 1;

      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));

      return;
    }

    if (value !== null && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) walk(item, `${path}.${key}`);
    }
  };

  for (const file of FILES) {
    const module: Record<string, unknown> = await import(`@/lib/fr/${file.replace('.ts', '')}`);

    for (const [name, value] of Object.entries(module)) walk(value, `${file}:${name}`);
  }

  return { strings, functions, offenders };
}

describe('no shipped French string puts an ASCII space before : ; ? ! % (R91)', () => {
  it('walked a plausible amount of copy, so the assertion is not vacuous', async () => {
    const { strings, functions } = await walkModules();

    expect(FILES.length).toBeGreaterThan(10);
    expect(strings).toBeGreaterThan(80);
    // Several modules export sentence builders; the source scan covers them.
    expect(functions).toBeGreaterThan(0);
  });

  it('finds no offender among the exported values', async () => {
    const { offenders } = await walkModules();

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('and the detector would actually catch one', async () => {
    // An absence assertion with a broken detector passes forever. Both
    // directions, on every mark.
    for (const mark of MARKS) {
      expect(offences(`un mot ${mark}`), mark).toHaveLength(1);
      expect(offences(`un mot${NBSP}${mark}`), `nbsp before ${mark}`).toHaveLength(0);
    }

    // Not a false positive where no space precedes the mark.
    expect(offences('40%')).toHaveLength(0);
    expect(offences('deux:trois')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SCAN 2 - template literals inside functions, which the walk cannot reach
// ---------------------------------------------------------------------------

/** A full-line comment in this codebase's style. */
const isComment = (line: string): boolean => {
  const trimmed = line.trim();

  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
};

/**
 * The QUOTED CONTENT of one source line, and nothing else.
 *
 * THE SCAN USED TO READ WHOLE LINES, and this file's own header said what
 * would happen: "a source scan alone has to decide what is a comment and what
 * is a string, and it gets that wrong eventually." It did, on TypeScript
 * punctuation rather than on prose. FW12 put the first conditional type and
 * the first ternary into lib/fr -
 *
 *   type EveryCodeIsListed = WarningCode extends (typeof CODES)[number] ? ... : never;
 *   warning.regime === 'residence-1983' ? 'Les jours...' : 'Les jours...'
 *
 * - and ` ? `, ` : ` in an operator position are four reported offences in
 * correct code. A rule about French sentences was reading a language whose
 * syntax uses two of the five marks.
 *
 * NOTHING IS GIVEN UP BY NARROWING IT. The rule governs French text, French
 * text lives in string literals, and the runtime walk above still reads every
 * exported value whole. What this scan adds is the strings a walk cannot
 * reach - the insides of functions - and those are still read, now without
 * the syntax around them.
 *
 * PER LINE, NOT PER FILE, deliberately. Tracking quote state across a whole
 * file means one apostrophe in a trailing comment - "the panel's own order" -
 * opens a span that swallows every line until the next quote, and the failure
 * is silent under-reporting. Per line, a stray quote costs at most that line,
 * and the multi-line-template case it cannot handle is asserted absent below.
 */
function quotedSpans(line: string): string[] {
  const QUOTES = ["'", '"', '`'];
  const spans: string[] = [];
  let open: string | null = null;
  let buffer = '';

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? '';

    if (open === null) {
      if (QUOTES.includes(character)) {
        open = character;
        buffer = '';
      }

      continue;
    }

    if (character === '\\') {
      // An escape consumes the next character, so \' does not close a span.
      buffer += character + (line[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (character === open) {
      spans.push(buffer);
      open = null;
      continue;
    }

    buffer += character;
  }

  // An unterminated span is either a template continued on the next line -
  // which the assertion below forbids in lib/fr - or a quote inside a
  // trailing comment. Scanning what was collected is the safe direction: it
  // can only add candidates, never hide one.
  if (open !== null) spans.push(buffer);

  return spans;
}

describe('the source, for the strings a runtime walk cannot see', () => {
  const scanned: { file: string; line: number; text: string }[] = [];
  let commentLines = 0;
  let quotedLines = 0;
  let unbalancedTemplates = 0;

  for (const file of FILES) {
    const lines = readFileSync(join(DIR, file), 'utf8').split('\n');

    lines.forEach((line, index) => {
      if (isComment(line)) {
        commentLines += 1;

        return;
      }

      if ((line.match(/`/gu) ?? []).length % 2 === 1) unbalancedTemplates += 1;

      const spans = quotedSpans(line);

      if (spans.length > 0) quotedLines += 1;

      if (spans.some((span) => offences(span).length > 0)) {
        scanned.push({ file, line: index + 1, text: line.trim() });
      }
    });
  }

  it('reads the quoted text on a useful number of lines', () => {
    // NON-VACUITY FOR THE NARROWING. An extractor that returned nothing would
    // make the assertion below pass forever, which is the failure mode of
    // every absence assertion and the reason the detector has its own test.
    expect(quotedLines).toBeGreaterThan(150);
  });

  it('has no template literal spanning two lines, which the extractor cannot follow', () => {
    // The one shape a per-line extractor gets wrong: a template opened on one
    // line and closed on another leaves its middle lines unquoted and
    // unscanned. There are none in lib/fr today - the copy is written as
    // concatenated single-line strings - and this is what makes the first one
    // a failure here rather than a silent hole.
    expect(unbalancedTemplates).toBe(0);
  });

  it('skipped the comment prose rather than reporting it', () => {
    // lib/fr is heavily commented, and several comments discuss this very rule
    // - "the copy would still say 40 % after a rule change". Reporting those
    // would train everyone to ignore the failure. The count is asserted so the
    // skip cannot quietly grow to cover real lines.
    expect(commentLines).toBeGreaterThan(200);
  });

  it('finds no offender on a non-comment line', () => {
    const report = scanned.map((hit) => `${hit.file}:${hit.line}  ${hit.text}`);

    expect(report, report.join('\n')).toEqual([]);
  });

  describe('and the extractor reads strings rather than syntax', () => {
    // THE SAME DISCIPLINE THE DETECTOR HAS. An absence assertion built on a
    // broken extractor passes forever, and narrowing a scan is exactly the
    // change that can do that quietly - so both directions, on the shapes
    // that actually occur in lib/fr.

    it('reads a single-quoted string', () => {
      expect(quotedSpans("  body: 'reste 40 %',")).toEqual(['reste 40 %']);
    });

    it('reads both halves of a concatenation', () => {
      expect(quotedSpans("  'un mot ' + 'deux :',")).toEqual(['un mot ', 'deux :']);
    });

    it('reads a template and its interpolation', () => {
      expect(quotedSpans('  `pour ${year} : le calcul`,')).toEqual(['pour ${year} : le calcul']);
    });

    it('ignores a conditional type, which is what broke the whole-line scan', () => {
      const line = '  type Every = Code extends (typeof CODES)[number] ? true : never;';

      expect(quotedSpans(line)).toEqual([]);
      expect(offences(line).length).toBeGreaterThan(0);
    });

    it('ignores a ternary but keeps the strings inside it', () => {
      const line = "  regime === 'residence-1983' ? 'le statut' : 'les jours',";

      expect(quotedSpans(line)).toEqual(['residence-1983', 'le statut', 'les jours']);
    });

    it('still catches an offence inside a string on a line full of syntax', () => {
      // The direction that matters. Narrowing must not let a real offence
      // through because it sits next to an operator.
      const line = "  const x = ok ? 'il reste 3 jours :' : 'rien';";
      const found = quotedSpans(line).flatMap((span) => offences(span));

      expect(found).toHaveLength(1);
    });

    it('does not let an escaped quote close a span early', () => {
      const line = "  'l\\'accord de 1983 :',";

      expect(quotedSpans(line).flatMap((span) => offences(span))).toHaveLength(1);
    });

    it('reads an apostrophe inside a double-quoted string as text', () => {
      // The codebase's own convention: a string containing an apostrophe is
      // written with double quotes. The apostrophe must not open a span.
      expect(quotedSpans('  "n\'a pas ete verifie :",')).toEqual(["n'a pas ete verifie :"]);
    });
  });
});
