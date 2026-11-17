// web/app/(public)/calculateur-teletravail-frontalier/page.tsx
//
// FW11 increment 1: the route, the server shell and ruling R54's gate. The
// form island arrives in increment 2 and slots in where the comment says so.
//
// A SERVER COMPONENT, and that is the whole architecture of this page. SPEC
// 9.3: "the calculation needs JavaScript; the page must be meaningful without
// it." So the heading, the intro and the three explanatory paragraphs are
// rendered on the server and are there whether or not the island ever
// hydrates. AC3 puts it as a requirement: with JavaScript disabled the page
// shows the full explanatory copy and no result - "never a blank shell".
//
// RULING R54 - THE GATE. The calculator was built while the Checkpoint A human
// gate was unrecorded, on the reasoning that the gate governs SHIPPING the
// calculator rather than building it: the UI reads every constant from
// RuleSet, so a corrected constant changes no UI code. The condition was that
// the route stay invisible until the gate was recorded, and the mechanism is
// the same constant that drives the footer, LAST_REGULATORY_REVIEW.
//
// Three surfaces, one condition:
//
//   this file            robots noindex while the review is null
//   sitemap.xml          excluded, via the registry's `gate` field
//   nav and footer       absent, via the same field
//
// The review WAS recorded, on 09.09.2026, so all three are open today. The
// closed branch is therefore the one that would rot unnoticed, and it is
// asserted explicitly rather than left to the past - see
// tests/unit/content/regulatory-gate.test.ts.
//
// RULING R55 - THE YEAR. Resolved here, on the server, from the Europe/Paris
// date. The engine reads no clock (SPEC 20) and a year taken from the host's
// zone is wrong for half an hour every 31 December - see
// lib/content/tax-year.ts.

import type { Metadata } from 'next';
import { ruleSetFor } from '@/lib/calc-engine';
import { faqPageLd, webApplicationLd } from '@/lib/content/jsonld';
import { CALCULATOR_PATH, gateRobotsDirective, liveHrefs } from '@/lib/content/routes';
import { canonicalsAvailable, siteOrigin } from '@/lib/content/site';
import { currentTaxYear } from '@/lib/content/tax-year';
import { CALCULATEUR_COPY as COPY } from '@/lib/fr/calculateur';
import { FAQ_COPY } from '@/lib/fr/faq';
import { HOME_COPY } from '@/lib/fr/home';
import { RESULT_COPY } from '@/lib/fr/result';
import { SOURCE_CITATIONS } from '@/lib/fr/sources';
import { formatDays, formatPercent } from '@/lib/ui/core';
import { Container } from '@/lib/ui/react/Container/Container';
import { AppCard } from './AppCard';
import { CalculatorForm } from './CalculatorForm';
import { AlertCapture } from '@/lib/ui/react/AlertCapture/AlertCapture';
import { Faq } from '@/lib/ui/react/Faq/Faq';
import { JsonLd } from '@/lib/ui/react/JsonLd/JsonLd';
import styles from './calculateur.module.scss';

/**
 * A ceiling as prose reads it: no decimal when the value is whole.
 *
 * "sous 40 %" rather than "sous 40,0 %", and "49,9 %" rather than "49,9 %"
 * truncated to "49 %". The rail already chooses its precision this way
 * (lib/ui/core/rail/renderRailSvg.ts) so this is that pattern rather than a
 * new one - and it is local because two consumers is not yet three. If a
 * third appears, it belongs in lib/ui/core/format.
 *
 * FD1 writes the thresholds as "40 %" and "49,9 %", which is what this
 * produces. Whether a whole threshold should instead read "40,0 %" everywhere
 * is an open question and deliberately not decided here.
 */
function ceiling(rate: number): string {
  const percent = rate * 100;

  return formatPercent(percent, Number.isInteger(percent) ? 0 : 1);
}

