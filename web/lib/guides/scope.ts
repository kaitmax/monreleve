// web/lib/guides/scope.ts
//
// THE FIGURES AN ARTICLE IS ALLOWED TO WRITE, already formatted.
//
// RULING R147: "every threshold, cap, basis and rate that appears in guide
// prose comes from RuleSet(2026) through a component or an MDX expression -
// never typed as a literal in the MDX. The 2028 rule change must edit one
// constant, not seven articles." This is the other half of that rule: the
// test refuses a typed figure, and this is what an author writes instead.
//
// ALREADY FORMATTED, AND THAT IS THE DESIGN. Handing an article the raw
// RuleSet would mean every author deciding how many decimals a threshold
// takes and whether French puts a space before the percent sign - seven
// articles, seven answers. The product already has one answer to both
// (lib/ui/core/format), so the scope carries strings that have been through
// it and an article interpolates them whole.
//
// WHICH ALSO MAKES THE TYPOGRAPHY CORRECT BY CONSTRUCTION: formatPercent
// puts U+00A0 before the sign, so "40 %" can never break across a line and
// R91's guard has nothing to catch in the rendered figure.
//
// THE DECIMALS RULE IS /sources' RULE, not a new one - a whole percentage
// shows none and a fractional one shows one, which is what makes the pair
// read as "40 %" and "49,9 %" rather than "40,0 %" and "49,9 %".
//
// THE CANTON LIST IS HERE FOR THE SAME REASON AS THE NUMBERS, and it is the
// entry most likely to move: it is row 7 of docs/regulatory-sources.md, it is
// PENDING, and the reviewer is being asked precisely whether the membership
// is right. Typed into an article it would be a second copy of a RuleSet
// value that a review is expected to change.

import { ruleSetFor } from '@/lib/calc-engine';
import { CANTON_NAMES } from '@/lib/fr/cantons';
import { GUIDE_HEALTH_COPY as HEALTH } from '@/lib/fr/guides-sante';
import { PREMIUM_DATASET } from '@/lib/fr/lamal';
import { french, median } from '@/lib/lamal/compare';
import { formatChf, formatEur, formatWholePercent } from '@/lib/lamal/format';
import type { AgeClass, ComparatorYear } from '@/lib/lamal/types';
import {
  COMPARATOR_YEARS,
  DEFAULT_YEAR,
  PREMIUM_DATASET_URL,
  PRIMINFO_URL,
  comparatorYear,
} from '@/lib/lamal/years';
import { formatDays, formatPercent } from '@/lib/ui/core';

/** RuleSet holds fractions; a reader reads percentages (lib/ui/core/zones). */
const PERCENT = 100;

/** Whole percentages show no decimal, fractional ones show one. */
const percent = (fraction: number): string => {
  const value = fraction * PERCENT;

  return formatPercent(value, Number.isInteger(value) ? 0 : 1);
};

/**
 * What `{fiscal}` and its five siblings resolve to inside an article.
 *
 * NAMES A READER OF THE MDX WOULD GUESS, not the RuleSet field names: an
 * author writing prose types `{fiscal}` in the middle of a French sentence,
 * and `{fiscalCeiling}` reads like code in a paragraph.
 *
 * A TYPE ALIAS RATHER THAN AN INTERFACE, and that is not a style choice.
 * compileMDX takes `scope?: Record<string, unknown>`; TypeScript gives an
 * object-literal TYPE an implicit index signature and an INTERFACE none, so
 * the interface version failed to compile at all three call sites. Declared
 * this way the shape stays exact - every field is still named and checked -
 * and it is still assignable to what the compiler asks for.
 */
export type GuideScope = {
  /** The fiscal ceiling, as a percentage. */
  readonly fiscal: string;
  /** The social-security ceiling, as a percentage. */
  readonly social: string;
  /** The telework share from which the framework agreement applies. */
  readonly a1Threshold: string;
  /** The simplified denominator, in days. */
  readonly basisDays: string;
  /** The annual mission sub-cap, in days. */
  readonly missionCap: string;
  /** The eight 1983-accord cantons, in French, in RuleSet's order. */
  readonly cantons1983: string;
} & HealthScope;

export function guideScope(taxYear: number): GuideScope {
  const rules = ruleSetFor(taxYear);

  return {
    fiscal: percent(rules.fiscalCeiling),
    social: percent(rules.socialCeiling),
    a1Threshold: percent(rules.a1ThresholdRate),
    basisDays: formatDays(rules.simplifiedBasisDays),
    missionCap: formatDays(rules.missionCapDays),
    cantons1983: rules.residence1983Cantons.map((canton) => CANTON_NAMES[canton]).join(', '),
    ...healthScope(),
  };
}

// ---------------------------------------------------------------------------
// FW-SEO-ARTICLES: THE HEALTH-INSURANCE HALF.
//
// Two guides - the French contribution and the Swiss premium - print figures
// that already live in lib/lamal: the comparator's year table (rate,
// allowance, ceiling; rows L7, L12, L13) and the OFSP dataset (rows L1-L6).
// They change every autumn. So the prose names them and this supplies them,
// formatted by the comparator's own formatters, and
// tests/unit/guides/scope-health.test.tsx recomputes each one.
//
// THE YEAR IS THE COMPARATOR'S NEWEST (R171), not the tax year above: the
// telework rules and the premium year are two calendars that happen to share
// a number today.
//
// WHAT THE RULINGS FIX, AND WHERE THIS OBEYS THEM:
//   R668  the Swiss side is the lowest, the median and the highest - three
//         cells a row, never one;
//   R673  no insurer is named - a row is an AGE CLASS, and the OFSP number
//         never leaves lib/lamal;
//   R671  years are never mixed - one row per year, each with its own
//         ceiling and its own status;
//   R672  nothing is converted - every premium stays in francs, so there is
//         no rate to show beside it.
// ---------------------------------------------------------------------------

