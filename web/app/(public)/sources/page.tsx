// web/app/(public)/sources/page.tsx
//
// /sources - RULING R113, FW12 increment 0.
//
// WHY IT SHIPS FIRST rather than with FW20, in the operator's own words: "I
// designed P2 with no input trigger and then pointed its only disclosure at a
// planned route, while the calculator went live. A provisional interpretation
// with no input trigger must have a live disclosure surface before the affected
// page is indexed."
//
// So this page exists to be linked from the calculator's legal note, and its
// content is the minimum that closes the hole: the constants with their primary
// sources and verification state, the three pending readings in plain French,
// and the review date. FW20 expands it.
//
// IT ALSO FIXES A LIVE 404. PublicShell's footer has linked /sources since
// FW10 while the route was `status: 'planned'`, so every public page carried a
// link to nothing.
//
// THE VALUES COME FROM RuleSet, never from copy (R73, SPEC 7.7). A table of
// constants is the single most tempting place to type 40 again, and the one
// place where being stale would be worst - the whole subject of the page is
// where the numbers come from.
//
// STATIC, like the legal pages: no revalidate and no dynamic. Nothing here
// depends on the request, and the year the table is built for comes from the
// same Europe/Paris resolver the calculator uses (R55), so a build-time year
// would state the wrong one from 1 January until somebody deployed - hence
// revalidate rather than a fully static render.

import type { Metadata } from 'next';
import { ruleSetFor } from '@/lib/calc-engine';
import { PUBLISHED_PROVISIONAL_IDS } from '@/lib/content/provisional';
import { LAST_REGULATORY_REVIEW } from '@/lib/content/regulatory';
import { SOURCE_ENTRIES } from '@/lib/content/sources';
import { currentTaxYear } from '@/lib/content/tax-year';
import { SOURCES_COPY as COPY } from '@/lib/fr/sources';
import { Container } from '@/lib/ui/react/Container/Container';
import { formatDate, formatDays, formatPercent } from '@/lib/ui/core';
import styles from './sources.module.scss';

/** One hour, like the calculator: the year in the table has to stay current. */
export const revalidate = 3600;

export function generateMetadata(): Metadata {
  return { title: COPY.title, description: COPY.description };
}

/**
 * A constant's value, formatted the way the product shows it.
 *
 * The two ceilings are fractions in RuleSet and percentages on screen; the two
 * day counts are days; the canton list is a list. Rows that state a rule carry
 * no key and get the "no value" phrase instead - which is more honest than an
 * empty cell, because an empty cell reads as missing data.
 */
function valueOf(key: string | undefined, year: number): string {
  if (key === undefined) return COPY.noValue;

  const rules = ruleSetFor(year);

  switch (key) {
    case 'fiscalCeiling':
    case 'socialCeiling':
    case 'a1ThresholdRate': {
      const percent = rules[key] * 100;

      return formatPercent(percent, Number.isInteger(percent) ? 0 : 1);
    }

    case 'missionCapDays':
    case 'simplifiedBasisDays':
      return formatDays(rules[key]);

    case 'residence1983Cantons':
      return rules.residence1983Cantons.join(', ');

    default:
      return COPY.noValue;
  }
}

export default function SourcesPage() {
  const year = currentTaxYear();

  return (
    <main className={styles.page}>
      <Container width="article">
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.lead}>{COPY.intro}</p>

        {/*
          R51's date, where a reader looking for it will be. Null would mean the
          gate never opened, in which case this page would not be reachable
          from a live calculator - but the branch exists rather than a
          non-null assertion, because a page about verification is the wrong
          place to assert anything.
        */}
        {LAST_REGULATORY_REVIEW === null ? null : (
          <p className={styles.reviewed}>
            {COPY.reviewedOn(formatDate(LAST_REGULATORY_REVIEW))}
          </p>
        )}

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.tableHeading}</h2>

          {/*
            A real table, because this is tabular data: eight rows against four
            columns, and a screen reader should be able to say "Source
            primaire, ge.ch" rather than read a stack of divs. It scrolls
            inside its own container at narrow widths rather than making the
            page scroll sideways.
          */}
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{COPY.columns.rule}</th>
                  <th scope="col">{COPY.columns.value}</th>
                  <th scope="col">{COPY.columns.source}</th>
                  <th scope="col">{COPY.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {SOURCE_ENTRIES.map((entry) => (
                  <tr key={entry.id}>
                    <th scope="row" className={styles.ruleCell}>
                      {COPY.rules[entry.id]}
                    </th>
                    <td className={styles.valueCell}>{valueOf(entry.ruleSetKey, year)}</td>
                    <td>
                      {/*
                        A plain anchor, per ruling R87, and rel="noreferrer"
                        because a tax administration has no business knowing
                        which of our pages a reader came from.
                      */}
                      <a
                        className={styles.sourceLink}
                        href={entry.url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {new URL(entry.url).hostname}
                      </a>
                    </td>
                    <td>
                      <span
                        className={
                          entry.status === 'pending' ? styles.statusPending : styles.statusOk
                        }
                      >
                        {COPY.status[entry.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={styles.note}>{COPY.statusNote}</p>
          <p className={styles.note}>{COPY.pendingNote}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.provisionalHeading}</h2>
          <p className={styles.prose}>{COPY.provisionalIntro}</p>

          <dl className={styles.readings}>
            {PUBLISHED_PROVISIONAL_IDS.map((id) => (
              <div className={styles.reading} key={id}>
                <dt className={styles.readingHeading}>{COPY.provisional[id].heading}</dt>
                <dd className={styles.readingBody}>{COPY.provisional[id].body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.fixturesHeading}</h2>
          <p className={styles.prose}>{COPY.fixtures}</p>
        </section>
      </Container>
    </main>
  );
}
