// web/lib/ui/react/Faq/Faq.tsx
//
// The inline FAQ. SPEC 14 puts one on the calculator; FW16 will want the same
// component in every guide, which is why it takes its questions as a prop
// rather than importing them.
//
// A SERVER COMPONENT, AND NATIVE <details>. Three reasons, in the order they
// decided it:
//
//   THE ANSWER MUST BE IN THE DOM WHILE CLOSED. Increment 3 generates a
//   FAQPage from the same lib/fr source this renders, and a structured claim
//   a reader cannot see is cloaking. <details> keeps its content in the
//   document at all times; a React disclosure that returns null while closed
//   - which is exactly what the calculator's advanced options do, correctly,
//   for form fields nobody asked for - would publish answers that are not
//   there.
//
//   NO CLIENT JAVASCRIPT. The calculator has about 4,4 KiB of GATE A
//   headroom (R136). An accordion is the least defensible thing to spend it
//   on when the platform ships one.
//
//   KEYBOARD AND SCREEN READER SUPPORT WE DID NOT WRITE. <summary> is
//   focusable, toggles on Enter and Space, and reports its expanded state
//   without a single aria attribute from us. The version with a button, an
//   aria-expanded and an aria-controls is the version with a bug in it.
//
// increment 5's accordion_opened event listens for the native `toggle` event,
// which is another thing this shape gives away free.

import type { FaqEntry } from '@/lib/fr/faq';
import styles from './Faq.module.scss';

export interface FaqProps {
  /** The section heading. French, so it arrives from lib/fr. */
  readonly heading: string;
  /** Already resolved against the year's rules - see lib/fr/faq.ts. */
  readonly entries: readonly FaqEntry[];
}

export function Faq({ heading, entries }: FaqProps) {
  return (
    <section className={styles.faq} data-faq>
      <h2 className={styles.heading}>{heading}</h2>

      {entries.map((entry) => (
        // id on the <details> so a link can address one question - a FAQ
        // answer is the kind of thing a support reply wants to point at.
        <details key={entry.id} id={entry.id} className={styles.entry}>
          <summary className={styles.question}>{entry.question}</summary>
          <p className={styles.answer}>{entry.answer}</p>
        </details>
      ))}
    </section>
  );
}
