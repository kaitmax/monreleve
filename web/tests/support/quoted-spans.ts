// web/tests/support/quoted-spans.ts
//
// The QUOTED CONTENT of one source line, and nothing else.
//
// EXTRACTED BECAUSE IT WAS ABOUT TO HAVE A THIRD COPY. french-typography
// needs it to find no-break spaces in the strings a runtime walk cannot reach;
// copy-codepoints needs it to tell a French apostrophe from a string
// delimiter (R126). A third hand-written copy of a scanner whose failure mode
// is SILENT UNDER-REPORTING is exactly the shape of hole this project keeps
// finding, so there is one implementation with one set of tests.
//
// WHY A SCANNER AT ALL, rather than reading the values at runtime: lib/fr has
// several functions that build a sentence from an argument, and their template
// literals are invisible to a walk over exported values. The runtime walk
// carries the weight for what it can reach; this covers the gap.
//
// PER LINE, NOT PER FILE, deliberately. Tracking quote state across a whole
// file means one apostrophe in a trailing comment - "the panel's own order" -
// opens a span that swallows every line until the next quote, and the failure
// is silent under-reporting. Per line, a stray quote costs at most that line.
// The multi-line-template case it cannot follow is asserted absent from
// lib/fr by its callers.

const BACKSLASH = String.fromCharCode(92);
const APOSTROPHE = String.fromCharCode(39);
const QUOTES = [APOSTROPHE, '"', '`'];

export interface Span {
  /** The characters between the quotes, escapes left as written. */
  readonly text: string;
  /** Which quote opened it, so a caller can tell a delimiter from content. */
  readonly quote: string;
  /** Index in the line where `text` begins. */
  readonly start: number;
}

/** Every quoted span on one line, in order. */
export function quotedSpansWithPositions(line: string): readonly Span[] {
  const spans: Span[] = [];
  let open: string | null = null;
  let buffer = '';
  let start = 0;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] ?? '';

    if (open === null) {
      if (QUOTES.includes(character)) {
        open = character;
        buffer = '';
        start = index + 1;
      }

      continue;
    }

    if (character === BACKSLASH) {
      // An escape consumes the next character, so \' does not close a span.
      buffer += character + (line[index + 1] ?? '');
      index += 1;
      continue;
    }

    if (character === open) {
      spans.push({ text: buffer, quote: open, start });
      open = null;
      continue;
    }

    buffer += character;
  }

  // An unterminated span is either a template continued on the next line -
  // which callers assert absent - or a quote inside a trailing comment.
  // Keeping what was collected is the safe direction: it can only add
  // candidates, never hide one.
  if (open !== null) spans.push({ text: buffer, quote: open, start });

  return spans;
}

/** Just the text of every quoted span. */
export function quotedSpans(line: string): readonly string[] {
  return quotedSpansWithPositions(line).map((span) => span.text);
}

/** A full-line comment in this codebase's style. */
export function isComment(line: string): boolean {
  const trimmed = line.trim();

  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}
