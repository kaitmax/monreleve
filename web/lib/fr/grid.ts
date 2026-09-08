// web/lib/fr/grid.ts
//
// The one sentence DataGrid declares for itself. Its captions and headers are
// props, because they name the data a caller is showing and only the caller
// knows what that is.
//
// TODO-COPY: realistic French, not reviewed.

export const GRID_COPY = {
  /**
   * The empty state. "Never a blank table" (FW9 increment 2): a header row
   * floating over nothing reads as a loading failure rather than as an
   * answer, and the reader cannot tell whether the request failed or the
   * answer is genuinely none.
   *
   * Phrased as a statement about the data rather than as an apology, and it
   * claims nothing about why - a table that is empty because a filter
   * excluded everything and one that is empty because nothing was ever
   * recorded look the same from here.
   */
  empty: 'Aucune donnée à afficher pour cette période.',
} as const;
