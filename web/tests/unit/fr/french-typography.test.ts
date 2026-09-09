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

describe('the source, for the strings a runtime walk cannot see', () => {
  const scanned: { file: string; line: number; text: string }[] = [];
  let commentLines = 0;

  for (const file of FILES) {
    const lines = readFileSync(join(DIR, file), 'utf8').split('\n');

    lines.forEach((line, index) => {
      if (isComment(line)) {
        commentLines += 1;

        return;
      }

      if (offences(line).length > 0) scanned.push({ file, line: index + 1, text: line.trim() });
    });
  }

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
});
