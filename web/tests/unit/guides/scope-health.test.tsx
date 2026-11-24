// web/tests/unit/guides/scope-health.test.tsx
//
// FW-SEO-ARTICLES. The health-insurance half of the guide scope: the French
// contribution's figures and the Swiss premium spread, as two guides print
// them.
//
// WHY A SCOPE AND NOT TYPED FIGURES (R147, R163, R181). The two articles
// state a rate, an allowance, a ceiling, a worked contribution and a table of
// premiums. Every one of those already lives in lib/lamal - the comparator's
// year table and the OFSP dataset - and changes each autumn. Typed into
// prose they would be right until the refresh and wrong after it, with every
// suite green. So the prose names them and this scope supplies them, and
// this file checks the scope against lib/lamal BY RECOMPUTING, not by
// quoting what it returned.
//
// AND THAT THEY ARRIVE (R154). The last block compiles an article in
// miniature and reads the figures off the rendered HTML: a scope nobody
// interpolates is a scope that proves nothing.

import { compileMDX } from 'next-mdx-remote/rsc';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MDX_OPTIONS } from '@/lib/guides/mdx-options';
import { guideScope } from '@/lib/guides/scope';
import { formatChf, formatEur, formatWholePercent } from '@/lib/lamal/format';
import { COMPARATOR_YEARS, DEFAULT_YEAR, comparatorYear } from '@/lib/lamal/years';
import type { AgeClass } from '@/lib/lamal/types';
import { DataGrid } from '@/lib/ui/react/DataGrid/DataGrid';

interface Row {
  readonly key: string;
  readonly cells: Readonly<Record<string, string>>;
}

interface HealthScope {
  readonly healthYear: string;
  readonly cmuRate: string;
  readonly cmuAllowanceShare: string;
  readonly cmuPass: string;
  readonly cmuAllowance: string;
  readonly cmuWorkedIncome: string;
  readonly cmuWorkedBase: string;
  readonly cmuWorkedContribution: string;
  readonly cmuYearRows: readonly Row[];
  readonly cmuIncomeRows: readonly Row[];
  readonly lamalInsurerCount: string;
  readonly lamalFranchise: string;
  readonly lamalAdultLowest: string;
  readonly lamalAdultHighest: string;
  readonly lamalPremiumRows: readonly Row[];
  readonly lamalAccidentRows: readonly Row[];
}

const SCOPE = guideScope(DEFAULT_YEAR) as unknown as HealthScope;
const YEAR = comparatorYear(DEFAULT_YEAR)!;

/** The formula of CSS art. D380-2, written out here independently of lib/lamal/compare. */
const contribution = (incomeEur: number): { base: number; due: number } => {
  const allowance = Math.round((YEAR.passEur * YEAR.allowancePercentOfPass) / 100);
  const base = Math.max(0, Math.round(incomeEur - allowance));

  return { base, due: Math.round((base * YEAR.ratePercent) / 100) };
};

/** `60 000 €` back to 60000, whatever spaces the formatter set. */
const euros = (text: string): number => Number(text.replace(/[^\d]/gu, ''));

describe('the French contribution, from the comparator’s own year table', () => {
  it('reads the newest year, never a typed one (R171)', () => {
    expect(SCOPE.healthYear).toBe(String(DEFAULT_YEAR));
  });

  it('formats the rate, the allowance share and the ceiling of that year', () => {
    expect(SCOPE.cmuRate).toBe(formatWholePercent(YEAR.ratePercent));
    expect(SCOPE.cmuAllowanceShare).toBe(formatWholePercent(YEAR.allowancePercentOfPass));
    expect(SCOPE.cmuPass).toBe(formatEur(YEAR.passEur));
    expect(SCOPE.cmuAllowance).toBe(
      formatEur(Math.round((YEAR.passEur * YEAR.allowancePercentOfPass) / 100)),
    );
  });

  it('works one example through the formula', () => {
    const income = euros(SCOPE.cmuWorkedIncome);
    const { base, due } = contribution(income);

    // A worked example below the allowance would demonstrate a zero.
    expect(base).toBeGreaterThan(0);
    expect(SCOPE.cmuWorkedBase).toBe(formatEur(base));
    expect(SCOPE.cmuWorkedContribution).toBe(formatEur(due));
  });

  it('lists one row per comparator year, and never mixes them (R671)', () => {
    expect(SCOPE.cmuYearRows.map((row) => row.key)).toEqual(
      COMPARATOR_YEARS.map((entry) => String(entry.year)),
    );

    for (const entry of COMPARATOR_YEARS) {
      const row = SCOPE.cmuYearRows.find((candidate) => candidate.key === String(entry.year));

      expect(row?.cells.plafond).toBe(formatEur(entry.passEur));
    }
  });

  it('says which ceiling is only announced', () => {
    const statuses = new Set(SCOPE.cmuYearRows.map((row) => row.cells.statut));
    const kinds = new Set(COMPARATOR_YEARS.map((entry) => entry.passStatus));

    // One wording per status actually present: an announced ceiling must not
    // read like a final one.
    expect(statuses.size).toBe(kinds.size);
  });

  it('computes every row of the income table, including the one at zero', () => {
    expect(SCOPE.cmuIncomeRows.length).toBeGreaterThanOrEqual(5);

    for (const row of SCOPE.cmuIncomeRows) {
      const { base, due } = contribution(euros(row.cells.revenu ?? ''));

      expect(row.cells.assiette).toBe(formatEur(base));
      expect(row.cells.cotisation).toBe(formatEur(due));
    }

    // The floor is a display choice of this product (R669), so the table
    // shows it once rather than leaving a reader to guess.
    expect(SCOPE.cmuIncomeRows.some((row) => row.cells.cotisation === formatEur(0))).toBe(true);
  });
});

