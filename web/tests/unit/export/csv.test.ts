// web/tests/unit/export/csv.test.ts
//
// The CSV export. FW25 increment 1.

import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, quoteField, toCsv } from '@/lib/export/csv';
import type { AnnexRow } from '@/lib/dossier/service';

function row(overrides: Partial<AnnexRow> = {}): AnnexRow {
  return {
    dayDate: '2026-07-07',
    portion: 'FULL',
    kind: 'HOME',
    absenceReason: null,
    note: null,
    provenance: 'MANUAL',
    detectedKind: null,
    firstRecordedAt: '2026-07-07T18:00:00.000Z',
    lastModifiedAt: null,
    clientClaimedAt: null,
    late: false,
    ...overrides,
  };
}

const BOM = '﻿';

/** The header line, without the BOM, as a reader's spreadsheet sees it. */
function headerOf(csv: string): string {
  return csv.slice(BOM.length).split('\r\n')[0] ?? '';
}

describe('AC1: the columns are exact and stable', () => {
  it('matches SPEC 12 verbatim, in SPEC 12 order', () => {
    // A SNAPSHOT IN THE TEST RATHER THAN A FILE, so a reviewer reading this
    // test sees the contract instead of a hash. SPEC §12: "CSV columns, exact
    // and stable".
    //
    // "Stable" is the same force as the API freeze, and the failure is quieter:
    // a spreadsheet built on these headers does not break when one is renamed,
    // it shows an empty column.
    expect(headerOf(toCsv([]))).toBe(
      'dayDate,portion,kind,absenceReason,provenance,detectedKind,note,' +
        'firstRecordedAt,lastModifiedAt,clientClaimedAt,late',
    );
  });

  it('writes the header from the same list the rows are built from', () => {
    // R206: one home. A header written independently of the row builder is two
    // descriptions of one contract, and they drift on the day a column moves.
    expect(CSV_COLUMNS).toHaveLength(11);
    expect(headerOf(toCsv([])).split(',')).toEqual([...CSV_COLUMNS]);
  });
});

describe('AC1: it opens in a spreadsheet without mangling', () => {
  it('starts with a BOM, or Excel reads UTF-8 as its ANSI code page', () => {
    // Without it `Détection corrigée` arrives as `DÃ©tection corrigÃ©e` in the
    // one program the reader is most likely to use.
    expect(toCsv([]).startsWith(BOM)).toBe(true);
  });

  it('keeps accents intact through a round trip', () => {
    // POSITIVE SIGNAL (R133). "Has a BOM" is a claim about three bytes; this is
    // a claim about what a reader sees.
    const csv = toCsv([row({ note: 'Détection corrigée — journée à Genève' })]);

    expect(csv).toContain('Détection corrigée — journée à Genève');
  });

  it('uses CRLF, as RFC 4180 specifies', () => {
    const csv = toCsv([row()]);

    expect(csv).toContain('\r\n');
    // And no bare LF anywhere: a mixed file is the one that breaks oldest.
    expect(csv.split('\r\n').join('')).not.toContain('\n');
  });

  it('ends with a line break rather than mid-record', () => {
    expect(toCsv([row()]).endsWith('\r\n')).toBe(true);
  });
});

describe('AC1: a date must not become a number', () => {
  it('writes the ISO day, byte for byte', () => {
    // THE HALF WE CONTROL. Excel parsing `2026-07-07` as 7 July is correct
    // behaviour and the day survives it. What must never happen is writing an
    // ambiguous form: `03/04/2026` is a different day in Paris and in New York,
    // and a dossier that means two things depending on who opens it is worse
    // than one that is hard to read.
    const csv = toCsv([row({ dayDate: '2026-07-07' })]);

    expect(csv).toContain('2026-07-07');
    expect(csv).not.toMatch(/07\/07\/2026|07\.07\.2026/u);
  });

  it('sorts chronologically as TEXT, which is what ISO buys', () => {
    // A reader who sorts the column without parsing it still gets the right
    // order. That property is why the format is ISO rather than merely
    // unambiguous.
    const days = ['2026-12-31', '2026-01-02', '2026-07-07'];
    const sorted = [...days].sort();

    expect(sorted).toEqual(['2026-01-02', '2026-07-07', '2026-12-31']);
  });

  it('writes timestamps as full ISO instants, distinguishable from days', () => {
    const csv = toCsv([row()]);

    expect(csv).toContain('2026-07-07T18:00:00.000Z');
  });
});

describe('AC1: quoting survives what a note can contain', () => {
  // EACH CASE NAMED, rather than trusting a blanket rule. A writer that quotes
  // everything passes all of these without anybody checking which one mattered.

  it('quotes a comma, which would otherwise split the row', () => {
    const csv = toCsv([row({ note: 'Genève, puis Nyon' })]);

    expect(csv).toContain('"Genève, puis Nyon"');
  });

  it('doubles an embedded quote, per RFC 4180', () => {
    const csv = toCsv([row({ note: 'dit « oui » et "non"' })]);

    expect(csv).toContain('"dit « oui » et ""non"""');
  });

  it('quotes a newline, so one note cannot become two rows', () => {
    const csv = toCsv([row({ note: 'ligne un\nligne deux' })]);

    expect(csv).toContain('"ligne un\nligne deux"');

    // AND THE ROW COUNT IS STILL TWO - header plus one record. A note with a
    // newline silently becoming an extra row is the defect this prevents, and
    // counting is the only assertion that sees it.
    const records = csv.slice(BOM.length).split('\r\n').filter((line) => line !== '');

    expect(records).toHaveLength(2);
  });

  it('quotes a SEMICOLON, which the standard does not require', () => {
    // Several European Excel locales use `;` as the delimiter. A note
    // containing one would split the row there for exactly the readers this
    // document is for.
    const csv = toCsv([row({ note: 'congé; reprise lundi' })]);

    expect(csv).toContain('"congé; reprise lundi"');
  });

  it('leaves an ordinary note unquoted, so the file reads as a document', () => {
    // THE OTHER DIRECTION. A writer that quoted unconditionally would pass
    // every test above and produce a wall of quotation marks.
    const csv = toCsv([row({ note: 'bureau Genève' })]);

    expect(csv).toContain(',bureau Genève,');
  });

  it('writes an empty cell for a null, never the word null', () => {
    const csv = toCsv([row({ note: null, absenceReason: null })]);

    expect(csv).not.toContain('null');
  });
});

