// web/app/(public)/calculateur-lamal-cmu/page.tsx
//
// /calculateur-lamal-cmu - the LAMal / CMU comparator. FW-COMPARATEUR, R658
// (the prompt's R642), on the sources R664-R673 cleared.
//
// SPEC 9.6: the same shell as the telework calculator. A SERVER COMPONENT,
// like the calculator's page: the heading, the lead, the list of what the
// comparison leaves out and the links are in the HTML with scripting off;
// the island renders the form, the irrevocability banner and the result.
// FW-CALCS-A2 (R748): "Le délai de trois mois" - its text and the four
// events - is server HTML too; only its helper is a second, small island.
//
// FW-COMPARATEUR-A2-PAGE (W20, R1046-R1050): the page is the droit d'option
// page of the approved A2 artboard (docs/design/comparateur-lamal-a2.dc.html)
// - the pill, the long h1, the lead and the chips in the head; then, after
// the comparison and the delay, "Ce qui est définitif", "Qui suit votre
// choix" beside "Ce que couvre l'option", the France and Suisse cards, the
// limits, and "Sources". Every one of those is a server component
// (ComparatorSections.tsx): they add no client JavaScript. The calculation,
// the island and the delay helper are untouched (R1050).
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
// registry; linked from the droit d'option guide and back (the banner's link).

import type { Metadata } from 'next';
import { webApplicationLd } from '@/lib/content/jsonld';
import { COMPARATOR_PATH } from '@/lib/content/routes';
import { canonicalsAvailable, siteOrigin } from '@/lib/content/site';
import { splitLead } from '@/lib/content/lead';
import { formatChf } from '@/lib/lamal/format';
import { formatDate } from '@/lib/ui/core';
import { AVAILABLE_YEARS, COMPARATOR_YEARS, EXCHANGE_RATE } from '@/lib/lamal/years';
import { LAMAL_COPY as COPY } from '@/lib/fr/lamal';
import { LAMAL_PAGE_COPY as PAGE } from '@/lib/fr/lamal-page';
import { IrrevocabilityBanner } from '@/lib/ui/react/Comparison/IrrevocabilityBanner';
import { Container } from '@/lib/ui/react/Container/Container';
import { JsonLd } from '@/lib/ui/react/JsonLd/JsonLd';
import { ComparatorForm } from './ComparatorForm';
import {
  ChoiceCards,
  DeadlineSource,
  FamilyAndScope,
  FinalSection,
  OnThisPage,
  SourcesSection,
  ToolPill,
} from './ComparatorSections';
import { DeadlineHelper } from './DeadlineHelper';
import { ReminderOutcomes } from './ReminderOutcomes';
import { SECTION_ID } from './section-ids';
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
  // newest year's data, like the default year the form opens on - and so do
  // the rate and the allowance the France card states (W20, R147).
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

      {/*
        FW-CALCS-A2, R729: comparateur-lamal-a2's arrangement - the page head,
        the IRREVOCABILITY BANNER directly under it (above the form and the
        result, R642), then two columns: the form card and the result.
        W20: the head carries the pill (the tool's name), the artboard's h1
        and lead, and the chips - each a link to a section below.
      */}
      <Container width="public">
        <header className={`${styles.head} ${styles.a2}`}>
          <ToolPill />
          <h1 className={styles.title}>{PAGE.heading}</h1>
          <p className={styles.lead}>{COPY.intro}</p>
          <noscript>
            <p className={styles.note}>{COPY.noScript}</p>
          </noscript>
          <OnThisPage />
        </header>

        <IrrevocabilityBanner />

        <div className={`${styles.layout} ${styles.a2}`} id={SECTION_ID.compare} data-a2-anchor="true">
          <ComparatorForm />
        </div>
      </Container>

      {/*
        FW-CALCS-A2, R748: "Le délai de trois mois", as the design draws it -
        the period and the four events that open it (rows D1-D6, the banner's
        own list), and the helper beside them. The text is the server's; the
        helper is a small island that keeps nothing from the comparison (R750)
        and offers the reminder form once a date is computed (FW-DELAI-RAPPEL,
        R918). The reminder links land here: ReminderOutcomes renders their
        outcomes hidden, and the fragment reveals one (lib/rappel/landing.ts).
        W20: the section's id (a chip's target) and its source line.
      */}
      <section
        className={`${styles.deadline} ${styles.a2}`}
        id={SECTION_ID.deadline}
        data-a2-anchor="true"
        aria-labelledby="delai-titre"
        data-deadline="true"
      >
        <Container width="public">
          <ReminderOutcomes />
          <div className={styles.deadlineLayout}>
            <div>
              <h2 className={styles.deadlineHeading} id="delai-titre">
                {COPY.deadline.heading}
              </h2>
              <p className={styles.deadlineIntro}>{COPY.deadline.intro}</p>
              <ul className={styles.eventList}>
                {COPY.deadline.events.map((event) => (
                  <li key={event}>{event}</li>
                ))}
              </ul>
              <DeadlineSource />
            </div>
            <DeadlineHelper />
          </div>
        </Container>
      </section>

      <FinalSection />
      <FamilyAndScope />
      <ChoiceCards year={newest} />

      {/*
        R732: "CE QUE CE COMPARATIF NE COMPARE PAS", as the design sets it -
        a white band, columns of items under a hairline each, a bold lead
        per item - with EVERY item in its full text (eight since FW-CALCS-A2's
        addendum 2 took out the joint return and the incomplete year, which
        the form now asks). The lead is SPLIT
        from the item (lib/content/lead.ts), never retyped: lead, one space,
        rest is the item, character for character.
        W20: its id (a chip's target); the link to /sources moved to
        "Sources" below, and the guide's link is the banner's, as drawn.
      */}
      <section
        className={`${styles.band} ${styles.a2}`}
        id={SECTION_ID.limits}
        data-a2-anchor="true"
        aria-labelledby="ne-compare-pas"
        data-limits="true"
      >
        <Container width="public">
          <h2 className={styles.limitsHeading} id="ne-compare-pas">
            {COPY.limitsHeading}
          </h2>
          <ul className={styles.limitList}>
            {COPY.limits(franchise, formatDate(EXCHANGE_RATE.date)).map((item) => {
              const { lead, rest } = splitLead(item);

              return (
                <li className={styles.limit} key={item}>
                  <strong className={styles.limitLead}>{lead}</strong>
                  {rest === '' ? null : (
                    <>
                      {' '}
                      <span className={styles.limitRest}>{rest}</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      <SourcesSection />
    </main>
  );
}