describe('the Swiss premium spread, from the OFSP dataset', () => {
  const CLASSES: readonly AgeClass[] = ['adult', 'youngAdult', 'child'];
  const sorted = (ageClass: AgeClass, accident: 'withAccident' | 'withoutAccident'): number[] =>
    YEAR.premiums.insurers.map((insurer) => insurer[ageClass][accident]).sort((a, b) => a - b);

  it('finds the dataset before measuring it', () => {
    expect(YEAR.premiums.insurers.length).toBeGreaterThan(3);
    expect(SCOPE.lamalInsurerCount).toBe(String(YEAR.premiums.insurers.length));
  });

  it.each([
    ['lamalPremiumRows', 'withoutAccident'],
    ['lamalAccidentRows', 'withAccident'],
  ] as const)('%s carries the lowest, the median and the highest (R668)', (name, accident) => {
    const rows = SCOPE[name];

    expect(rows.map((row) => row.key)).toEqual([...CLASSES]);

    for (const ageClass of CLASSES) {
      const values = sorted(ageClass, accident);
      const row = rows.find((candidate) => candidate.key === ageClass);

      expect(row?.cells.basse).toBe(formatChf(values[0]!));
      expect(row?.cells.haute).toBe(formatChf(values[values.length - 1]!));
      // Three figures, never one: the middle one is between the other two.
      expect(euros(row?.cells.mediane ?? '')).toBeGreaterThanOrEqual(euros(row?.cells.basse ?? ''));
      expect(euros(row?.cells.mediane ?? '')).toBeLessThanOrEqual(euros(row?.cells.haute ?? ''));
    }
  });

  it('names no insurer (R673)', () => {
    const cells = [...SCOPE.lamalPremiumRows, ...SCOPE.lamalAccidentRows].flatMap((row) =>
      Object.keys(row.cells),
    );

    expect(new Set(cells)).toEqual(new Set(['classe', 'basse', 'mediane', 'haute']));
  });

  it('quotes the adult range in prose from the same list', () => {
    const values = sorted('adult', 'withoutAccident');

    expect(SCOPE.lamalAdultLowest).toBe(formatChf(values[0]!));
    expect(SCOPE.lamalAdultHighest).toBe(formatChf(values[values.length - 1]!));
    expect(SCOPE.lamalFranchise).toContain(String(YEAR.premiums.franchiseChf.adult));
  });
});

describe('the figures reach the page (R154)', () => {
  const SOURCE = [
    'La cotisation est de {cmuRate}, soit {cmuWorkedContribution}.',
    '',
    '<DataGrid',
    '  caption="x"',
    '  columns={[{ key: "revenu", header: "a" }, { key: "cotisation", header: "b" }]}',
    '  rows={cmuIncomeRows}',
    '/>',
  ].join('\n');

  it('renders them in prose and in a table fed by the scope', async () => {
    const { content } = await compileMDX({
      source: SOURCE,
      components: { DataGrid },
      options: { ...MDX_OPTIONS, scope: SCOPE as unknown as Record<string, unknown> },
    });
    const html = renderToStaticMarkup(content);

    expect(html).toContain(SCOPE.cmuRate);
    expect(html).toContain(SCOPE.cmuWorkedContribution);

    for (const row of SCOPE.cmuIncomeRows) {
      expect(html).toContain(row.cells.cotisation);
    }
  });
});
