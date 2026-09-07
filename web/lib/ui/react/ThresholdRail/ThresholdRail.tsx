// web/lib/ui/react/ThresholdRail/ThresholdRail.tsx
//
// The React wrapper around FW7's string generator, and the words the SVG
// cannot carry.
//
// THE ONLY dangerouslySetInnerHTML IN THE PRODUCT. Its input is
// renderRailSvg's return value and nothing else - a pure function over
// validated numbers, whose every text node is escaped by lib/ui/core/rail/
// xml.ts (all five XML entity characters, proven against both a tag-closing
// and an attribute-closing payload in rail-xml.test.ts). No caller-supplied
// string reaches this markup: the component takes a number, a Zone, two
// ceilings, a variant and a width, and there is no prop through which a
// string could arrive. That is what makes the injection acceptable, and it is
// why the input must never become anything else.
//
// RULING R45 - THE LEGEND. Band names used to sit inside the SVG, centred
// over their bands. That cannot work: "Imposition France" measures 93,7 px at
// Micro 11/500 over a band that is 9,9 % of the track, so it needed roughly
// 950 px of rail before it stopped colliding, and it was illegible at 200 px
// and touching at 376 px. Here the words live in HTML, where a layout engine
// measures and wraps them and no font metric has to be guessed.
//
// The SVG stays a metric-free string generator. That division is the point:
// geometry where arithmetic is enough, HTML where text is involved.

import { renderRailSvg, ZONE_BAND_TOKEN } from '@/lib/ui/core';
import { RAIL_UNAVAILABLE_ARIA, ZONE_BAND_NAME } from '@/lib/fr/rail';
import type { Zone, ZoneThresholds } from '@/lib/ui/core';
import styles from './ThresholdRail.module.scss';

export interface ThresholdRailProps {
  /** declarableRate, as a percentage. Non-finite renders the R33 state. */
  readonly percentage: number;
  readonly zone: Zone;
  /** R35: the ceilings come from the caller's RuleSet, never from here. */
  readonly thresholds: ZoneThresholds;
  readonly variant: 'inline' | 'compact';
  readonly width: number;
}

/**
 * The three bands, in order, taken from the token map so the order and the
 * membership have ONE source. Iterating a literal list here would be a second
 * copy of the Zone union that TypeScript would not catch drifting.
 */
const BANDS = Object.keys(ZONE_BAND_TOKEN) as readonly Zone[];

export function ThresholdRail({
  percentage,
  zone,
  thresholds,
  variant,
  width,
}: ThresholdRailProps) {
  // R33. The rail renders its own unavailable state; the wrapper's job is to
  // say so out loud. Note this component never calls zoneFor - the Zone
  // arrives as a prop, so there is nothing to compute and nothing to throw.
  const unavailable = !Number.isFinite(percentage);

  const svg = renderRailSvg(
    { percentage, zone, width, height: 8, variant },
    thresholds,
  );

  return (
    <div className={styles.root}>
      <div
        className={styles.svg}
        // eslint-disable-next-line react/no-danger -- the sole site in the product
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* Only rendered when the rate is missing. A live region that is always
          present announces on every recalculation, and SPEC 16 already puts
          aria-live on the calculator result - this one exists to report a
          state the result panel cannot infer from a number it does not have. */}
      {unavailable ? (
        <p className={styles.unavailable} aria-live="polite">
          {RAIL_UNAVAILABLE_ARIA}
        </p>
      ) : null}

      {/* R45's legend. Absent for compact, which is the variant chosen when
          there is no room for it - and absent when the rate is unavailable,
          because the band colours would imply a position the rail has just
          said it does not know. */}
      {variant === 'inline' && !unavailable ? (
        <ul className={styles.legend}>
          {BANDS.map((band) => (
            <li className={styles.legendItem} key={band}>
              <span
                className={styles.dot}
                style={{ backgroundColor: `var(${ZONE_BAND_TOKEN[band]})` }}
                aria-hidden="true"
              />
              {ZONE_BAND_NAME[band]}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