/**
 * STATICALLY RENDERED, REVALIDATED HOURLY - and the first two attempts at this
 * line were both wrong, so the reasoning is here in full.
 *
 * ATTEMPT 1 was `force-dynamic`, justified by ruling R54's gate. Wrong twice
 * over. The gate reads LAST_REGULATORY_REVIEW, a module constant, so changing
 * it is a code change and a rebuild follows - a static page bakes the correct
 * answer and needs no per-request render.
 *
 * AND force-dynamic ACTIVELY BROKE THE PAGE'S SEO, which is the whole point of
 * the page. Next STREAMS a dynamically rendered route, and measured against a
 * production build the metadata came out AFTER the closing head tag:
 *
 *     </head>            at byte 1115
 *     <title>            at byte 7672
 *     rel="canonical"    at byte 7921
 *
 * In the browser that put 0 titles and 0 canonicals inside <head> - confirmed
 * by probe, against 1 and 1 on the statically rendered /cgu. Google ignores
 * rel=canonical outside <head>, so the canonical on the one page that exists
 * to rank would have been discarded. A self-referencing canonical that is
 * silently ignored is worse than none: it reads as present in every review.
 *
 * WHAT STILL NEEDS TIME-AWARENESS is R55's year. currentTaxYear() resolved
 * once at build time freezes, so on 1 January the page would state the
 * previous year and keep stating it until someone happened to deploy.
 *
 * SO: static render, hourly revalidation. The head is assembled before the
 * HTML is flushed, and the year is at most an hour stale on the one day a
 * year that matters. The only time-dependent value on this page changes once
 * every twelve months; an hour is a generous margin.
 */
export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const year = currentTaxYear();
  const rules = ruleSetFor(year);
  const robots = gateRobotsDirective();

  return {
    title: COPY.title,
    // SPEC 14: the title and description name the threshold and the year.
    description: COPY.description(ceiling(rules.fiscalCeiling), year),

    // R54. The decision lives in lib/content/routes.ts so that BOTH branches
    // are testable: read from here it would depend on a constant this module
    // cannot vary, leaving the noindex branch unprovable.
    ...(robots === null ? {} : { robots }),
  };
}

/**
 * THE PAGE NEVER READS searchParams, AND THAT IS A RULING, NOT AN
 * OVERSIGHT. FW13 increment 2, decided by the operator after measurement.
 *
 * In Next 15.5.25 ANY use of searchParams - in the page OR in
 * generateMetadata, even isolated behind a Suspense boundary - makes the
 * route dynamic and emits <title> and <link rel="canonical"> into the
 * BODY instead of <head>. Five shapes were built and served to measure it:
 *
 *   force-dynamic alone .................. head intact
 *   async page, no searchParams .......... head intact
 *   page awaits searchParams ............. metadata in body
 *   generateMetadata awaits it ........... metadata in body
 *   only a Suspense child awaits it ...... metadata in body
 *
 * This is SPEC 14's target-query page, so a canonical a non-rendering
 * crawler cannot see is not a trade worth making - and AC3's noindex would
 * have landed in the body too, where it is ignored, which would leave
 * param URLs indexable while the tests said otherwise.
 *
 * So the route stays STATIC. Its self-referencing canonical points at the
 * bare path from every URL, which is exactly what SPEC 9.4 asks a param
 * URL to carry; the noindex arrives as an X-Robots-Tag header from
 * middleware.ts, which needs no head and forces no dynamic render. What
 * is given up is the server-rendered first paint: the island decodes the
 * URL on mount, so a shared link shows its result on hydration.
 */
