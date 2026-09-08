// web/lib/ui/react/LegalNote/LegalNote.tsx
//
// $legal-01, the standing disclaimer (SPEC 9.3 item 6). It appears on every
// calculating surface, and DESIGN-SYSTEM.md section 5 lists it among the
// things that survive a redesign.
//
// It takes no props. The disclaimer is standing - one text, one place, no
// per-surface variation - and a `text` prop would be the seam through which a
// caller eventually softened it.
//
// RULING R58 OVERRIDES THE FW8 PROMPT ON THE COLOUR. The prompt asks for
// Caption tertiary; #98A2B3 is 2,42:1 on the canvas and 2,58:1 on a card,
// failing AA at both the normal and the large-text bar. Setting the legal
// disclaimer in the one colour nobody can read would be a poor joke. It is
// secondary - 4,68:1 and 4,97:1 - and tertiary survives only as a hairline.

import { LEGAL_COPY } from '@/lib/fr/legal';
import styles from './LegalNote.module.scss';

export function LegalNote() {
  return <p className={styles.note}>{LEGAL_COPY.standing}</p>;
}
