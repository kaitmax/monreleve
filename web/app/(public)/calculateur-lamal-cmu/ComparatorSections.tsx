// web/app/(public)/calculateur-lamal-cmu/ComparatorSections.tsx
//
// The STATIC sections of the droit d'option page, as the approved A2 artboard
// lays them out (docs/design/comparateur-lamal-a2.dc.html; FW-COMPARATEUR-A2-
// PAGE, W20, R1048): the pill and the chips in the head, the delay's source
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
// EVERY CHIP IS A LINK TO A SECTION THAT EXISTS (R1048): the ids are one list
// (section-ids.ts), the chips are built from it, and page.tsx puts the same
// ids on the sections it renders itself - comparateur-a2-page.test.tsx
// asserts both directions.

import { formatDate } from '@/lib/ui/core';
import { COMPARATOR_PASS } from '@/lib/content/sources';
import { formatWholePercent } from '@/lib/lamal/format';
import { PRIMINFO_URL } from '@/lib/lamal/years';
import type { ComparatorYear } from '@/lib/lamal/types';
import { LAMAL_COPY as COPY } from '@/lib/fr/lamal';
import { LAMAL_PAGE_COPY as PAGE } from '@/lib/fr/lamal-page';
import { Container } from '@/lib/ui/react/Container/Container';
import { SECTION_ID } from './section-ids';
import styles from './comparateur.module.scss';

/** One chip per section, labelled by the section's own heading where it has one (R206). */
const CHIPS: readonly { readonly id: string; readonly label: string }[] = [
  { id: SECTION_ID.compare, label: PAGE.chips.compare },
  { id: SECTION_ID.deadline, label: COPY.deadline.heading },
  { id: SECTION_ID.final, label: PAGE.final.heading },
  { id: SECTION_ID.family, label: PAGE.family.heading },
  { id: SECTION_ID.scope, label: PAGE.scope.heading },
  { id: SECTION_ID.france, label: PAGE.chips.france },
  { id: SECTION_ID.switzerland, label: PAGE.chips.switzerland },
  { id: SECTION_ID.limits, label: COPY.limitsHeading },
  { id: SECTION_ID.sources, label: PAGE.sources.heading },
];

/** The day every source of the October collection was read (rows L1-L14's pass). */
const READ_ON = formatDate(COMPARATOR_PASS);

/** The pill above the h1: the tool's name, as the artboard sets it. Inside page.tsx's `.a2` head. */
export function ToolPill() {
  return <p data-a2="pill">{COPY.title}</p>;
}

/** "Sur cette page": the chips, each a link to its section. Inside page.tsx's `.a2` head. */
export function OnThisPage() {
  return (
    <nav data-a2="chips" aria-label={PAGE.onThisPage} data-on-this-page="true">
      <ul data-a2="chip-list">
        {CHIPS.map(({ id, label }) => (
          <li key={id}>
            <a data-a2="chip" href={`#${id}`}>
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
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

/** "Ce qui est définitif" (rows D3-D5). */
export function FinalSection() {
  return (
    <section
      id={SECTION_ID.final}
      className={styles.a2}
      data-a2-band="canvas"
      data-a2-anchor="true"
      aria-labelledby="definitif-titre"
    >
      <Container width="public">
        <h2 data-a2="heading" id="definitif-titre">
          {PAGE.final.heading}
        </h2>
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
      </Container>
    </section>
  );
}

/** "Qui suit votre choix" (row D8) beside "Ce que couvre l'option" (row L18). */
export function FamilyAndScope() {
  return (
    <div className={styles.a2} data-a2-band="surface">
      <Container width="public">
        <div data-a2="pair" data-a2-gap="wide">
          <section id={SECTION_ID.family} data-a2-anchor="true" aria-labelledby="famille-titre">
            <h2 data-a2="heading" id="famille-titre">
              {PAGE.family.heading}
            </h2>
            {PAGE.family.body.map((paragraph) => (
              <p data-a2="paragraph" key={paragraph}>
                {paragraph}
              </p>
            ))}
            <p data-a2="source">{PAGE.family.source(READ_ON)}</p>
          </section>
          <section id={SECTION_ID.scope} data-a2-anchor="true" aria-labelledby="couverture-titre">
            <h2 data-a2="heading" id="couverture-titre">
              {PAGE.scope.heading}
            </h2>
            {PAGE.scope.body.map((paragraph) => (
              <p data-a2="paragraph" key={paragraph}>
                {paragraph}
              </p>
            ))}
            <p data-a2="source">{PAGE.scope.source(READ_ON)}</p>
          </section>
        </div>
      </Container>
    </div>
  );
}

/**
 * The two cards: what each choice implies (rows L1-L11, L19-L21). The rate
 * and the allowance are the newest year's, from the data (R147).
 */
export function ChoiceCards({ year }: { readonly year: ComparatorYear }) {
  return (
    <div className={styles.a2} data-a2-band="canvas">
      <Container width="public">
        <div data-a2="pair">
          <article id={SECTION_ID.france} data-a2="choice" data-a2-anchor="true" aria-labelledby="france-titre">
            <p data-a2="side">
              <span data-a2="dot" data-a2-side="france" aria-hidden="true" />
              {PAGE.france.label}
            </p>
            <h2 data-a2="choice-heading" id="france-titre">
              {PAGE.france.heading}
            </h2>
            <List
              items={PAGE.france.items(formatWholePercent(year.ratePercent), formatWholePercent(year.allowancePercentOfPass))}
            />
            <p data-a2="source">{PAGE.france.source(READ_ON)}</p>
          </article>
          <article id={SECTION_ID.switzerland} data-a2="choice" data-a2-anchor="true" aria-labelledby="suisse-titre">
            <p data-a2="side">
              <span data-a2="dot" data-a2-side="switzerland" aria-hidden="true" />
              {PAGE.switzerland.label}
            </p>
            <h2 data-a2="choice-heading" id="suisse-titre">
              {PAGE.switzerland.heading}
            </h2>
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
          </article>
        </div>
      </Container>
    </div>
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
