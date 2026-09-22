// web/lib/export/csv.ts
//
// The dossier as a CSV. FW25 increment 1.
//
// ============================================================================
// THE COLUMNS ARE SPEC 12's, VERBATIM AND IN ITS ORDER
// ============================================================================
//
// SPEC §12: "CSV columns, exact and stable: dayDate, portion, kind,
// absenceReason, provenance, detectedKind, note, firstRecordedAt,
// lastModifiedAt, clientClaimedAt, late".
//
// "Exact and stable" is the same force as the API freeze: somebody builds a
// spreadsheet on these headers and a rename breaks it silently, because a
// spreadsheet does not fail - it shows an empty column. A snapshot test holds
// the header line.
//
// ============================================================================
// THE DATE FORMAT, AND WHY IT IS ISO
// ============================================================================
//
// `2026-07-07`, always, and never `07/07/2026` or `07.07.2026`.
//
// THE FAILURE BEING AVOIDED is not Excel showing a date as a date - that is a
// display transformation and the day survives it. It is AMBIGUITY: `07/07/2026`
// is the same string in French and American locales and means the same day only
// by luck; `03/04/2026` does not. A dossier that means a different day depending
// on who opens it is worse than one that is hard to read.
//
// ISO 8601 is unambiguous in every locale, sorts correctly as TEXT (so a reader
// who sorts the column without parsing it still gets chronological order), and
// is the same string the API already serialises. R206: one representation of a
// calendar day, everywhere.
//
// WHAT THIS FILE DOES NOT DO is force Excel to treat the DAY column as text.
// The two ways to do that - a leading apostrophe, or `="2026-07-07"` - both
// corrupt the file for every other reader, and the second writes a formula to
// prevent a formula. Excel parsing an ISO day as 7 July 2026 is CORRECT
// behaviour; the assertion below is that the bytes we write are the ISO string,
// which is the only half we control.
//
// The note column is different, and `neutraliseFormula` below says why.

import type { AnnexRow } from '@/lib/dossier/service';

/**
 * SPEC 12's columns, in SPEC 12's order.
 *
 * ONE HOME (R206). The header line is written from this array and the row
 * builder reads the same names, so a column added to one cannot be missing
 * from the other.
 */
export const CSV_COLUMNS = [
  'dayDate',
  'portion',
  'kind',
  'absenceReason',
  'provenance',
  'detectedKind',
  'note',
  'firstRecordedAt',
  'lastModifiedAt',
  'clientClaimedAt',
  'late',
] as const;

/**
 * The byte-order mark.
 *
 * WITHOUT IT EXCEL READS UTF-8 AS THE ANSI CODE PAGE and every accented
 * character in a French document becomes mojibake - `Détection corrigée`
 * arrives as `DÃ©tection corrigÃ©e`. The BOM is three bytes that make the file
 * open correctly in the one program the reader is most likely to use.
 *
 * It is invisible to anything that reads UTF-8 properly.
 */
const BOM = '﻿';

/**
 * CRLF, because RFC 4180 says so and Excel on Windows agrees.
 *
 * A lone LF opens fine in modern Excel and badly in enough older tooling that
 * the standard line ending is the safer default for a file somebody forwards to
 * an accountant.
 */
const CRLF = '\r\n';

/**
 * One field, quoted when it has to be.
 *
 * RFC 4180: a field containing a comma, a quote or a line break is wrapped in
 * quotes, and an embedded quote is doubled. A SEMICOLON needs no quoting by the
 * standard - but several European Excel locales use `;` as the delimiter, and a
 * note containing one would split a row there. Quoting it costs two bytes and
 * removes the question.
 *
 * EVERY FIELD COULD BE QUOTED UNCONDITIONALLY and some writers do. This one
 * quotes only what needs it, so the file a person opens in a text editor reads
 * as the document rather than as a wall of quotation marks - and the tests name
 * each case rather than trusting a blanket rule.
 */
