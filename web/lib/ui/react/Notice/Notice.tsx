// web/lib/ui/react/Notice/Notice.tsx
//
// FW-CALCS-A2, R733: the error-style banner (comparateur-lamal-a2's
// "Ce choix ne se reprend pas"), in one place.
//
// THE STYLE IS THE ERROR TOKEN'S SOFT FILL AND A FULL BORDER IN THE ERROR
// COLOUR, with a warning icon - and the TEXT in text-primary: R57's split, the
// status colour fails 4,5:1 as body text and passes as a border and an icon.
// An icon AND a heading carry it, never the colour alone (SPEC 16).
//
// A SERVER COMPONENT, with no state and no handler, so a page renders it with
// no client JavaScript. Any data-* attribute the caller passes lands on the
// element - the comparator's tests find its banner by data-banner.

import type { HTMLAttributes, ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import styles from './Notice.module.scss';

export interface NoticeProps extends Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'> {
  /** The heading line, beside the icon. */
  readonly heading: string;
  readonly headingId?: string;
  readonly element?: 'aside' | 'div';
  readonly children: ReactNode;
}

export function Notice({ heading, headingId, element = 'div', children, ...rest }: NoticeProps) {
  const Element = element;

  return (
    <Element className={styles.root} {...rest}>
      <TriangleAlert className={styles.glyph} aria-hidden="true" />
      <div className={styles.body}>
        <p className={styles.heading} {...(headingId === undefined ? {} : { id: headingId })}>
          {heading}
        </p>
        {children}
      </div>
    </Element>
  );
}
