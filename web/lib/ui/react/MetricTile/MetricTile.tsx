// web/lib/ui/react/MetricTile/MetricTile.tsx
//
// One figure with its label. SPEC 9.3 stands four of them side by side -
// remaining days before each threshold, days taxed in each country.
//
// IT TAKES A SignedDays, NOT A NUMBER, and that is the whole design. SPEC 7.2
// step 6: "Negative values are reported, never clamped. 'Vous êtes 6 jours
// au-dessus' beats '0 jours restants'." A headroom of -6 is not minus six
// days of headroom; it is six days OVER, which is a different sentence about
// a different quantity. Given a signed number this component would have to
// choose between rendering "-6" and rendering "6", and the first is the wrong
// sentence rather than the wrong format.
//
// So formatSignedDays hands over the magnitude already formatted plus a flag,
// and the sign is rendered as WORDS: the label is replaced and the figure
// turns red. No minus character is ever emitted, and a test asserts it in
// both the ASCII and the typographic form.
//
// The negative state is a DATA ATTRIBUTE, not an inline colour. The Zone and
// Status colours are inline because they are keyed by a union that
// zone-tokens.ts owns; this is a binary variant, so the markup carries the
// state and the stylesheet carries the paint.

import type { SignedDays } from '@/lib/ui/core';
import { METRIC_COPY } from '@/lib/fr/metrics';
import styles from './MetricTile.module.scss';

export interface MetricTileProps {
  /**
   * The ordinary label. A prop rather than a lib/fr constant because two of
   * SPEC 9.3's four tiles name a threshold, and a threshold belongs to the
   * year's RuleSet (SPEC 7.7) - never to copy, where it would go stale in
   * silence.
   */
  readonly label: string;
  readonly days: SignedDays;
}

export function MetricTile({ label, days }: MetricTileProps) {
  return (
    <div className={styles.root}>
      <p className={styles.label}>{days.negative ? METRIC_COPY.over : label}</p>
      <p className={styles.figure} data-negative={days.negative}>
        {days.text}
      </p>
    </div>
  );
}
