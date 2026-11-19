// web/app/(account)/mon-releve/SignedIn.tsx
//
// The signed-in page as a PURE VIEW. FW-WEB-ACCOUNT (R903), rebuilt by W12 for
// Web Ruling 32: the current tax year and the one before, both, no selector.
//
// The route (page.tsx) looks things up - the session, the person, one dossier
// per year - and hands the result here; this renders. The split exists for
// R225: tests/unit/pages/mon-releve.test.tsx renders it with dossiers the
// ENGINE built and asserts every figure, and each year's warning, is on it.
//
// ONE SECTION PER YEAR, in the order given (newest first), each with its own
// figures and its own two downloads. The download buttons name their year, so
// four buttons on one page are four different accessible names.
//
// READ-ONLY (R904): the only forms are the downloads and sign-out, all POSTs
// behind the same-origin check (R902). No 'use client': no script.

import { Container } from '@/lib/ui/react/Container/Container';
import { MON_RELEVE_COPY as COPY } from '@/lib/fr/mon-releve';
import { ACCOUNT_PATHS, YEAR_FIELD } from '@/lib/web-account/paths';
import { AccountYear, type AccountYearFigures } from './AccountYear';
import styles from './mon-releve.module.scss';

/** What the route found for a year, in the three shapes a year can take. */
export type YearContent =
  | { readonly kind: 'figures'; readonly figures: AccountYearFigures }
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'before-activity' };

/** One year as the page shows it. */
export interface AccountYearView {
  readonly year: number;
  readonly content: YearContent;
}

export interface SignedInProps {
  readonly email: string;
  /** The current tax year and the one before (accountYears), newest first. */
  readonly years: readonly AccountYearView[];
  /** A download was refused and the route sent the person back to say so. */
  readonly exportFailed: boolean;
}

function YearSection({ year, content }: AccountYearView) {
  const headingId = `mon-releve-annee-${String(year)}`;

  return (
    <section className={styles.year} aria-labelledby={headingId} data-year={year}>
      <h2 className={styles.yearHeading} id={headingId}>
        {COPY.page.yearHeading(year)}
      </h2>

      {content.kind === 'figures' ? <AccountYear figures={content.figures} /> : null}

      {content.kind === 'incomplete' ? (
        <p className={styles.alert} role="status" data-incomplete>
          {COPY.page.incomplete}
        </p>
      ) : null}

      {content.kind === 'before-activity' ? (
        <p className={styles.alert} role="status" data-before-activity>
          {COPY.page.beforeActivity(year)}
        </p>
      ) : null}

      {content.kind === 'figures' ? (
        <div className={styles.downloads}>
          <div className={styles.row}>
            <form action={ACCOUNT_PATHS.exportPdf} method="post">
              <input name={YEAR_FIELD} type="hidden" value={String(year)} />
              <button className={styles.submit} type="submit">
                {COPY.page.downloadPdf(year)}
              </button>
            </form>
            <form action={ACCOUNT_PATHS.exportCsv} method="post">
              <input name={YEAR_FIELD} type="hidden" value={String(year)} />
              <button className={styles.secondary} type="submit">
                {COPY.page.downloadCsv(year)}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function SignedIn({ email, years, exportFailed }: SignedInProps) {
  const anyFigures = years.some((view) => view.content.kind === 'figures');

  return (
    <main className={styles.page}>
      <Container width="article">
        <h1 className={styles.heading}>{COPY.title}</h1>
        <p className={styles.lead}>{COPY.page.signedInAs(email)}</p>

        {exportFailed ? (
          <p className={styles.alert} role="alert" data-export-failed>
            {COPY.page.exportFailed}
          </p>
        ) : null}

        {/* Said once for both years: where the numbers come from, and that a
            PDF download is recorded (R329). */}
        <p className={styles.helper}>{COPY.page.figuresNote}</p>
        {anyFigures ? <p className={styles.helper}>{COPY.page.downloadsNote}</p> : null}

        {years.map((view) => (
          <YearSection key={view.year} year={view.year} content={view.content} />
        ))}

        <form action={ACCOUNT_PATHS.signOut} className={styles.signOut} method="post">
          <button className={styles.secondary} type="submit">
            {COPY.page.signOut}
          </button>
        </form>
      </Container>
    </main>
  );
}
