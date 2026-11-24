// web/app/(public)/calculateur-lamal-cmu/ComparatorSections.tsx
//
// The STATIC sections of the droit d'option page, as the approved A2 artboard
// lays them out (docs/design/comparateur-lamal-a2.dc.html; FW-COMPARATEUR-A2-
// PAGE, W20, R1048): the pill in the head, the delay's source
// line, "Ce qui est définitif", "Qui suit votre choix" beside "Ce que couvre
// l'option", the France and Suisse cards, and "Sources".
//
// SERVER COMPONENTS: no 'use client', no state, no handler. Their words are
// lib/fr/lamal-page.ts, which nothing in the island imports, so none of them
// reaches the browser as script.
//
// ONE CLASS, AND ATTRIBUTE HOOKS UNDER IT - measured, not preferred. A CSS
// module's class map ships in the page's client chunk even when only a server
// component imports it: the first build of these sections, with a class per
// element in a stylesheet of their own, put a 943-byte map (380 B gzip) into
// the comparator's chunk. So every root here carries comparateur.module.scss's
// single `a2` class and every part a `data-a2` attribute, which the stylesheet
// selects under it: one entry in the class map, the same picture. `.a2` paints
// no fill of its own, so the contrast audit resolves each text rule against
// the page's surfaces rather than a container (R121).
//
// FW-CALC-REDESIGN (R1406, R1409): THE EXPLANATIONS ARE NATIVE ACCORDIONS.
// Each section is a <details> card (Fold, below) - closed, its text in the
// served HTML, no JavaScript - whose summary is the section's own heading.
// The chips under the head are gone (R1408: the accordions replace them).
// The section ids are still one list (section-ids.ts) and each still
// resolves: it sits on the accordion's CONTENT, because a browser reveals a
// closed <details> for a fragment that points inside its content and not
// for one on the <details> itself (measured in e2e/calc-redesign.spec.ts).
// "Sources" stays open, after the accordions.

import { formatDate } from '@/lib/ui/core';
import { COMPARATOR_PASS } from '@/lib/content/sources';
import { formatWholePercent } from '@/lib/lamal/format';
import { PRIMINFO_URL } from '@/lib/lamal/years';
import type { ComparatorYear } from '@/lib/lamal/types';
import { LAMAL_COPY as COPY } from '@/lib/fr/lamal';
import { LAMAL_PAGE_COPY as PAGE } from '@/lib/fr/lamal-page';
import type { ReactNode } from 'react';
import { Container } from '@/lib/ui/react/Container/Container';
import { SECTION_ID } from './section-ids';
import styles from './comparateur.module.scss';

/** The day every source of the October collection was read (rows L1-L14's pass). */
const READ_ON = formatDate(COMPARATOR_PASS);

/** The pill above the h1: the tool's name, as the artboard sets it. Inside page.tsx's `.a2` head. */
export function ToolPill() {
  return <p data-a2="pill">{COPY.title}</p>;
}

/** The source line under "Le délai de trois mois" (rows D1, D2). Inside page.tsx's `.a2` section. */
export function DeadlineSource() {
  return <p data-a2="source">{PAGE.deadlineSource(READ_ON)}</p>;
}

