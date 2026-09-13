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
import { CALCULATOR_PATH, gateRobotsDirective } from '@/lib/content/routes';
import { canonicalsAvailable, siteOrigin } from '@/lib/content/site';
import { currentTaxYear } from '@/lib/content/tax-year';
import { CALCULATEUR_COPY as COPY } from '@/lib/fr/calculateur';
import { FAQ_COPY } from '@/lib/fr/faq';
import { formatDays, formatPercent } from '@/lib/ui/core';
import { Container } from '@/lib/ui/react/Container/Container';
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

      <Container width="narrow">
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.lead}>{COPY.intro(fiscal, social)}</p>

        {/* R55: the year the calculation applies to, above the form. */}
        <p className={styles.year}>{COPY.yearCaption(year)}</p>

        {/*
          THE ISLAND. taxYear comes from the resolution above rather than from
          a clock inside the island: a client-side new Date() reads the
          VIEWER's timezone, so a frontalier travelling would see a different
          year from the one their filing belongs to, and the first render would
          disagree with the server's for anybody east of Paris.

          It renders inside the server page with no wrapper and no Suspense
          boundary. The form has nothing to wait for - the engine is
          synchronous and bundled - so a fallback would only add a flash of
          nothing between the static shell and the hydrated form.
        */}
        <CalculatorForm taxYear={year} />

        {/*
          THE CAPTURE CARD. SPEC 9.3 item 8, FW14 increment 5.

          BELOW EVERYTHING THE ISLAND RENDERS, which is where SPEC 9.3 puts it
          and where R137 now asserts it stays. The island renders the form,
          the link notice, the share row and the result panel; this comes
          after all of them, because the reader's question is "how many days
          do I have left" and the answer must never be behind an email field.
          SPEC 9.3: the result is NEVER gated.

          A SERVER COMPONENT INSIDE A STATIC PAGE. It is a plain form posting
          to /api/alertes - no island, no client JavaScript, nothing against
          the 4,4 KiB of GATE A headroom (R136).
        */}
        <AlertCapture source="calculateur" />

      {/*
          THE UNCONDITIONAL LINK TO /sources. RULING R113.

          UNCONDITIONAL, which is the whole reason it is here rather than in
          the provisional notice. P2 - the 49,9 versus under-50 edge - has no
          input trigger by design, so the conditional notice never names it; a
          reader can only reach it through something present whatever they
          type. A disclosure that appears only sometimes cannot carry an
          interpretation that has no condition.

          SERVER-RENDERED, above the explanation, so it is in the HTML with
          scripting off too - the same reason the explanatory copy is.

          THE LegalNote THAT USED TO SIT HERE IS GONE, and a baseline is why.
          calculateur-panneau-regime-perdu-mobile.png showed the standing
          sentence twice about 60 px apart: this copy, and the panel rendering
          SPEC 9.3 slot 6 once there is a result. 1633 tests passed - every
          assertion asked whether the note was PRESENT, and it was, twice.

          SPEC 9.3 puts a legal note in the panel and SPEC 9.1 puts -01
          in the footer; both stay, a screen apart. This copy was mine, added
          in increment 0 for a job the LINK does on its own - and the sentence
          is still in the served HTML with scripting off, from the footer,
          which is a server component too.
        */}
        <p className={styles.sources}>
          <a href={COPY.form.sourcesLink.href}>{COPY.form.sourcesLink.text}</a>
        </p>

        <section className={styles.explanation} data-explanation>
          <h2 className={styles.heading}>{COPY.explanationHeading}</h2>
          <p className={styles.prose}>{COPY.fiscal(fiscal)}</p>
          <p className={styles.prose}>{COPY.social(social)}</p>
          <p className={styles.prose}>{COPY.missions(fiscal)}</p>
        </section>

        {/*
          THE INLINE FAQ. SPEC 14, FW15 increment 2.

          LAST, AND R137 ASSERTS IT. It elaborates the explanation above -
          the two thresholds, missions, sick days - so above that prose it
          would be answering questions the reader has not been given yet. It
          also stays BELOW the capture card: moving it between them would
          push the card down behind three collapsed answers.

          Its answers are generated from the same lib/fr source increment 3
          turns into FAQPage structured data, which is what makes the two
          impossible to disagree.
        */}
        <Faq
          heading={FAQ_COPY.heading}
          entries={faqEntries}
        />
      </Container>
    </main>
  );
}
