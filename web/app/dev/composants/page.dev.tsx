// web/app/dev/composants/page.tsx
// The workbench: every component, every state. No Storybook (SPEC section 4).
//
// Every specimen carries a data-testid, because this page is what the
// Playwright passes drive - the computed-style checks only a real browser can
// answer (AC3's tabular figures), and the screenshot baselines. Those ids are
// the contract between this page and e2e/, so renaming one is a test change.
//
// IT MUST RENDER THROUGH THE REAL CASCADE, which is why the specimens live in
// a page rather than being rasterised in isolation: the colours and type are
// var() references, and a baseline taken without the token layer would be
// black text at 16 px Times - identically for every state, silently.
// app/layout.tsx loads global.scss, which @use "tokens".
//
// THE RAIL'S BASELINES ARE NOT DUPLICATED HERE. app/dev/rail-gallery already
// holds ten R37 container baselines over the full variant x zone matrix,
// including the `social` variant this page has no reason to show. The rail
// appears here so the axe sweep and a reviewer see it beside its neighbours;
// the screenshot contract for it stays where it was made.
//
// Noindex and out of the sitemap. Not a public route, so it is excluded from
// the R2 gates by segment; `pnpm size` reports it separately.

import type { Metadata } from 'next';
import { ruleSetFor } from '@/lib/calc-engine';
import { WORKBENCH_TITLE } from '@/lib/fr';
import { errorMessage } from '@/lib/fr/errors';
import { METRIC_COPY } from '@/lib/fr/metrics';
import { WORKBENCH } from '@/lib/fr/workbench';
import { formatDays, formatPercent, formatSignedDays } from '@/lib/ui/core';
import { Container } from '@/lib/ui/react/Container/Container';
import { DataGrid } from '@/lib/ui/react/DataGrid/DataGrid';
import { FieldGroup } from '@/lib/ui/react/FieldGroup/FieldGroup';
import { LegalNote } from '@/lib/ui/react/LegalNote/LegalNote';
import { MetricTile } from '@/lib/ui/react/MetricTile/MetricTile';
import { guideNavLinks } from '@/lib/guides/registry';
import { NavMenu, PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';
import { SHELL_NAV } from '@/lib/fr/shell';
import { RateDisplay } from '@/lib/ui/react/RateDisplay/RateDisplay';
import { ThresholdRail } from '@/lib/ui/react/ThresholdRail/ThresholdRail';
import { ZoneBadge } from '@/lib/ui/react/ZoneBadge/ZoneBadge';
import { ComparisonPanel } from '@/lib/ui/react/Comparison/ComparisonPanel';
import { IrrevocabilityBanner } from '@/lib/ui/react/Comparison/IrrevocabilityBanner';
import { DEFAULT_YEAR } from '@/lib/lamal/years';
import { calculateTelework } from '@/lib/calc-engine';
import { heroExampleInput } from '@/lib/content/home';
import { PRODUCT_STATE } from '@/lib/content/product-state';
import { HOME_COPY } from '@/lib/fr/home';
import { Faq } from '@/lib/ui/react/Faq/Faq';
import { HeroPhone } from '@/lib/ui/react/HeroPhone/HeroPhone';
import { HomeCounter, type HomeCounterCopy } from '@/lib/ui/react/HomeCounter/HomeCounter';
import { ReleveExcerpt } from '@/lib/ui/react/ReleveExcerpt/ReleveExcerpt';
import styles from './page.module.scss';

export const metadata: Metadata = {
  title: WORKBENCH_TITLE,
  robots: { index: false, follow: false },
};

const RULES = ruleSetFor(2026);
const THRESHOLDS = {
  fiscalCeiling: RULES.fiscalCeiling,
  socialCeiling: RULES.socialCeiling,
};

// A rate inside each band, so the fill is visible and the three differ.
const RATE = { compliant: 34.58, exposure: 45.2, social: 60 };

// Geneva case (c): 39,16 % declarable against 45,0 % of days outside
// Switzerland. The fixture the two-rate rule exists for (SPEC 9.3).
const GENEVA_C = { declarable: 39.16, raw: 45 };

const RAIL_WIDTH = 376;

// Already through lib/ui/core/format: DataGrid renders strings and formats
// nothing (FW9 protocol item 7).
const GRID_COLUMNS = [
  { key: 'month', header: WORKBENCH.grid.month },
  { key: 'days', header: WORKBENCH.grid.days, numeric: true },
];
const GRID_ROWS = [
  { key: 'jan', cells: { month: WORKBENCH.grid.january, days: formatDays(12.5) } },
  { key: 'feb', cells: { month: WORKBENCH.grid.february, days: formatDays(1234.5) } },
  { key: 'mar', cells: { month: WORKBENCH.grid.march, days: formatDays(3) } },
];
const GRID_TOTAL = {
  key: 'total',
  cells: { month: WORKBENCH.grid.total, days: formatDays(1250) },
};

const FIELD_ERROR = errorMessage({ code: 'NEGATIVE_DAYS', field: 'teleworkDays' });

// RULING R73: both tile labels name their ceiling, and the ceiling is
// formatted from the RuleSet rather than written as a literal. This is what a
// caller is expected to do - MetricTile owns no copy.
// One decimal, stated rather than defaulted (R97): these render "40,0 %"
// and "49,9 %". Whether a whole threshold should read "40 %" instead is an
// open question and deliberately not decided here.
const FISCAL = formatPercent(RULES.fiscalCeiling * 100, 1);
const SOCIAL = formatPercent(RULES.socialCeiling * 100, 1);

// FW-HOME-A2 (R722). The counter's words, built the way the home page builds
// them; the thresholds as the page formats them (whole 40, one-decimal 49,9).
const HOME_FISCAL = formatPercent(RULES.fiscalCeiling * 100, 0);
const HOME_SOCIAL = formatPercent(RULES.socialCeiling * 100, 1);
const COUNTER_COPY: HomeCounterCopy = {
  rateLabel: HOME_COPY.counter.rateLabel,
  status: HOME_COPY.counter.status,
  fiscalTile: HOME_COPY.counter.tile(METRIC_COPY.remaining(HOME_FISCAL), HOME_COPY.counter.fiscalRule),
  fiscalOver: HOME_COPY.counter.tile(METRIC_COPY.over(HOME_FISCAL), HOME_COPY.counter.fiscalRule),
  socialTile: HOME_COPY.counter.tile(METRIC_COPY.remaining(HOME_SOCIAL), HOME_COPY.counter.socialRule),
  socialOver: HOME_COPY.counter.tile(METRIC_COPY.over(HOME_SOCIAL), HOME_COPY.counter.socialRule),
  teleworkLabel: HOME_COPY.counter.teleworkLabel,
  basisLabel: HOME_COPY.counter.basisLabel,
};
/** A form that goes nowhere a specimen should send anyone: the workbench itself. */
const COUNTER_FORM = { action: '/dev/composants', teleworkName: 'tt', basisName: 'total', hidden: [] };
/**
 * One slider position per zone, on a 220-day year: 62 days is 28,18 %, 100 is
 * 45,45 % and 130 is 59,09 % - the engine places each; the specimens only
 * choose where the sliders start.
 */
const COUNTER_AT = { compliant: 62, exposure: 100, social: 130, basis: 220 };
const PHONE_EXAMPLE = calculateTelework(heroExampleInput(2026));

function Specimen({
  id,
  caption,
  children,
}: {
  readonly id: string;
  readonly caption: string;
  readonly children: React.ReactNode;
}) {
  return (
    <figure className={styles.specimen} data-testid={id}>
      <figcaption className={styles.caption}>{caption}</figcaption>
      {children}
    </figure>
  );
}

export default function WorkbenchPage() {
  return (
    <main className={styles.page}>
      <h1>{WORKBENCH_TITLE}</h1>

      {/*
        FW1 AC1's TABULAR-NUMERAL PROOF, moved here by FW20.

        It lived on the home page, where it rendered a bare "1 234,5" between
        the intro and the footer - a test artifact on the product's front
        door, shipped since FW1 and photographed by every accueil baseline
        since. Nothing objected: it was a valid figure, correctly formatted,
        and no assertion was about whether a reader should see it.

        AC1 asks that tabular numerals be verified ON A FIGURE, which this
        still is, and a workbench is where a component proof belongs. Through
        formatDays rather than quoted, because lib/fr once carried the
        rendered string with a hand-typed U+202F in it - a second producer of
        the one codepoint SPEC 6.4 mandates.
      */}
      <figure className="u-tnum" data-testid="tabular-proof">
        {formatDays(1234.5)}
      </figure>
      <p className={styles.intro}>{WORKBENCH.intro}</p>

      <section className={styles.section}>
        <h2>{WORKBENCH.rail.title}</h2>
        <div className={styles.specimens}>
          <Specimen id="rail-inline-compliant" caption={WORKBENCH.rail.inlineCompliant}>
            <ThresholdRail
              percentage={RATE.compliant}
              zone="compliant"
              thresholds={THRESHOLDS}
              variant="inline"
              width={RAIL_WIDTH}
            />
          </Specimen>
          <Specimen id="rail-inline-exposure" caption={WORKBENCH.rail.inlineExposure}>
            <ThresholdRail
              percentage={RATE.exposure}
              zone="fiscal-exposure"
              thresholds={THRESHOLDS}
              variant="inline"
              width={RAIL_WIDTH}
            />
          </Specimen>
          <Specimen id="rail-inline-social" caption={WORKBENCH.rail.inlineSocial}>
            <ThresholdRail
              percentage={RATE.social}
              zone="social-switch"
              thresholds={THRESHOLDS}
              variant="inline"
              width={RAIL_WIDTH}
            />
          </Specimen>
          <Specimen id="rail-compact-compliant" caption={WORKBENCH.rail.compactCompliant}>
            <ThresholdRail
              percentage={RATE.compliant}
              zone="compliant"
              thresholds={THRESHOLDS}
              variant="compact"
              width={RAIL_WIDTH}
            />
          </Specimen>
          <Specimen id="rail-compact-exposure" caption={WORKBENCH.rail.compactExposure}>
            <ThresholdRail
              percentage={RATE.exposure}
              zone="fiscal-exposure"
              thresholds={THRESHOLDS}
              variant="compact"
              width={RAIL_WIDTH}
            />
          </Specimen>
          <Specimen id="rail-compact-social" caption={WORKBENCH.rail.compactSocial}>
            <ThresholdRail
              percentage={RATE.social}
              zone="social-switch"
              thresholds={THRESHOLDS}
              variant="compact"
              width={RAIL_WIDTH}
            />
          </Specimen>
          {/* R33: a non-finite rate renders the unavailable state rather than
              a rail positioned at NaN, which would draw at zero and read as
              having used none of the allowance. */}
          <Specimen id="rail-unavailable" caption={WORKBENCH.rail.unavailable}>
            <ThresholdRail
              percentage={Number.NaN}
              zone="compliant"
              thresholds={THRESHOLDS}
              variant="inline"
              width={RAIL_WIDTH}
            />
          </Specimen>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{WORKBENCH.badge.title}</h2>
        <div className={styles.specimens}>
          <Specimen id="badge-compliant" caption={WORKBENCH.badge.compliant}>
            <ZoneBadge status="compliant" />
          </Specimen>
          <Specimen id="badge-mission" caption={WORKBENCH.badge.mission}>
            <ZoneBadge status="mission-exposure" />
          </Specimen>
          <Specimen id="badge-regime" caption={WORKBENCH.badge.regime}>
            <ZoneBadge status="regime-lost" />
          </Specimen>
          <Specimen id="badge-social" caption={WORKBENCH.badge.social}>
            <ZoneBadge status="social-switch" />
          </Specimen>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{WORKBENCH.rateDisplay.title}</h2>
        <div className={styles.specimens}>
          <Specimen id="rate-compliant" caption={WORKBENCH.rateDisplay.compliant}>
            <RateDisplay declarableRate={RATE.compliant} zone="compliant" />
          </Specimen>
          <Specimen id="rate-exposure" caption={WORKBENCH.rateDisplay.exposure}>
            <RateDisplay declarableRate={RATE.exposure} zone="fiscal-exposure" />
          </Specimen>
          <Specimen id="rate-social" caption={WORKBENCH.rateDisplay.social}>
            <RateDisplay declarableRate={RATE.social} zone="social-switch" />
          </Specimen>
          <Specimen id="rate-divergent" caption={WORKBENCH.rateDisplay.divergent}>
            <RateDisplay
              declarableRate={GENEVA_C.declarable}
              zone="compliant"
              rawRate={GENEVA_C.raw}
            />
          </Specimen>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{WORKBENCH.metric.title}</h2>
        <div className={styles.specimens}>
          <Specimen id="metric-positive" caption={WORKBENCH.metric.positive}>
            <MetricTile
              label={METRIC_COPY.remaining(FISCAL)}
              overLabel={METRIC_COPY.over(FISCAL)}
              days={formatSignedDays(12.5)}
            />
          </Specimen>
          {/* SPEC 7.2 step 6: six days OVER, never a minus sign. */}
          <Specimen id="metric-negative" caption={WORKBENCH.metric.negative}>
            <MetricTile
              label={METRIC_COPY.remaining(SOCIAL)}
              overLabel={METRIC_COPY.over(SOCIAL)}
              days={formatSignedDays(-6)}
            />
          </Specimen>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{WORKBENCH.legal.title}</h2>
        <div className={styles.specimens}>
          <Specimen id="legal-standing" caption={WORKBENCH.legal.standing}>
            <LegalNote />
          </Specimen>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{WORKBENCH.field.title}</h2>
        <div className={styles.specimens}>
          <Specimen id="field-plain" caption={WORKBENCH.field.plain}>
            <FieldGroup id="wb-plain" label={WORKBENCH.field.label}>
              {(control) => <input type="number" {...control} />}
            </FieldGroup>
          </Specimen>
          <Specimen id="field-helper" caption={WORKBENCH.field.helper}>
            <FieldGroup
              id="wb-helper"
              label={WORKBENCH.field.label}
              helper={WORKBENCH.field.helperText}
            >
              {(control) => <input type="number" {...control} />}
            </FieldGroup>
          </Specimen>
          {/* The message comes from errorMessage, so the workbench shows the
              real copy a form would show rather than a sample sentence. */}
          <Specimen id="field-error" caption={WORKBENCH.field.error}>
            <FieldGroup id="wb-error" label={WORKBENCH.field.label} error={FIELD_ERROR}>
              {(control) => <input type="number" {...control} />}
            </FieldGroup>
          </Specimen>
          <Specimen id="field-both" caption={WORKBENCH.field.both}>
            <FieldGroup
              id="wb-both"
              label={WORKBENCH.field.label}
              helper={WORKBENCH.field.helperText}
              error={FIELD_ERROR}
            >
              {(control) => <input type="number" {...control} />}
            </FieldGroup>
          </Specimen>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{WORKBENCH.grid.title}</h2>
        <div className={styles.specimens}>
          <Specimen id="grid-populated" caption={WORKBENCH.grid.populated}>
            <DataGrid
              caption={WORKBENCH.grid.caption}
              columns={GRID_COLUMNS}
              rows={GRID_ROWS}
            />
          </Specimen>
          {/* Never a blank table: one row spanning every column. */}
          <Specimen id="grid-empty" caption={WORKBENCH.grid.empty}>
            <DataGrid caption={WORKBENCH.grid.caption} columns={GRID_COLUMNS} rows={[]} />
          </Specimen>
          <Specimen id="grid-total" caption={WORKBENCH.grid.withTotal}>
            <DataGrid
              caption={WORKBENCH.grid.caption}
              columns={GRID_COLUMNS}
              rows={GRID_ROWS}
              total={GRID_TOTAL}
            />
          </Specimen>
        </div>
      </section>
      <section className={styles.section}>
        <h2>{WORKBENCH.comparison.title}</h2>
        {/* FW-COMPARATEUR (R661's baselines). The refusal of a premium year
            the site does not hold is reachable by no reader - the year
            selector offers only the years the data has - so this is its only
            picture. The year is the one after the newest, derived (R171). */}
        <div className={styles.stack}>
          <Specimen id="comparison-banner" caption={WORKBENCH.comparison.banner}>
            <IrrevocabilityBanner />
          </Specimen>
          <Specimen id="comparison-refusal" caption={WORKBENCH.comparison.refusal}>
            <ComparisonPanel state={{ kind: 'refusal', year: DEFAULT_YEAR + 1 }} />
          </Specimen>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{WORKBENCH.container.title}</h2>
        {/* Stacked rather than in the specimens row: three widths side by
            side in a flex row would each be squeezed to a third of the page
            and the whole point - how wide each one is - would be invisible. */}
        <div className={styles.stack}>
          <Specimen id="container-public" caption={WORKBENCH.container.public}>
            <Container width="public">
              <p className={styles.sample}>{WORKBENCH.container.sample}</p>
            </Container>
          </Specimen>
          <Specimen id="container-narrow" caption={WORKBENCH.container.narrow}>
            <Container width="narrow">
              <p className={styles.sample}>{WORKBENCH.container.sample}</p>
            </Container>
          </Specimen>
          <Specimen id="container-article" caption={WORKBENCH.container.article}>
            <Container width="article">
              <p className={styles.sample}>{WORKBENCH.container.sample}</p>
            </Container>
          </Specimen>
        </div>
      </section>

      <section className={styles.section}>
        <h2>{WORKBENCH.shell.title}</h2>
        {/* The shell renders its own header and footer, so the specimen is
            the whole thing rather than a part of it. The MOBILE header with
            the menu open is captured by the visual spec at a 360 px
            viewport - an element screenshot cannot change what a viewport
            media query resolves to. */}
        <div className={styles.stack}>
          <Specimen id="shell-desktop" caption={WORKBENCH.shell.desktop}>
            <PublicShell guideLinks={guideNavLinks()}>
              <p className={styles.sample}>{WORKBENCH.container.sample}</p>
            </PublicShell>
          </Specimen>
          {/* FW33. The shell collapsed a menu with one live child into a
              link, so no page showed the disclosure or its caret. Since
              FW-COMPARATEUR both children are live and every page header
              shows it; the specimen stays as the menu's isolated record. */}
          <Specimen id="shell-nav-disclosure" caption={WORKBENCH.shell.navDisclosure}>
            <NavMenu entries={SHELL_NAV.filter((entry) => entry.children !== undefined)} />
          </Specimen>
        </div>
      </section>

      {/* FW-HOME-A2 (R722): LAST, AFTER THE SHELL, on purpose. The shell
          specimen is taller than the viewport and its header is sticky, so
          its element screenshot depends on where the specimen sits on the
          page: placed above it, these specimens moved it down and four shell
          baselines changed with no change to the shell. Measured, then moved. */}
      <section className={styles.section}>
        <h2>{WORKBENCH.home.title}</h2>
        <div className={styles.stack}>
          <Specimen id="home-excerpt" caption={WORKBENCH.home.excerpt}>
            <ReleveExcerpt state={PRODUCT_STATE} />
          </Specimen>
          <Specimen id="home-counter-compliant" caption={WORKBENCH.home.counterCompliant}>
            <HomeCounter
              taxYear={2026}
              copy={COUNTER_COPY}
              form={COUNTER_FORM}
              initialTelework={COUNTER_AT.compliant}
              initialBasis={COUNTER_AT.basis}
            />
          </Specimen>
          <Specimen id="home-counter-exposure" caption={WORKBENCH.home.counterExposure}>
            <HomeCounter
              taxYear={2026}
              copy={COUNTER_COPY}
              form={COUNTER_FORM}
              initialTelework={COUNTER_AT.exposure}
              initialBasis={COUNTER_AT.basis}
            />
          </Specimen>
          <Specimen id="home-counter-social" caption={WORKBENCH.home.counterSocial}>
            <HomeCounter
              taxYear={2026}
              copy={COUNTER_COPY}
              form={COUNTER_FORM}
              initialTelework={COUNTER_AT.social}
              initialBasis={COUNTER_AT.basis}
            />
          </Specimen>
          {PHONE_EXAMPLE.ok ? (
            <>
              <Specimen id="home-phone-android" caption={WORKBENCH.home.phoneAndroid}>
                <HeroPhone platform="android" result={PHONE_EXAMPLE.value} taxYear={2026} fiscal={HOME_FISCAL} />
              </Specimen>
              <Specimen id="home-phone-iphone" caption={WORKBENCH.home.phoneIphone}>
                <HeroPhone platform="iphone" result={PHONE_EXAMPLE.value} taxYear={2026} fiscal={HOME_FISCAL} />
              </Specimen>
            </>
          ) : null}
          <Specimen id="home-faq-pair" caption={WORKBENCH.home.faqPair}>
            <Faq
              heading={HOME_COPY.questions.heading}
              layout="split"
              entries={[
                {
                  id: 'wb-change',
                  question: HOME_COPY.questions.change.question,
                  answer: HOME_COPY.questions.change.afterBody,
                  open: true,
                  pair: {
                    before: { label: HOME_COPY.questions.change.before, body: HOME_COPY.questions.change.beforeBody },
                    after: { label: HOME_COPY.questions.change.after, body: HOME_COPY.questions.change.afterBody },
                  },
                },
                {
                  id: 'wb-position',
                  question: HOME_COPY.questions.position.question,
                  answer: HOME_COPY.questions.position.answer,
                },
              ]}
            />
          </Specimen>
        </div>
      </section>
    </main>
  );
}
