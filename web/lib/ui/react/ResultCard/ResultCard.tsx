// web/lib/ui/react/ResultCard/ResultCard.tsx
//
// FW-CALCS-A2, R733: the result card - the surface both calculators set their
// answers on (calculateur-a2's "Votre part de teletravail" card and the
// application card under it; comparateur-lamal-a2's two cost cards).
//
// A FRAME, NOTHING ELSE. It computes nothing and words nothing: the caller
// passes the content and any attribute the content's tests rely on (an id,
// aria-live, tabIndex, data-*), and they land on the element unchanged. So the
// calculator's ResultPanel, the island's empty region, /resultat's projection
// and the comparator's panel can all take the A2 card without one of their
// contracts moving.
//
// Two tones. `surface` is the answer: a white card, a hairline border, radius
// xl - the large status card's radius (DESIGN-SYSTEM section 1, as fw-home-a2
// used it for the counter). `brand` is the application card: brand fill,
// white text (11,40:1, REPORT-FW-HOME-A2's R715 measurement), and a link
// inside it drawn as a white button.

import type { HTMLAttributes, ReactNode } from 'react';
import styles from './ResultCard.module.scss';

export interface ResultCardProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'> {
  readonly tone?: 'surface' | 'brand';
  readonly element?: 'section' | 'article' | 'div';
  readonly children: ReactNode;
}

export function ResultCard({ tone = 'surface', element = 'section', children, ...rest }: ResultCardProps) {
  const Element = element;

  return (
    <Element className={tone === 'brand' ? styles.brand : styles.surface} {...rest}>
      {children}
    </Element>
  );
}
