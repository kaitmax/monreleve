// web/app/(public)/calculateur-lamal-cmu/page.tsx
//
// /calculateur-lamal-cmu - the LAMal / CMU comparator. FW-COMPARATEUR, R658
// (the prompt's R642), on the sources R664-R673 cleared.
//
// SPEC 9.6: the same shell as the telework calculator. A SERVER COMPONENT,
// like the calculator's page: the heading, the lead, the list of what the
// comparison leaves out and the links are in the HTML with scripting off;
// the island renders the form, the irrevocability banner and the result.
//
// STATIC, AND IT NEVER READS searchParams. Nothing the reader types reaches a
// URL (R658), so there is nothing to read; and the calculator's page records
// why reading them would push the metadata out of <head> (FW13). No
// revalidation either: the only time-dependent value would be "the current
// year", and the comparator's years are its DATA's years, which change with a
// deploy (docs/lamal-refresh.md), never with the clock.
//
// R660 (the prompt's R644): title and description for the query family;
// canonical by the layout's metadataBase rule; in the sitemap through the
// registry; linked from the droit d'option guide and back.

import type { Metadata } from 'next';
import { webApplicationLd } from '@/lib/content/jsonld';
import { COMPARATOR_PATH } from '@/lib/content/routes';
import { canonicalsAvailable, siteOrigin } from '@/lib/content/site';
import { formatChf } from '@/lib/lamal/format';
import { formatDate } from '@/lib/ui/core';
import { AVAILABLE_YEARS, COMPARATOR_YEARS, EXCHANGE_RATE } from '@/lib/lamal/years';
import { LAMAL_COPY as COPY } from '@/lib/fr/lamal';
import { Container } from '@/lib/ui/react/Container/Container';
import { JsonLd } from '@/lib/ui/react/JsonLd/JsonLd';
import { ComparatorForm } from './ComparatorForm';
import styles from './comparateur.module.scss';

export function generateMetadata(): Metadata {
  return {
    title: COPY.metaTitle,
    // The years from the data, oldest first, never typed (R171).
    description: COPY.metaDescription(COPY.yearsList([...AVAILABLE_YEARS].sort((a, b) => a - b))),
  };
}

export default function ComparateurPage() {
  // The franchise and the rate date in the "ne compare pas" list come from the
  // newest year's data, like the default year the form opens on.
  const newest = COMPARATOR_YEARS.reduce((a, b) => (b.year > a.year ? b : a));
  const franchise = formatChf(newest.premiums.franchiseChf.adult * 100);

  return (
    <main className={styles.page}>
      <JsonLd
        data={webApplicationLd({
          name: COPY.title,
          description: COPY.intro,
          ...(canonicalsAvailable() ? { url: `${siteOrigin()}${COMPARATOR_PATH}` } : {}),
        })}
      />

      <Container width="narrow">
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.lead}>{COPY.intro}</p>
        <noscript>
          <p className={styles.note}>{COPY.noScript}</p>
        </noscript>

        <ComparatorForm />

        <section className={styles.limits} aria-labelledby="ne-compare-pas" data-limits="true">
          <h2 className={styles.limitsHeading} id="ne-compare-pas">
            {COPY.limitsHeading}
          </h2>
          <ul className={styles.limitList}>
            {COPY.limits(franchise, formatDate(EXCHANGE_RATE.date)).map((item) => (
              <li className={styles.limit} key={item}>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <p className={styles.links}>
          {COPY.guideLink.lead}
          <a href={COPY.guideLink.href}>{COPY.guideLink.text}</a>
        </p>
        <p className={styles.links}>
          <a href={COPY.sourcesLink.href}>{COPY.sourcesLink.text}</a>
        </p>
      </Container>
    </main>
  );
}
