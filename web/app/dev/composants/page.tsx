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
import { DataGrid } from '@/lib/ui/react/DataGrid/DataGrid';
import { FieldGroup } from '@/lib/ui/react/FieldGroup/FieldGroup';
import { LegalNote } from '@/lib/ui/react/LegalNote/LegalNote';
import { MetricTile } from '@/lib/ui/react/MetricTile/MetricTile';
import { RateDisplay } from '@/lib/ui/react/RateDisplay/RateDisplay';
import { ThresholdRail } from '@/lib/ui/react/ThresholdRail/ThresholdRail';
import { ZoneBadge } from '@/lib/ui/react/ZoneBadge/ZoneBadge';
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
const FISCAL = formatPercent(RULES.fiscalCeiling * 100);
const SOCIAL = formatPercent(RULES.socialCeiling * 100);

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
    </main>
  );
}