describe('the late flag is a value a spreadsheet can filter', () => {
  it('writes true and false, the same two words in every row', () => {
    const csv = toCsv([row({ late: true }), row({ late: false })]);
    const records = csv.slice(BOM.length).split('\r\n').filter((l) => l !== '').slice(1);

    expect(records[0]?.endsWith(',true')).toBe(true);
    expect(records[1]?.endsWith(',false')).toBe(true);
  });
});

describe('R230: the format that executes is defended', () => {
  // ==========================================================================
  // R230 - DEFEND WHERE IT EXECUTES, PRESERVE WHERE IT IS EVIDENCE
  // ==========================================================================
  //
  // `note` is 500 characters of free text. A note beginning `=`, `+`, `-` or
  // `@` is evaluated as a FORMULA when the file is opened in Excel or
  // LibreOffice - the CSV injection class.
  //
  // THE THREAT MODEL IS UNUSUAL AND REAL. The attacker and the victim are not
  // the same person: the user writes their own dossier and hands it to a
  // fiduciaire, so a crafted note runs in the ACCOUNTANT'S spreadsheet. It is
  // not a way to attack another user of this product; it is a way to attack
  // the person the document is FOR.
  //
  // THE CONFLICT BETWEEN DEFENDING AND PRESERVING DISSOLVES ONCE THE CSV IS
  // NOT THE EVIDENCE DOCUMENT. The PDF is. So the CSV - the format that
  // executes - is defended, and the API payload and the document - the formats
  // that ARE the record - carry the note byte for byte.
  //
  // Those two halves are asserted in different files on purpose: a mitigation
  // nobody bounded is one that spreads to the surfaces that must not have it.
  // The other half lives in tests/db/entries-read and tests/db/print-route.

  it.each(['=', '+', '-', '@'])('prefixes an apostrophe on a note opening with %s', (lead) => {
    const csv = toCsv([row({ note: `${lead}1+1` })]);

    expect(csv).toContain(`'${lead}1+1`);
  });

  it('leaves an ordinary note untouched, so the guard is not blanket', () => {
    // A mitigation that prefixed everything would pass every test above and
    // put a stray apostrophe on all 261 rows of a document somebody files.
    const csv = toCsv([row({ note: 'Bureau de Genève' })]);

    expect(csv).toContain('Bureau de Genève');
    expect(csv).not.toContain("'Bureau");
  });

  it('does not prefix a note that merely CONTAINS one of the characters', () => {
    // Excel evaluates on the FIRST character. `Réunion 9h-17h` is not a
    // formula, and prefixing it would corrupt an ordinary note.
    const csv = toCsv([row({ note: 'Réunion 9h-17h' })]);

    expect(csv).toContain('Réunion 9h-17h');
    expect(csv).not.toContain("'Réunion");
  });

  it('prefixes BEFORE quoting, so the apostrophe is inside the quotes', () => {
    // ORDER IS THE WHOLE CORRECTNESS OF THIS. Quoting first would produce
    // `'"=SUM(A1,B1)"` - an apostrophe outside the field, which is a malformed
    // record rather than a neutralised one, and RFC 4180 readers would reject
    // the row instead of displaying it.
    const csv = toCsv([row({ note: '=SUM(A1,B1)' })]);

    expect(csv).toContain(`"'=SUM(A1,B1)"`);
    expect(csv).not.toContain(`'"=SUM`);
  });

  it('applies to the note column ONLY, because every other column is parsed', () => {
    // The scope is not squeamishness. `dayDate` must stay a date a spreadsheet
    // can parse, and prefixing it would turn the whole column into text - which
    // is the corruption the ISO decision at the top of lib/export/csv.ts spends
    // a paragraph refusing. `note` is the only free-text column, and the only
    // one where a leading `=` can be the user's own bytes.
    //
    // `kind` is a closed vocabulary and cannot hold this value in practice; it
    // is passed here to prove the mitigation is SCOPED rather than global.
    const csv = toCsv([row({ kind: '=cmd', note: null })]);

    expect(csv).toContain('=cmd');
    expect(csv).not.toContain("'=cmd");
  });

  it('still neutralises when the formula is the whole note', () => {
    const csv = toCsv([row({ note: '@SUM(1)' })]);

    expect(csv).toContain(`'@SUM(1)`);
  });
});

describe('quoteField, directly', () => {
  it.each([
    ['plain', 'bureau', 'bureau'],
    ['comma', 'a,b', '"a,b"'],
    ['semicolon', 'a;b', '"a;b"'],
    ['quote', 'a"b', '"a""b"'],
    ['newline', 'a\nb', '"a\nb"'],
    ['carriage return', 'a\rb', '"a\rb"'],
    ['empty', '', ''],
  ])('%s', (_label, input, expected) => {
    expect(quoteField(input)).toBe(expected);
  });
});
