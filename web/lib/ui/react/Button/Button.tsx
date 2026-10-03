// web/lib/ui/react/Button/Button.tsx
//
// The shared button (FD11, FW34). SPEC 20 ruling H5 adds it, with Card and
// IconTile, as the first components the home body needs and nowhere else had.
//
// IT RENDERS AS A LINK OR A BUTTON. Every use on the home page navigates, so
// `href` present gives an <a>; absent gives a <button type="button">. The two
// share one stylesheet keyed by `data-variant`, so a variant looks the same
// whether it links or acts.
//
// FOUR VARIANTS, measured against DESIGN-SYSTEM.md section 4 and FD11:
//   primary       48 h, radius 12, brand fill, white label, min-width 120
//   primaryLarge  56 h, radius 14 (--radius-button-lg), otherwise primary
//   secondary     48 h, radius 12, surface fill, 1 px border
//   text          >= 44 h (--size-touch-target-web, D40), no fill, brand label
//
// THE LABEL IS Body-M 15/500 (ruling H8), the type every shipped button uses
// (CalculatorForm's .calculate). DESIGN-SYSTEM:53 and FD11 say 15/600, but no
// 15/600 triple exists: composing --type-body-m-size with --weight-semibold is
// the cross-family defect R70 removed, and the R70 scan cannot see it, so the
// rule is stated here and Button never pairs a size with a stray weight.
//
// IT IMPORTS NO ICON. The `text` variant's trailing arrow-right is passed by
// the page AS A CHILD (16 px, stroke 1.75), so Button pulls nothing from
// lucide-react into every route that renders a button.
//
// A SERVER COMPONENT: no 'use client'. A link or a plain submit needs none.

import type { ReactNode } from 'react';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'primaryLarge' | 'secondary' | 'text';

export interface ButtonProps {
  readonly variant: ButtonVariant;
  readonly children: ReactNode;
  /** Present => an <a href>; absent => a <button>. */
  readonly href?: string;
  /** The <button> form's type. Ignored for the link form. */
  readonly type?: 'button' | 'submit';
}

export function Button({ variant, children, href, type = 'button' }: ButtonProps) {
  if (href !== undefined) {
    return (
      <a className={styles.button} data-variant={variant} href={href}>
        {children}
      </a>
    );
  }

  return (
    <button className={styles.button} data-variant={variant} type={type}>
      {children}
    </button>
  );
}
