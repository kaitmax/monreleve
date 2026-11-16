// web/tests/db/annex-rendered.test.ts
//
// FW-ANNEX-RENDERED (R985-R989), plan Checkpoint D item 2: "... PDF is A4 with
// the annex expanded and provenance per row". FW-DOSSIER-ENGINE proved the
// annex and the provenance in the PAYLOAD (tests/db/dossier-engine.test.ts).
// This file reads them back from the RENDERED document, for the same seeded
// year, which lives in one home: tests/support/seeded-year.ts (R206, R986).
//
// ============================================================================
// THROUGH THE PRINT ROUTE'S REAL HANDLER, IN A GATE (R985)
// ============================================================================
//
// The page component at app/releve/print/page.tsx is what the PDF route
// points Chromium at. It is rendered here as the server renders it, with a
// minted print token - the shape tests/db/print-route.test.ts:38-49 uses. No
// live server is needed, so unlike export-pdf.test.ts this file skips in no
// gate: it holds no skip, skipIf or runIf, and vitest.db.config.ts collects
// tests/db/**/*.test.ts into test:db.
//
// ============================================================================
// WHAT THE EXPECTATION IS MADE OF (R181)
// ============================================================================
//
//   - the provenance WORDS are lib/fr's constants, reached from the seeded
//     enum through a table this file owns. Nothing is retyped, and the page's
//     own map is not imported: that would compare the page with itself;
//   - the stamp is formatDateTime, the formatter the page uses and the one
//     home of "an instant as a Paris wall clock", applied to the SEEDED
//     firstRecordedAt. Its wall clock is pinned, typed, across a DST change
//     in print-route.test.ts:371-405 (R586), so it is not re-proved here;
//   - rows are located by formatDate(day) and the portion's lib/fr word.
//
// THE CELLS ARE READ BY COLUMN, each column found from its own heading. A
// row-level "contains" would pass with a value in the wrong column - and 31
// March's row holds two instants, the server's receipt and the client's claim.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { prisma } from '@/lib/db/client';
import { DOSSIER_COPY as COPY } from '@/lib/fr/dossier';
import { mintPrintToken } from '@/lib/export/print-token';
import { formatDate, formatDateTime } from '@/lib/ui/core';
import PrintPage from '@/app/releve/print/page';
import { text } from '@/tests/support/markup';
import {
  SEED,
  YEAR,
  seedYear,
  weekdaysOfYear,
  type Portion,
  type Provenance,
} from '@/tests/support/seeded-year';

/** SPEC 12 item 5: provenance in words (D17), from lib/fr. */
const PROVENANCE_WORDS: Readonly<Record<Provenance, string>> = {
  MANUAL: COPY.annex.provenanceManual,
  DETECTED_CONFIRMED: COPY.annex.provenanceConfirmed,
  DETECTED_CORRECTED: COPY.annex.provenanceCorrected,
};

/** The portion column's words, from lib/fr: half of a row's identity. */
const PORTION_WORDS: Readonly<Record<Portion, string>> = {
  FULL: COPY.annex.portionFull,
  AM: COPY.annex.portionMorning,
  PM: COPY.annex.portionAfternoon,
};

// ----------------------------------------------------------------------------
// Reading the markup. Narrow on purpose, like tests/support/markup.ts: the
// elements this page emits, and no HTML parser that would repair a defect.
// ----------------------------------------------------------------------------

/** The inner markup of every `<tag ...>...</tag>` in `html`, in order. */
function inner(html: string, tag: string): string[] {
  const element = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'gu');

  return [...html.matchAll(element)].map((match) => match[1] ?? '');
}

/** A cell as the reader sees it: nested tags dropped, React's entities decoded. */
const cellText = (markup: string): string => text(markup.replace(/<[^>]*>/gu, ''));

/** A row is identified by what it prints: its date and its portion. */
const keyOf = (date: string, portion: string): string => `${date} ${portion}`;

/** The key a seeded row must be printed under. */
const seededKey = (day: string, portion: Portion): string => keyOf(formatDate(day), PORTION_WORDS[portion]);

/** The column holding `heading`, found from the header row. */
function column(headings: readonly string[], heading: string): number {
  const index = headings.indexOf(heading);

  expect(index, `the annex has a column headed ${JSON.stringify(heading)}`).toBeGreaterThanOrEqual(0);
  expect(headings.lastIndexOf(heading), `one column headed ${JSON.stringify(heading)}`).toBe(index);

  return index;
}

let html = '';

beforeAll(async () => {
  process.env.AUTH_SECRET ??= 'annex-rendered-test-secret';
  await prisma.user.deleteMany();

  const userId = await seedYear();
  const token = mintPrintToken(userId, YEAR);

  // The page 404s without a grant, so a missing secret would read as a
  // refused document rather than the setup error it is.
  if (token === null) throw new Error('no AUTH_SECRET, so no print token could be minted');

  const element = await PrintPage({
    searchParams: Promise.resolve({ year: String(YEAR), token }),
  });

  html = renderToStaticMarkup(element);
});

afterAll(async () => {
  await prisma.$disconnect();
});

/** The annex table, its headings, and its body rows as cell texts. */
function annex(): { headings: string[]; rows: string[][] } {
  const tables = inner(html, 'table').filter((table) =>
    inner(table, 'th').map(cellText).includes(COPY.annex.firstRecordedAt),
  );

  expect(tables, 'exactly one table carries the annex headings').toHaveLength(1);

  const table = tables[0] ?? '';
  const bodies = inner(table, 'tbody');

  expect(bodies, 'the annex has one body').toHaveLength(1);

  return {
    headings: inner(table, 'th').map(cellText),
    rows: inner(bodies[0] ?? '', 'tr').map((row) => inner(row, 'td').map(cellText)),
  };
}

