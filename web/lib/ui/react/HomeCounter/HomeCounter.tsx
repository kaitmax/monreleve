// web/lib/ui/react/HomeCounter/HomeCounter.tsx
//
// THE HOME PAGE'S COUNTER (FW-HOME-A2, R711): two sliders, the rate, the two
// "jours restants" tiles and the rail - and the ONLY client island the home
// page adds.
//
// IT COMPUTES NOTHING. Every figure is calculateTelework's, through
// lib/content/home-counter.ts, and formatted by the product's own formatters:
// formatPercent at two decimals for the declarable rate (so 39,16 %, never
// 39,17 % - the engine truncates and nothing here rounds), formatSignedDays
// for the tiles. tests/unit/pages/home-counter.test.tsx drives both sliders
// over their whole ranges and requires every figure on screen to equal the
// engine's output for that position.
//
// A CORRECT VALUE BEFORE HYDRATION. The server renders this component with the
// initial slider values, so the HTML already carries the engine's answer for
// them; hydration changes nothing on screen until a slider moves. That is also
// why the island holds no effect and no loading state.
//
// THE WORDS ARRIVE AS PROPS, every one a plain string the server page built
// from lib/fr/home.ts. Importing that module here would ship the whole home
// page's copy to the browser to render eight strings (R723's budget).
//
// STATUS IS NEVER COLOUR ALONE (DESIGN-SYSTEM section 1): RateDisplay colours
// the figure by zone, and the sentence beside it says the same thing in words.
// The sentence is a polite live region, so a screen reader hears the status
// change when a slider crosses a threshold - and nothing on every other step,
// because the sentence only changes at a crossing.

'use client';

import { type ReactNode, useState } from 'react';
import { ruleSetFor } from '@/lib/calc-engine';
import { COUNTER_BASIS, COUNTER_TELEWORK, counterFigures } from '@/lib/content/home-counter';
import { formatSignedDays, zoneFor } from '@/lib/ui/core';
import type { Zone } from '@/lib/ui/core';
import { MetricTile } from '@/lib/ui/react/MetricTile/MetricTile';
import { RateDisplay } from '@/lib/ui/react/RateDisplay/RateDisplay';
import { ThresholdRail } from '@/lib/ui/react/ThresholdRail/ThresholdRail';
import styles from './HomeCounter.module.scss';

/** FD1's rail width, the calculator panel's; the SVG scales down below it. */
const RAIL_WIDTH = 376;

/**
 * A slider's label with its current value after it (R719: sliders labelled
 * with their value). The label already ends on the French colon and its
 * no-break space; the value follows an ordinary space.
 */
const withValue = (label: string, value: number): string => `${label} ${String(value)}`;

/** Every word the counter shows, already resolved on the server. */
export interface HomeCounterCopy {
  readonly rateLabel: string;
  readonly status: Readonly<Record<Zone, string>>;
  readonly fiscalTile: string;
  readonly fiscalOver: string;
  readonly socialTile: string;
  readonly socialOver: string;
  readonly teleworkLabel: string;
  readonly basisLabel: string;
}

/**
 * THE FORM THE SLIDERS SIT IN, for a reader with no JavaScript (R346, R351).
 *
 * The sliders are native controls, so they move without a script; only the
 * figures above them cannot follow. So the counter is a GET form to the page
 * that ANSWERS - the calculator's result page - with the sliders named after
 * the calculator's own parameters, and the page passes a <noscript> block as
 * children: a canton choice and a submit button, which only a reader with
 * scripting off ever sees. With scripting on, the form has no submit button
 * and nothing submits it.
 */
export interface HomeCounterForm {
  readonly action: string;
  /** The parameter the telework slider is (SPEC 9.4's tt). */
  readonly teleworkName: string;
  /** The parameter the basis slider is (SPEC 9.4's total). */
  readonly basisName: string;
  /** Fixed parameters the simplified input implies (the exact method). */
  readonly hidden: readonly (readonly [name: string, value: string])[];
}

export interface HomeCounterProps {
  /** The year whose RuleSet places the ticks and computes the figures. */
  readonly taxYear: number;
  readonly copy: HomeCounterCopy;
  readonly form: HomeCounterForm;
  /** The no-script fallback, rendered by the server inside the form. */
  readonly children?: ReactNode;
  /**
   * Where the sliders open. Defaults to the design's position; the workbench
   * passes one per zone so every state has a specimen (R722).
   */
  readonly initialTelework?: number;
  readonly initialBasis?: number;
}

export function HomeCounter({
  taxYear,
  copy,
  form,
  children,
  initialTelework = COUNTER_TELEWORK.initial,
  initialBasis = COUNTER_BASIS.initial,
}: HomeCounterProps) {
  const [telework, setTelework] = useState(initialTelework);
  const [basis, setBasis] = useState(initialBasis);

  const thresholds = ruleSetFor(taxYear);
  const figures = counterFigures(taxYear, telework, basis);

  // The engine refused the position. Unreachable from the sliders (the sweep
  // proves it), and a counter with no figure is better than one with a made-up
  // figure - so the sliders stay and the figures go.
  const zone = figures === null ? null : zoneFor(figures.declarableRate, thresholds);

  return (
    <form className={styles.root} method="get" action={form.action} data-counter>
      {form.hidden.map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}

      {figures !== null && zone !== null ? (
        <div className={styles.figures}>
          <div className={styles.rateColumn}>
            <p className={styles.rateLabel}>{copy.rateLabel}</p>
            <div data-counter-rate>
              <RateDisplay declarableRate={figures.declarableRate} zone={zone} />
            </div>
            <p className={styles.status} aria-live="polite">
              {copy.status[zone]}
            </p>
            <div className={styles.rail}>
              <ThresholdRail
                percentage={figures.declarableRate}
                zone={zone}
                thresholds={thresholds}
                variant="inline"
                width={RAIL_WIDTH}
              />
            </div>
          </div>

          <div className={styles.tiles}>
            <div className={styles.tile}>
              <MetricTile
                days={formatSignedDays(figures.remainingToFiscal)}
                label={copy.fiscalTile}
                overLabel={copy.fiscalOver}
              />
            </div>
            <div className={styles.tile}>
              <MetricTile
                days={formatSignedDays(figures.remainingToSocial)}
                label={copy.socialTile}
                overLabel={copy.socialOver}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className={styles.sliders}>
        <div className={styles.slider}>
          <label className={styles.sliderLabel} htmlFor="home-counter-tt">
            {withValue(copy.teleworkLabel, telework)}
          </label>
          <input
            className={styles.range}
            id="home-counter-tt"
            name={form.teleworkName}
            type="range"
            min={COUNTER_TELEWORK.min}
            max={COUNTER_TELEWORK.max}
            step={1}
            value={telework}
            onChange={(event) => setTelework(Number(event.target.value))}
          />
        </div>

        <div className={styles.slider}>
          <label className={styles.sliderLabel} htmlFor="home-counter-base">
            {withValue(copy.basisLabel, basis)}
          </label>
          <input
            className={styles.range}
            id="home-counter-base"
            name={form.basisName}
            type="range"
            min={COUNTER_BASIS.min}
            max={COUNTER_BASIS.max}
            step={1}
            value={basis}
            onChange={(event) => setBasis(Number(event.target.value))}
          />
        </div>
      </div>

      {children}
    </form>
  );
}