export function quoteField(value: string): string {
  const needsQuoting = /[",;\r\n]/u.test(value);

  if (!needsQuoting) return value;

  return `"${value.split('"').join('""')}"`;
}

/**
 * The characters Excel and LibreOffice read as the start of a formula.
 *
 * Evaluation keys on the FIRST character only, which is why a note reading
 * `Réunion 9h-17h` is left alone: it contains a `-` and is not a formula.
 */
export const FORMULA_LEADS = ['=', '+', '-', '@'];

/**
 * A free-text note, made inert for a spreadsheet (R230).
 *
 * ============================================================================
 * DEFEND WHERE IT EXECUTES, PRESERVE WHERE IT IS EVIDENCE
 * ============================================================================
 *
 * A note beginning `=`, `+`, `-` or `@` is EVALUATED when the file is opened
 * in Excel or LibreOffice. The threat model is unusual and real: the attacker
 * and the victim are not the same person, because the user writes their own
 * dossier and hands it to a fiduciaire - so a crafted note runs in the
 * ACCOUNTANT'S spreadsheet. It is not a way to attack another user of this
 * product; it is a way to attack the person the document is FOR.
 *
 * THE OBJECTION TO MITIGATING IS THAT IT EDITS THE USER'S WORDS, in a product
 * whose whole claim is that it reports what was recorded. That objection is
 * answered by noticing the CSV is NOT the evidence document - the PDF is. So
 * the format that EXECUTES is defended here, and the formats that ARE the
 * record - the API payload and the document - carry the note byte for byte.
 * Those are asserted in tests/db/entries-read and tests/db/print-route, and
 * `docs/api-v1.md` states the difference so it is not a surprise.
 *
 * IT IS APPLIED TO `note` ALONE, and the scope is not squeamishness: every
 * other column is PARSED by the reader. Prefixing `dayDate` would turn the day
 * column into text, which is the corruption the ISO paragraph above spends
 * its length refusing.
 *
 * THE APOSTROPHE IS NOT PART OF THE VALUE. Excel consumes it as the
 * text-literal marker and displays the note as written; other readers show one
 * leading character that was not in the note. That visible cost is the reason
 * this is documented rather than silent.
 */
export function neutraliseFormula(value: string): string {
  const lead = value.charAt(0);

  return FORMULA_LEADS.includes(lead) ? `'${value}` : value;
}

/** An empty cell for a null, never the word "null". */
const cell = (value: string | null): string => (value === null ? '' : value);

/**
 * The CSV for one year.
 *
 * IT TAKES THE ANNEX, NOT THE ENTRIES. SPEC 12 exports the same rows the
 * document's evidence annex prints, in the same order - R175: the two bound one
 * property from opposite sides, and a test asserts they carry the same day set.
 * Building the CSV from a second query would be a second answer to "which days
 * are in this year", and the two would diverge the day one of them changed its
 * window.
 */
export function toCsv(annex: readonly AnnexRow[]): string {
  const lines = [CSV_COLUMNS.join(',')];

  for (const row of annex) {
    lines.push(
      [
        row.dayDate,
        // NULLABLE SINCE FW25b: an unlogged working day is a ROW now (SPEC 12
        // item 5), and it has no portion, no kind, no provenance and no
        // recording stamp. R175 binds the CSV and the annex to the same day
        // set, so a CSV that dropped the gap rows the PDF prints would be
        // exactly the drift that rule exists to prevent.
        cell(row.portion),
        cell(row.kind),
        cell(row.absenceReason),
        cell(row.provenance),
        cell(row.detectedKind),
        // NEUTRALISE, THEN QUOTE - the order is the correctness. Quoting
        // first would put the apostrophe OUTSIDE the field (`'"=SUM(A1,B1)"`),
        // which is a malformed record rather than a neutralised one. The
        // `.map(quoteField)` below is what runs second.
        neutraliseFormula(cell(row.note)),
        cell(row.firstRecordedAt),
        cell(row.lastModifiedAt),
        cell(row.clientClaimedAt),
        // A boolean a spreadsheet can filter on, and the same two words in
        // every row. `VRAI`/`FAUX` would be Excel's French display of a real
        // boolean, but the FILE is read by other tools too.
        row.late ? 'true' : 'false',
      ]
        .map(quoteField)
        .join(','),
    );
  }

  // A trailing CRLF: RFC 4180 permits it and several readers expect the file to
  // end with a line break rather than mid-record.
  return BOM + lines.join(CRLF) + CRLF;
}