/** A row as lib/ui's DataGrid takes it. */
interface ScopeRow {
  readonly key: string;
  readonly cells: Readonly<Record<string, string>>;
}

// A TYPE ALIAS, NOT AN INTERFACE: next-mdx-remote takes the scope as a
// Record<string, unknown>, and only an alias is assignable to one.
export type HealthScope = {
  /** The premium and contribution year every figure below belongs to. */
  readonly healthYear: string;
  /** The contribution's rate (CSS art. D380-2). */
  readonly cmuRate: string;
  /** The share of the social-security ceiling deducted from the income. */
  readonly cmuAllowanceShare: string;
  /** That year's ceiling, and the allowance it gives. */
  readonly cmuPass: string;
  readonly cmuAllowance: string;
  /** One income worked through the formula. */
  readonly cmuWorkedIncome: string;
  readonly cmuWorkedBase: string;
  readonly cmuWorkedContribution: string;
  /** One row per comparator year: ceiling, status, allowance. */
  readonly cmuYearRows: readonly ScopeRow[];
  /** The contribution at a handful of incomes, that year. */
  readonly cmuIncomeRows: readonly ScopeRow[];
  /** How many insurers the dataset lists for residents of France. */
  readonly lamalInsurerCount: string;
  /** The franchise the adult premiums carry, from the dataset. */
  readonly lamalFranchise: string;
  readonly lamalAdultLowest: string;
  readonly lamalAdultHighest: string;
  /** Monthly premium by age class: lowest, median, highest. */
  readonly lamalPremiumRows: readonly ScopeRow[];
  readonly lamalAccidentRows: readonly ScopeRow[];
  /** R664: the attribution the dataset's terms make mandatory - author, title, link. */
  readonly lamalDatasetAuthor: string;
  readonly lamalDatasetTitle: string;
  readonly lamalDatasetUrl: string;
  /** The official premium comparison site, where an insurer is chosen (R668). */
  readonly priminfoUrl: string;
};

/**
 * SAMPLE INCOMES, NOT RULES. The table shows the formula at a few round
 * incomes so a reader can place their own; the first sits below the
 * allowance on purpose, because the zero it produces is this product's
 * display choice (R669) and a reader should meet it in the table rather
 * than be surprised by it in the comparator.
 */
const SAMPLE_INCOMES_EUR = [10000, 30000, 45000, 60000, 80000, 100000] as const;

/** The income the prose works through, step by step. One of the rows above. */
const WORKED_INCOME_EUR = 60000;

const AGE_CLASSES: readonly AgeClass[] = ['adult', 'youngAdult', 'child'];

const CENTIMES_PER_FRANC = 100;

function premiumRows(
  year: ComparatorYear,
  cover: 'withAccident' | 'withoutAccident',
): readonly ScopeRow[] {
  return AGE_CLASSES.map((ageClass) => {
    const values = year.premiums.insurers
      .map((insurer) => insurer[ageClass][cover])
      .sort((a, b) => a - b);

    return {
      key: ageClass,
      cells: {
        classe: HEALTH.ageClass[ageClass],
        basse: formatChf(values[0] ?? 0),
        // The median of an even list falls between two centimes; the
        // comparator rounds it the same way (lib/lamal/compare.ts, spreadOf).
        mediane: formatChf(Math.round(median(values))),
        haute: formatChf(values[values.length - 1] ?? 0),
      },
    };
  });
}

export function healthScope(): HealthScope {
  const year = comparatorYear(DEFAULT_YEAR);

  if (year === undefined) {
    throw new Error(`lib/lamal/years.ts has no entry for its own default year ${DEFAULT_YEAR}`);
  }

  const worked = french(year, WORKED_INCOME_EUR);
  const adult = premiumRows(year, 'withoutAccident')[0];

  return {
    healthYear: String(year.year),
    cmuRate: formatWholePercent(year.ratePercent),
    cmuAllowanceShare: formatWholePercent(year.allowancePercentOfPass),
    cmuPass: formatEur(year.passEur),
    cmuAllowance: formatEur(worked.allowanceEur),
    cmuWorkedIncome: formatEur(WORKED_INCOME_EUR),
    cmuWorkedBase: formatEur(worked.baseEur),
    cmuWorkedContribution: formatEur(worked.contributionEur),

    cmuYearRows: COMPARATOR_YEARS.map((entry) => ({
      key: String(entry.year),
      cells: {
        annee: String(entry.year),
        plafond: formatEur(entry.passEur),
        statut: HEALTH.passStatus[entry.passStatus],
        abattement: formatEur(french(entry, 0).allowanceEur),
      },
    })),

    cmuIncomeRows: SAMPLE_INCOMES_EUR.map((income) => {
      const result = french(year, income);

      return {
        key: String(income),
        cells: {
          revenu: formatEur(income),
          assiette: formatEur(result.baseEur),
          cotisation: formatEur(result.contributionEur),
        },
      };
    }),

    lamalInsurerCount: String(year.premiums.insurers.length),
    lamalFranchise: formatChf(year.premiums.franchiseChf.adult * CENTIMES_PER_FRANC),
    lamalAdultLowest: adult?.cells.basse ?? '',
    lamalAdultHighest: adult?.cells.haute ?? '',
    lamalPremiumRows: premiumRows(year, 'withoutAccident'),
    lamalAccidentRows: premiumRows(year, 'withAccident'),
    lamalDatasetAuthor: PREMIUM_DATASET.author,
    lamalDatasetTitle: PREMIUM_DATASET.title,
    lamalDatasetUrl: PREMIUM_DATASET_URL,
    priminfoUrl: PRIMINFO_URL,
  };
}
