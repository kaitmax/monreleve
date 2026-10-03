// web/lib/ui/react/IconTile/IconTile.tsx
//
// The 44 x 44 info-soft square that fronts a destination card (FD11 §2, FW34).
// SPEC 20 ruling H5 adds it alongside Button and Card.
//
// IT IMPORTS NO ICON, the same decision Button's `text` variant makes: the
// caller passes the Lucide glyph as a child, and the tile owns its PRESENTATION
// - the 24 px size (--size-icon-lg), the brand colour and the 1.75 stroke -
// through CSS, so every tile matches without the caller repeating three props.
// A bare <Calculator /> in and the tile is identical to <BookOpen /> in.
//
// A SERVER COMPONENT. R136: content ships zero client JavaScript, and a square
// holding a glyph needs none.
//
// aria-hidden, because the glyph is decorative: the card's h3 and body say the
// same thing in words, and announcing the icon would read the card's subject
// twice. The tile is the first site of the --size-icon-tile token (H9); GuideCta
// is the second, and its own note asked for exactly this token.

import type { ReactNode } from 'react';
import styles from './IconTile.module.scss';

export interface IconTileProps {
  /**
   * A single Lucide glyph, passed with NO size or strokeWidth props: the tile
   * sets both in CSS so the set is uniform and IconTile imports no icon.
   */
  readonly children: ReactNode;
}

export function IconTile({ children }: IconTileProps) {
  return (
    <span className={styles.tile} aria-hidden="true">
      {children}
    </span>
  );
}
