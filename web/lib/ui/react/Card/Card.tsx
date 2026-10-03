// web/lib/ui/react/Card/Card.tsx
//
// The white bordered card (FD11, FW34). SPEC 20 ruling H5 adds it with Button
// and IconTile.
//
// WHITE, 1 PX --colour-border-default, --radius-lg, NO SHADOW - DESIGN-SYSTEM.md
// section 4 and FD11 both forbid a shadow on a card.
//
// PADDING IS 24 BY DEFAULT, 32 WHEN ASKED. DESIGN-SYSTEM:55 gives 16, but the
// only consumer is FD11's page, which draws 24 for the destination cards and 32
// for the trust band and the closing strip (§5.5). It never uses
// --size-card-padding (16) or --size-card-status-padding (24), which name other
// decisions (R62, R68); the padding is the spacing scale, --space-6 and
// --space-8.
//
// IT IS PRESENTATIONAL. The surrounding <section> and any heading live on the
// page; Card is the box, so it renders a <div> and carries no landmark.
//
// A SERVER COMPONENT: no 'use client'.

import type { ReactNode } from 'react';
import styles from './Card.module.scss';

export interface CardProps {
  readonly children: ReactNode;
  /** 'default' => 24 px padding; 'spacious' => 32 px (trust band, closing). */
  readonly padding?: 'default' | 'spacious';
}

export function Card({ children, padding = 'default' }: CardProps) {
  return (
    <div className={styles.card} data-padding={padding}>
      {children}
    </div>
  );
}