function List({ items }: { readonly items: readonly string[] }) {
  return (
    <ul data-a2="list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * ONE ACCORDION (R1406, R1409): a <details> card - the shared fold of
 * lib/ui/core/styles/_calc-shell.scss, through the comparator's `.a2` hooks -
 * whose summary holds the section's existing heading as its h2, and whose
 * content carries the section's id (see the note at the top of this file).
 * The section around it keeps its name (aria-labelledby, the h2) and any hook
 * the tests read. Closed by default: no `open`.
 */
export function Fold({
  id,
  headingId,
  heading,
  hook,
  children,
}: {
  readonly id: string;
  readonly headingId: string;
  readonly heading: string;
  /** A data-* hook on the section, as the section carried before (data-deadline, data-limits). */
  readonly hook?: Readonly<Record<`data-${string}`, string>>;
  readonly children: ReactNode;
}) {
  return (
    <section aria-labelledby={headingId} {...hook}>
      <details data-a2="fold">
        <summary>
          <h2 id={headingId}>{heading}</h2>
        </summary>
        <div id={id} data-a2="fold-body" data-a2-anchor="true">
          {children}
        </div>
      </details>
    </section>
  );
}

/** "Ce qui est définitif" (rows D3-D5). Inside page.tsx's `.a2` fold area. */
export function FinalSection() {
  return (
    <Fold id={SECTION_ID.final} headingId="definitif-titre" heading={PAGE.final.heading}>
      <p data-a2="lead">{PAGE.final.lead}</p>
      <div data-a2="pair">
        <div data-a2="card">
          <h3 data-a2="card-heading">{PAGE.final.reopensHeading}</h3>
          <List items={PAGE.final.reopens} />
        </div>
        <div data-a2="card">
          <h3 data-a2="card-heading">{PAGE.final.closedHeading}</h3>
          <List items={PAGE.final.closed} />
        </div>
      </div>
      <p data-a2="source">{PAGE.final.source(READ_ON)}</p>
    </Fold>
  );
}

/** "Qui suit votre choix" (row D8), then "Ce que couvre l'option" (row L18). */
export function FamilyAndScope() {
  return (
    <>
      <Fold id={SECTION_ID.family} headingId="famille-titre" heading={PAGE.family.heading}>
        {PAGE.family.body.map((paragraph) => (
          <p data-a2="paragraph" key={paragraph}>
            {paragraph}
          </p>
        ))}
        <p data-a2="source">{PAGE.family.source(READ_ON)}</p>
      </Fold>
      <Fold id={SECTION_ID.scope} headingId="couverture-titre" heading={PAGE.scope.heading}>
        {PAGE.scope.body.map((paragraph) => (
          <p data-a2="paragraph" key={paragraph}>
            {paragraph}
          </p>
        ))}
        <p data-a2="source">{PAGE.scope.source(READ_ON)}</p>
      </Fold>
    </>
  );
}

/**
 * The two choices: what each implies (rows L1-L11, L19-L21), each its own
 * accordion. The side's dot and name open the content (the country colour
 * tokens, a dot and the word - never colour alone). The rate and the
 * allowance are the newest year's, from the data (R147).
 */
export function ChoiceCards({ year }: { readonly year: ComparatorYear }) {
  return (
    <>
      <Fold id={SECTION_ID.france} headingId="france-titre" heading={PAGE.france.heading}>
        <p data-a2="side">
          <span data-a2="dot" data-a2-side="france" aria-hidden="true" />
          {PAGE.france.label}
        </p>
        <List
          items={PAGE.france.items(formatWholePercent(year.ratePercent), formatWholePercent(year.allowancePercentOfPass))}
        />
        <p data-a2="source">{PAGE.france.source(READ_ON)}</p>
      </Fold>
      <Fold id={SECTION_ID.switzerland} headingId="suisse-titre" heading={PAGE.switzerland.heading}>
        <p data-a2="side">
          <span data-a2="dot" data-a2-side="switzerland" aria-hidden="true" />
          {PAGE.switzerland.label}
        </p>
        <ul data-a2="list">
          {PAGE.switzerland.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
          <li>
            {PAGE.switzerland.priminfoLead}
            <a href={PRIMINFO_URL} rel="noreferrer">
              {PAGE.switzerland.priminfoText}
            </a>
            {PAGE.switzerland.priminfoAfter}
          </li>
        </ul>
        <p data-a2="source">{PAGE.switzerland.source(READ_ON)}</p>
      </Fold>
    </>
  );
}

/** "Sources": the artboard's seven rows, and the site's full list. */
export function SourcesSection() {
  return (
    <section
      id={SECTION_ID.sources}
      className={styles.a2}
      data-a2-band="canvas"
      data-a2-anchor="true"
      aria-labelledby="sources-titre"
    >
      <Container width="public">
        <h2 data-a2="heading" id="sources-titre">
          {PAGE.sources.heading}
        </h2>
        <p data-a2="lead">{PAGE.sources.lead(READ_ON)}</p>
        <ul data-a2="source-list">
          {PAGE.sources.rows.map(({ name, what }) => (
            <li data-a2="source-row" key={name}>
              <span data-a2="source-name">{name}</span>
              <span data-a2="source-what">{what}</span>
            </li>
          ))}
        </ul>
        <p data-a2="all-sources">
          <a href={PAGE.sources.allLink.href}>{PAGE.sources.allLink.text}</a>
        </p>
      </Container>
    </section>
  );
}