describe('FW-ANNEX-RENDERED: the seeded year, rendered by the print route', () => {
  it('PRESENCE FIRST: the page rendered the seeded document, and the seed can tell a wrong row from a right one', () => {
    // The document, not an empty or refused page (R169).
    expect(html).toContain(COPY.title);
    expect(html).not.toContain(COPY.emptyYear(YEAR));

    const { headings } = annex();

    for (const heading of [
      COPY.annex.dayDate,
      COPY.annex.portion,
      COPY.annex.provenance,
      COPY.annex.firstRecordedAt,
    ]) {
      column(headings, heading);
    }

    // A swapped or shared stamp, or a swapped source, must be visible: every
    // expected stamp is distinct AS PRINTED (to the minute), and the three
    // provenances print as three different words.
    const stamps = SEED.map((seeded) => formatDateTime(seeded.firstRecordedAt));

    expect(new Set(stamps).size, 'distinct printed stamps').toBe(SEED.length);
    expect(new Set(Object.values(PROVENANCE_WORDS)).size, 'three distinct provenance words').toBe(3);
    expect(new Set(SEED.map((seeded) => seeded.provenance)).size, 'all three provenances seeded').toBe(3);

    // The one row with a client claim prints that instant too, in another
    // column - so a stamp read from the wrong column cannot pass.
    const offline = SEED.filter((seeded) => seeded.clientClaimedAt !== null);

    expect(offline.length).toBeGreaterThan(0);

    for (const seeded of offline) {
      expect(formatDateTime(seeded.clientClaimedAt ?? '')).not.toBe(formatDateTime(seeded.firstRecordedAt));
    }

    // Every seeded row prints under a key of its own.
    expect(new Set(SEED.map((seeded) => seededKey(seeded.day, seeded.portion))).size).toBe(SEED.length);
  });

  it('R987: one rendered annex row per seeded row, none collapsed, and every unlogged weekday printed', () => {
    const { headings, rows } = annex();
    const dayColumn = column(headings, COPY.annex.dayDate);
    const portionColumn = column(headings, COPY.annex.portion);

    // Two shapes of row and no third: a recorded row fills every column; an
    // unlogged weekday is its date and one spanning "not recorded" cell.
    const recorded = rows.filter((cells) => cells.length === headings.length);
    const unrecorded = rows.filter((cells) => cells.length === 2 && cells[1] === COPY.annex.notRecorded);

    expect(recorded.length + unrecorded.length, 'rows of neither shape').toBe(rows.length);

    // THE COUNT IS OF ROWS, NOT DISTINCT DAYS: 59 seeded rows over 57 days,
    // because the two split days print a morning row and an afternoon row.
    const printed = recorded.map((cells) => keyOf(cells[dayColumn] ?? '', cells[portionColumn] ?? ''));
    const seeded = SEED.map((row) => seededKey(row.day, row.portion));

    const missing = seeded.filter((key) => !printed.includes(key));
    const unexpected = printed.filter((key) => !seeded.includes(key));

    expect(missing, `seeded rows the rendered annex does not print: ${missing.join('; ')}`).toEqual([]);
    expect(unexpected, `rendered annex rows nobody seeded: ${unexpected.join('; ')}`).toEqual([]);
    // The count as well as the set: a duplicated row passes a set comparison.
    expect(recorded.length, 'rendered recorded rows against seeded rows').toBe(SEED.length);

    // EXPANDED: every weekday nobody logged is printed, in order (SPEC 12
    // item 5), so the table is the whole year and not the recorded part of it.
    const seededDays = new Set(SEED.map((row) => row.day));
    const gaps = weekdaysOfYear()
      .filter((day) => !seededDays.has(day))
      .map(formatDate);

    expect(unrecorded.map((cells) => cells[0])).toEqual(gaps);
    expect(rows).toHaveLength(SEED.length + gaps.length);
  });

  it('R987: every rendered row carries its provenance words and its server stamp, as seeded', () => {
    const { headings, rows } = annex();
    const dayColumn = column(headings, COPY.annex.dayDate);
    const portionColumn = column(headings, COPY.annex.portion);
    const provenanceColumn = column(headings, COPY.annex.provenance);
    const stampColumn = column(headings, COPY.annex.firstRecordedAt);

    const byKey = new Map(
      rows
        .filter((cells) => cells.length === headings.length)
        .map((cells) => [keyOf(cells[dayColumn] ?? '', cells[portionColumn] ?? ''), cells]),
    );

    // PRESENCE FIRST: every seeded row has a rendered row to read.
    const unread = SEED.filter((seeded) => !byKey.has(seededKey(seeded.day, seeded.portion))).map(
      (seeded) => `${seeded.day} ${seeded.portion}`,
    );

    expect(unread, `seeded rows with no rendered row to read: ${unread.join('; ')}`).toEqual([]);

    // Soft, so a RED lists every row that lacks either, each by its day.
    for (const seeded of SEED) {
      const cells = byKey.get(seededKey(seeded.day, seeded.portion));
      const day = `annex ${seeded.day} ${seeded.portion}`;

      expect.soft(cells?.[provenanceColumn], `${day}: the provenance words`).toBe(
        PROVENANCE_WORDS[seeded.provenance],
      );
      expect.soft(cells?.[stampColumn], `${day}: the server stamp (first recorded)`).toBe(
        formatDateTime(seeded.firstRecordedAt),
      );
    }
  });
});
