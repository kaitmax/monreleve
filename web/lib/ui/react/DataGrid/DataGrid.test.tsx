// @vitest-environment jsdom
//
// web/lib/ui/react/DataGrid/DataGrid.test.tsx
//
// A table, and the assertions are mostly about it BEING a table. The Releve
// is a document a tax office may read, and the calculator's breakdown is a
// row-and-column argument; both are tabular data, and marking them up as divs
// would make the column a cell belongs to unavailable to anyone not looking
// at it. So <table>, <caption>, <thead>, <th scope> - and the tests assert
// through roles, which only resolve when the markup is genuinely a table.
//
// IT COMPUTES NOTHING (FW9 protocol item 7). Cells arrive as strings that
// have already been through lib/ui/core/format, so there is no path by which
// this component could render a number a different way from the rest of the
// product. A test asserts a cell is rendered exactly as given, U+202F and all.
//
// THE EMPTY STATE IS THE INTERESTING ONE. "Never a blank table": a table with
// headers and no rows renders as a header row floating over nothing, which
// reads as a loading failure rather than as an answer. One row spanning every
// column, carrying the sentence from lib/fr.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatDays } from '@/lib/ui/core';
import { GRID_COPY } from '@/lib/fr/grid';
import { DataGrid } from './DataGrid';
import type { DataGridColumn, DataGridRow } from './DataGrid';

// RULING R96: FORMATTED REGULATORY FIGURES ARE ASSERTED AGAINST LITERAL
// STRINGS BY CODEPOINT, never against a formatter call.
//
// WHY, in one sentence: an assertion built from the formatter agrees with the
// formatter, so it cannot see a wrong ARGUMENT. That is not hypothetical -
// RateDisplay rendered the declarable rate at one decimal for three tasks
// while expect(html).toContain(formatPercent(39.16)) stayed green, because
// both sides passed the same wrong precision.
//
// The escapes are written out rather than pasted as invisible characters, so
// the separator is readable in source and a plain space cannot be typed here
// by accident. Every value below was MEASURED from the formatter, not derived.

/** formatDays(1234.5) - U+202F NARROW NO-BREAK SPACE groups the thousands. */
const DAYS_1234_5 = '1 234,5';

/** formatDays(1247) - the total row. */
const DAYS_1247 = '1 247';

// Testing Library registers cleanup only under vitest globals, which this
// repo does not set. See FieldGroup.test.tsx.
afterEach(cleanup);

const CAPTION = 'Jours declares par mois';

const COLUMNS: readonly DataGridColumn[] = [
  { key: 'month', header: 'Mois' },
  { key: 'days', header: 'Jours', numeric: true },
];

const ROWS: readonly DataGridRow[] = [
  { key: 'jan', cells: { month: 'Janvier', days: formatDays(12.5) } },
  { key: 'feb', cells: { month: 'Fevrier', days: formatDays(1234.5) } },
];

const TOTAL: DataGridRow = { key: 'total', cells: { month: 'Total', days: formatDays(1247) } };

describe('it is a real table', () => {
  it('exposes the table role, so assistive technology gets the grid', () => {
    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} />);

    expect(screen.getByRole('table')).toBeDefined();
  });

  it('names the table with its caption', () => {
    // The accessible name of a table comes from its <caption>. A table with
    // no name is announced as "table" and nothing else, which in a document
    // holding several is useless.
    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} />);

    expect(screen.getByRole('table').textContent).toContain(CAPTION);
    expect(screen.getByRole('table').querySelector('caption')?.textContent).toBe(CAPTION);
  });

  it('gives every column a COLUMN-scoped header', () => {
    // scope="col" is what associates a cell with its header. Without it a
    // screen reader reads "1 247" with no idea it is a day count.
    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} />);

    const headers = screen.getAllByRole('columnheader');

    expect(headers).toHaveLength(COLUMNS.length);
    for (const header of headers) {
      expect(header.getAttribute('scope')).toBe('col');
    }
  });

  it('renders one row per datum, plus the header row', () => {
    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} />);

    expect(screen.getAllByRole('row')).toHaveLength(ROWS.length + 1);
  });
});