export default function CalculateurPage() {
  const year = currentTaxYear();
  const rules = ruleSetFor(year);
  const fiscal = ceiling(rules.fiscalCeiling);
  const social = ceiling(rules.socialCeiling);


  const faqEntries = FAQ_COPY.entries({
    fiscal,
    social,
    basisDays: formatDays(rules.simplifiedBasisDays),
  });

  return (
    <main className={styles.page}>
      {/*
        SPEC 14's structured data. Two objects, both built from what this
        page already renders:

          WebApplication   name is the h1, description is the visible lead -
                           not the meta description, which a reader never
                           sees. url only when there is a real origin (R81),
                           for the same reason the canonical and the card are
                           conditional.
          FAQPage          generated from the SAME entries the accordion
                           below renders, passed as one array rather than
                           resolved twice. Two resolutions could be given
                           different arguments and both look right alone.

        Nothing here is a claim the page does not make: no rating, no price,
        no author. lib/content/jsonld.ts enforces that with an allow-list.
      */}
      <JsonLd
        data={webApplicationLd({
          name: COPY.title,
          description: COPY.intro(fiscal, social),
          ...(canonicalsAvailable()
            ? { url: `${siteOrigin()}${CALCULATOR_PATH}` }
            : {}),
        })}
      />
      <JsonLd data={faqPageLd(faqEntries)} />

      {/*
        FW-CALCS-A2, R724: THE PAGE HEAD - the year (R55, resolved on the
        server as before), the h1 and the intro - then the two columns, on
        the public measure. The year was a caption under the intro; the A2
        design sets it as a badge above the h1, with the same words.
      */}
      <Container width="public">
        <header>
          <p className={styles.year}>{COPY.yearCaption(year)}</p>
          <h1 className={styles.title}>{COPY.title}</h1>
          <p className={styles.lead}>{COPY.intro(fiscal, social)}</p>
        </header>

        {/*
          THE ISLAND, in a two-column grid it fills itself: its form column
          and its result column (CalculatorForm). taxYear comes from the
          resolution above rather than from a clock inside the island: a
          client-side new Date() reads the VIEWER's timezone, so a frontalier
          travelling would see a different year from the one their filing
          belongs to.

          THE ASIDE closes the result column: the application card (R726)
          and the unconditional link to /sources (R113). Both are SERVER
          elements passed in, so they are in the HTML with scripting off and
          their words never reach the island's bundle. R113's link used to
          sit above the explanation; the A2 design puts it under the result,
          which is where a reader asks where a figure comes from.
        */}
        <div className={styles.layout}>
          <CalculatorForm
            taxYear={year}
            // R976: the result panel's link, resolved HERE against the route
            // registry, so the island receives four answers and no registry.
            liveLinks={liveHrefs(RESULT_COPY.links)}
            aside={
              <>
                <AppCard />
                <p className={styles.sources}>
                  <a href={COPY.form.sourcesLink.href}>{COPY.form.sourcesLink.text}</a>
                </p>
              </>
            }
          />
        </div>
      </Container>

      {/*
        THE CAPTURE CARD. SPEC 9.3 item 8, FW14 increment 5.

        BELOW EVERYTHING THE ISLAND RENDERS, which is where SPEC 9.3 puts it
        and where R137 asserts it stays: the reader's question is "how many
        days do I have left", and the answer must never be behind an email
        field. A server component - a plain form posting to /api/alertes, no
        client JavaScript (R136). On the narrow measure, as before.
      */}
      <Container width="narrow">
        <AlertCapture source="calculateur" />
      </Container>

      {/*
        R728: THE EXPLANATION BAND, as calculateur-a2 draws it - the heading
        beside the two thresholds, each with its figure, its name, the page's
        own paragraph and its source - from copy and sources the site already
        carries: the figures from the RuleSet, the names from the home page's
        band (HOME_COPY.thresholds, by key), the citations from lib/fr/sources.
        The missions paragraph, which the design leaves out, follows them:
        dropping copy is not styling.

        The two names are paragraphs, not h3s: the page's outline is h1 and
        h2 (tests/unit/pages/calculateur.test.tsx), and an h3 here would sit
        under an h2 that is a statement rather than a section title.
      */}
      <section className={styles.band} data-explanation>
        <Container width="public">
            <h2 className={styles.heading}>{COPY.explanationHeading}</h2>
            <div className={styles.rules}>
              <div className={styles.rule}>
                <p>{fiscal}</p>
                <p>{HOME_COPY.thresholds.fiscalTitle}</p>
                <p>{COPY.fiscal(fiscal)}</p>
                <p>
                  {HOME_COPY.thresholds.source(SOURCE_CITATIONS.fiscal)}
                </p>
              </div>
              <div className={styles.rule}>
                <p>{social}</p>
                <p>{HOME_COPY.thresholds.socialTitle}</p>
                <p>{COPY.social(social)}</p>
                <p>
                  {HOME_COPY.thresholds.source(SOURCE_CITATIONS.social)}
                </p>
              </div>
              <p>{COPY.missions(fiscal)}</p>
            </div>
        </Container>
      </section>

      {/*
        THE INLINE FAQ. SPEC 14, FW15 increment 2.

        LAST, AND R137 ASSERTS IT. It elaborates the explanation above, so
        above that prose it would be answering questions the reader has not
        been given yet. Its answers are generated from the same lib/fr
        source the FAQPage structured data is, which is what makes the two
        impossible to disagree. On the article measure: the narrow one is
        the capture card's, and the page has exactly one (calculateur.test).

        FEW CLASSES ON PURPOSE (R736): this page's CSS-module class map ships
        in the calculator's client chunk, the route with the least headroom,
        so the band's children are styled by position in
        calculateur.module.scss rather than each carrying a class.
      */}
      <Container width="article">
        <Faq heading={FAQ_COPY.heading} entries={faqEntries} />
      </Container>
    </main>
  );
}
