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
//
// RULING R73 - IT OWNS NO COPY. Both labels arrive from the caller, which is
// the only layer holding the year's RuleSet. It used to substitute a constant
// of its own on a negative - "Jours au-dessus du seuil" - which reads fine in
// isolation and is wrong in place: SPEC 9.3 stands two negative-capable tiles
// side by side, so both would have carried identical words about different
// ceilings and a reader could not tell which limit had been passed.
//
// BOTH LABELS ARE REQUIRED, not one required and one optional. SPEC 7.2 step 6
// makes "a negative figure never appears under a remaining label" a product
// invariant, and an optional over-label would let a caller ship exactly that
// by omission. The type is what forbids it - the same reasoning as Container's
// closed union and FieldGroup's render prop.

import type { SignedDays } from '@/lib/ui/core';
import styles from './MetricTile.module.scss';

export interface MetricTileProps {
  /**
   * The ordinary label, naming its ceiling. Built by the caller from
   * METRIC_COPY.remaining and a formatPercent of the RuleSet value: a
   * threshold belongs to the rules (SPEC 7.7), never to copy, where it goes
   * stale in silence after a rule change with nothing failing.
   */
  readonly label: string;
  /**
   * Shown INSTEAD of the ordinary label when the headroom is negative, and
   * naming the same ceiling - METRIC_COPY.over of the same formatted
   * threshold. Required; see the module comment.
   */
  readonly overLabel: string;
  readonly days: SignedDays;
}

export function MetricTile({ label, overLabel, days }: MetricTileProps) {
  return (
    <div className={styles.root}>
      <p className={styles.label}>{days.negative ? overLabel : label}</p>
      <p className={styles.figure} data-negative={days.negative}>
        {days.text}
      </p>
    </div>
  );
}