describe('it renders cells exactly as given', () => {
  it('does not reformat a number', () => {
    // formatDays(1234.5) is "1 234,5" with U+202F as the group separator.
    // A component that re-rendered the number - or that trimmed, or that
    // used toLocaleString - would produce a different string here, and the
    // product would show two different formats for one quantity.
    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} />);

    const cells = screen.getAllByRole('cell');
    const rendered = cells.map((cell) => cell.textContent);

    expect(rendered).toContain(DAYS_1234_5);
  });

  it('preserves the narrow no-break space, asserted BY CODEPOINT', () => {
    // THE ASSERTION ABOVE DOES NOT PROVE THIS, and the file header used to
    // claim it did. `toContain(formatDays(1234.5))` compares formatDays output
    // against formatDays output: change GROUP_SEPARATOR in
    // lib/ui/core/format/number.ts from U+202F to an ordinary space and BOTH
    // sides move together, leaving the test green. It proves pass-through, not
    // the byte. Found by an adversarial audit of ruling R66's sweep.
    //
    // The separator IS pinned centrally, in format-number.test.ts - but that
    // pins the FORMATTER. What this pins is that the component does not
    // sanitise, trim or re-encode it on the way through, which is a separate
    // claim and the one SPEC 19 needs from a document a tax office reads.
    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} />);

    const numeric = screen
      .getAllByRole('cell')
      .filter((cell) => cell.getAttribute('data-numeric') === 'true');
    const text = numeric[1]?.textContent ?? '';

    // formatDays(1234.5) is 1 <U+202F> 2 3 4 , 5
    expect(text.charCodeAt(1)).toBe(0x202f);
    expect(text.charCodeAt(1)).not.toBe(0x0020);
  });

  it('keeps a cell missing from a row empty rather than rendering undefined', () => {
    // A row that does not carry every key is a caller mistake, but rendering
    // the string "undefined" into a document a tax office reads is worse than
    // rendering nothing.
    const sparse: readonly DataGridRow[] = [{ key: 'x', cells: { month: 'Mars' } }];

    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={sparse} />);

    const rendered = screen.getAllByRole('cell').map((cell) => cell.textContent);

    expect(rendered).not.toContain('undefined');
    expect(rendered).toContain('');
  });
});

describe('the empty state', () => {
  it('is never a blank table, and the sentence is compared exactly', () => {
    // A header row floating over nothing reads as a loading failure.
    //
    // textContent rather than getByText (R66). The sentence is prose today,
    // but it is marked TODO-COPY in lib/fr/grid.ts, and correct French
    // typography would put U+00A0 before a colon or inside guillemets if the
    // wording gains either. A text query normalises the DOM side only, so it
    // would then either go red against correct copy or - after the obvious
    // repair - match either codepoint silently.
    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={[]} />);

    expect(screen.getByRole('cell').textContent).toBe(GRID_COPY.empty);
  });

  it('spans every column, so the message is not squeezed into the first', () => {
    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={[]} />);

    const cell = screen.getByRole('cell');

    expect(cell.getAttribute('colspan')).toBe(String(COLUMNS.length));
  });

  it('still renders the headers, so the shape of the missing data is visible', () => {
    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={[]} />);

    expect(screen.getAllByRole('columnheader')).toHaveLength(COLUMNS.length);
  });
});

describe('the optional total row', () => {
  it('is absent unless given', () => {
    // Asserted on the ELEMENT, not by searching for the total's text. A
    // queryByText for formatDays(1247) would return null whether or not a
    // footer existed, because of the U+202F normalisation described below -
    // a test that passes for a reason unrelated to what it claims.
    const { container } = render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} />);

    expect(container.querySelector('tfoot')).toBeNull();
  });

  it('renders in a footer, not as another body row', () => {
    // A total that sits in <tbody> is just another row: it sorts with them,
    // it is counted with them, and it is announced as one of them.
    const { container } = render(
      <DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} total={TOTAL} />,
    );

    const foot = container.querySelector('tfoot');

    expect(foot).not.toBeNull();

    // textContent, NOT getByText. Testing Library's default normalizer
    // collapses whitespace, and U+202F - the narrow no-break space
    // formatDays uses as a group separator - is whitespace to that regex. So
    // the DOM text becomes "1 247" with an ordinary space while the expected
    // string keeps the narrow one, and the query fails against a correct
    // table. Worse, had it matched, it would have matched either separator,
    // hiding the exact thing SPEC 19 pins.
    const cells = [...(foot?.querySelectorAll('td') ?? [])].map((cell) => cell.textContent);

    expect(cells).toContain(DAYS_1247);
  });

  it('marks its first cell as a ROW header', () => {
    // "Total" labels the row the way a column header labels a column.
    const { container } = render(
      <DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} total={TOTAL} />,
    );

    const header = container.querySelector('tfoot th');

    expect(header?.getAttribute('scope')).toBe('row');
    expect(header?.textContent).toBe('Total');
  });
});

describe('the caption can be hidden without being removed', () => {
  it('keeps it in the accessible name when visually hidden', () => {
    // Visually hidden, not display:none. A caption removed from the
    // accessibility tree takes the table's only name with it.
    const { container } = render(
      <DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} captionHidden />,
    );
    const caption = container.querySelector('caption');

    expect(caption?.textContent).toBe(CAPTION);
    expect(caption?.className).toContain('u-visually-hidden');
  });

  it('shows it by default', () => {
    const { container } = render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} />);

    expect(container.querySelector('caption')?.className ?? '').not.toContain('u-visually-hidden');
  });
});

describe('numeric columns', () => {
  it('are flagged in the markup so the stylesheet can align and tabularise them', () => {
    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} />);

    const numeric = screen
      .getAllByRole('cell')
      .filter((cell) => cell.getAttribute('data-numeric') === 'true');

    // One per row, for the single numeric column.
    expect(numeric).toHaveLength(ROWS.length);
  });

  it('flags the numeric HEADER too, so the column aligns as one', () => {
    render(<DataGrid caption={CAPTION} columns={COLUMNS} rows={ROWS} />);

    const headers = screen.getAllByRole('columnheader');

    expect(headers[1]?.getAttribute('data-numeric')).toBe('true');
    expect(headers[0]?.hasAttribute('data-numeric')).toBe(false);
  });
});
