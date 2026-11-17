// web/app/(public)/calculateur-lamal-cmu/ReminderOutcomes.tsx
//
// FW-DELAI-RAPPEL: where the two links in a reminder message land - the
// confirmation link, and the delete link's one button (R1002: the link opens
// a page, and only its POST deletes). The /api/rappel-delai handlers answer
// 303 to THIS page with a fragment (lib/rappel/landing.ts), so the token
// leaves the address bar and the reader is back on the comparator, at "Votre
// délai", reading what happened.
//
// THE ALERT CARD'S MECHANISM (lib/ui/react/AlertCapture): every outcome is
// rendered, hidden, and CSS :target reveals the one the fragment names. A
// fragment never reaches the server, so the page stays static and reads no
// searchParams (FW13).
//
// WHY NOT A PAGE OF ITS OWN (Queue Ruling 23, the byte probe): a new route
// adds its CSS chunk to the webpack runtime that EVERY route loads - measured
// +9 B on each, the 54 B calculator page included - and sharing the alert
// landings' stylesheet instead moved their page chunk by 1 B. A SERVER
// component here ships no JavaScript of its own: its words are HTML, and its
// rules live in the comparator's own stylesheet (a new stylesheet joined the
// CSS chunk every page loads), so only the comparator carries anything - its
// class names.

import { LANDING_STATES, landingFragment } from '@/lib/rappel/landing';
import { RAPPEL_COPY } from '@/lib/fr/rappel';
import styles from './comparateur.module.scss';

const OUTCOMES = [
  { state: LANDING_STATES.confirmed, copy: RAPPEL_COPY.outcomes.confirmed },
  { state: LANDING_STATES.expired, copy: RAPPEL_COPY.outcomes.expired },
  { state: LANDING_STATES.tooLate, copy: RAPPEL_COPY.outcomes.tooLate },
  { state: LANDING_STATES.unknown, copy: RAPPEL_COPY.outcomes.unknown },
  { state: LANDING_STATES.deleted, copy: RAPPEL_COPY.outcomes.deleted },
  { state: LANDING_STATES.deleteFailed, copy: RAPPEL_COPY.outcomes.deleteFailed },
] as const;

export function ReminderOutcomes(): React.ReactElement {
  return (
    <div className={styles.reminderOutcomes}>
      {OUTCOMES.map(({ state, copy }) => (
        // role="status" and tabIndex -1, as the alert card's: the browser
        // moves to the fragment's target, and a screen reader hears it.
        <div
          className={styles.reminderOutcome}
          data-rappel-outcome={state}
          id={landingFragment(state)}
          key={state}
          role="status"
          tabIndex={-1}
        >
          <p className={styles.reminderOutcomeHeading}>{copy.heading}</p>
          <p className={styles.reminderOutcomeBody}>{copy.body}</p>
        </div>
      ))}
    </div>
  );
}
