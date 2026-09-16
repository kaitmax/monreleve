// web/lib/ui/react/DataGrid/DataGrid.tsx
//
// A table, and being a real one is most of the point. The Releve is a
// document a tax office may read and the calculator's breakdown is a
// row-and-column argument; both are tabular data. Marked up as divs, the
// column a cell belongs to is available only to someone looking at it.
//
// IT COMPUTES NOTHING (FW9 protocol item 7). Cells arrive as strings that
// have already been through lib/ui/core/format, so there is no path by which
// this component could render a number differently from the rest of the
// product - no toLocaleString, no rounding, no trimming. What it is given is
// what appears.
//
// NO ZEBRA, NO HEADER SHADING, NO SORT AFFORDANCE. DESIGN-SYSTEM.md prefers
// borders to fills, and a sort control would be a promise: a column that
// looks sortable and is not is worse than one that plainly is not. Hairline
// rules only.
//
// THE EMPTY STATE IS NOT OPTIONAL. A table with headers and no rows renders
// as a header row floating over nothing, which reads as a loading failure
// rather than as an answer - the reader cannot tell whether the request
// failed or the answer is genuinely none. One row spanning every column.

import { GRID_COPY } from '@/lib/fr/grid';
import styles from './DataGrid.module.scss';

export interface DataGridColumn {
  /** Matches a key in each row's `cells`. */
  readonly key: string;
  readonly header: string;
  /** Right-aligned and set in tabular figures, so the column reads as one. */
  readonly numeric?: boolean;
}

export interface DataGridRow {
  /** React's key. Never rendered. */
  readonly key: string;
  /** Already formatted. This component does not format. */
  readonly cells: Readonly<Record<string, string>>;
}

export interface DataGridProps {
  /** The table's accessible name. Required - an unnamed table is announced as "table". */
  readonly caption: string;
  /** Hide it visually, never from the accessibility tree. */
  readonly captionHidden?: boolean;
  readonly columns: readonly DataGridColumn[];
  readonly rows: readonly DataGridRow[];
  readonly total?: DataGridRow;
}

export function DataGrid({
  caption,
  captionHidden = false,
  columns,
  rows,
  total,
}: DataGridProps) {
  const empty = rows.length === 0;

  return (
    /*
      RULING R159: THE TABLE SCROLLS, NEVER THE PAGE.

      A table has a minimum width its columns cannot go below. Without this
      container that width pushes the DOCUMENT sideways, and a document that
      scrolls sideways takes the prose, the heading and the navigation with
      it - the reader pays for the table by losing the page.

      ALWAYS PRESENT, never conditional on overflow. overflow-x: auto shows no
      scrollbar when there is nothing to scroll, and nothing on the server
      knows a rendered width; a container added only where someone predicted
      an overflow would be missing in exactly the case nobody predicted.

      FOCUSABLE BECAUSE IT SCROLLS (WCAG 2.1.1, axe's
      scrollable-region-focusable). A region that scrolls and cannot take
      focus cannot be moved by keyboard at all. That makes it a tab stop even
      on a table that happens to fit, which is a real cost, accepted: the
      alternative is a region some readers cannot reach.

      NAMED FROM THE CAPTION, which is already the table's required accessible
      name. Inventing a second name for the same thing is how two names come
      to disagree - and captionHidden hides the caption from SIGHT only, so
      the name survives it.
    */
    <div className={styles.scroll} data-scroll="true" tabIndex={0} role="region" aria-label={caption}>
      <table className={styles.table}>
      {/* Visually hidden rather than removed: a caption taken out of the
          accessibility tree takes the table's only name with it. */}
      <caption className={captionHidden ? 'u-visually-hidden' : styles.caption}>{caption}</caption>

      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              className={styles.header}
              data-numeric={column.numeric === true ? true : undefined}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {empty ? (
          <tr>
            <td className={styles.empty} colSpan={columns.length}>
              {GRID_COPY.empty}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.key}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={styles.cell}
                  data-numeric={column.numeric === true ? true : undefined}
                >
                  {/* ?? '' rather than the raw lookup: a row missing a key is
                      a caller mistake, but rendering the string "undefined"
                      into a document a tax office reads is the worse one. */}
                  {row.cells[column.key] ?? ''}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>

      {total === undefined ? null : (
        // <tfoot>, not another body row. A total inside <tbody> is just
        // another row - counted with them, announced as one of them.
        <tfoot>
          <tr>
            {columns.map((column, index) =>
              index === 0 ? (
                // The first cell labels the row the way a column header
                // labels a column.
                <th key={column.key} scope="row" className={styles.totalHeader}>
                  {total.cells[column.key] ?? ''}
                </th>
              ) : (
                <td
                  key={column.key}
                  className={styles.totalCell}
                  data-numeric={column.numeric === true ? true : undefined}
                >
                  {total.cells[column.key] ?? ''}
                </td>
              ),
            )}
          </tr>
        </tfoot>
        )}
      </table>
    </div>
  );
}
