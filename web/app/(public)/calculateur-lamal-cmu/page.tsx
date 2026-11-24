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
// - the pill, the long h1 and the lead in the head (FW-CALC-REDESIGN, R1408:
// the chips that followed them are gone); then, after
// the comparison and the delay, "Ce qui est définitif", "Qui suit votre
// choix" beside "Ce que couvre l'option", the France and Suisse cards, the
// limits, and "Sources". Every one of those is a server component
// (ComparatorSections.tsx): they add no client JavaScript. The calculation,
// the island and the delay helper are untouched (R1050). Since
// FW-CALC-REDESIGN (R1409) each of them but "Sources" is a native accordion.
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
  Fold,
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
        and lead. FW-CALC-REDESIGN (R1406, R1408): the result column is the
        sticky verdict rail (ComparatorForm, _calc-shell.scss), and the chips
        are gone - the accordions below replace them.
      */}
      <Container width="public">
        <header className={`${styles.head} ${styles.a2}`}>
          <ToolPill />
          <h1 className={styles.title}>{PAGE.heading}</h1>
          <p className={styles.lead}>{COPY.intro}</p>
          <noscript>
            <p className={styles.note}>{COPY.noScript}</p>
          </noscript>
        </header>

        <IrrevocabilityBanner />

        <div className={`${styles.layout} ${styles.a2}`} id={SECTION_ID.compare} data-a2-anchor="true">
          <ComparatorForm />
        </div>
      </Container>

      {/*
        FW-CALC-REDESIGN (R1406, R1409): THE EXPLANATIONS, AS NATIVE
        ACCORDIONS, in the artboard's order - each closed, its summary the
        section's own heading, its text in the served HTML (no JavaScript).
        Open by default are only the form, the result and the banner above,
        and "Sources" below.

        "Le délai de trois mois" (FW-CALCS-A2, R748): its text and the four
        events - server HTML - and the helper beside them, a small island
        that keeps nothing from the comparison (R750) and offers the reminder
        form once a date is computed (FW-DELAI-RAPPEL, R918).

        THE REMINDER LANDINGS STAY OUTSIDE EVERY ACCORDION. The links in a
        reminder message land here with a fragment, and CSS :target reveals
        the outcome it names (ReminderOutcomes, lib/rappel/landing.ts) - an
        outcome inside a closed <details> would be revealed into nothing.
      */}
      <div className={styles.a2} data-a2-band="canvas">
        <Container width="public">
          <ReminderOutcomes />
          <div data-a2="folds">
            <Fold
              id={SECTION_ID.deadline}
              headingId="delai-titre"
              heading={COPY.deadline.heading}
              hook={{ 'data-deadline': 'true' }}
            >
              <div className={styles.deadlineLayout}>
                <div>
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
            </Fold>

            <FinalSection />
            <FamilyAndScope />
            <ChoiceCards year={newest} />

            {/*
              R732: "CE QUE CE COMPARATIF NE COMPARE PAS" - columns of items
              under a hairline each, a bold lead per item - with EVERY item in
              its full text. The lead is SPLIT from the item
              (lib/content/lead.ts), never retyped: lead, one space, rest is
              the item, character for character.
            */}
            <Fold
              id={SECTION_ID.limits}
              headingId="ne-compare-pas"
              heading={COPY.limitsHeading}
              hook={{ 'data-limits': 'true' }}
            >
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
            </Fold>
          </div>
        </Container>
      </div>

      <SourcesSection />
    </main>
  );
}
