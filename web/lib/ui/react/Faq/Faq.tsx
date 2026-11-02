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
//
// FW-HOME-A2 (R717) ADDS THREE OPTIONAL THINGS, each absent by default so the
// calculator's FAQ renders exactly as before:
//
//   `open` on an entry - the home page opens its first question.
//   `pair` on an entry - an Avant / Après answer, two cards side by side,
//     rendered INSTEAD of the answer paragraph. The entry still carries
//     `answer`, the same two sentences as plain text, so anything that reads
//     answers as text (a FAQPage) reads what the cards say.
//   `layout="split"` - the heading beside the questions from the md
//     breakpoint, the home page's arrangement.
//
// FW-COMPARATEUR-SURFACE ADDS A FOURTH, absent by default the same way:
//
//   `link` on an entry - the answer paragraph ends on one link, after the
//     plain-text answer. No style of its own: the base layer styles every
//     anchor (R173).

import type { FaqEntry } from '@/lib/fr/faq';
import styles from './Faq.module.scss';

export interface FaqProps {
  /** The section heading. French, so it arrives from lib/fr. */
  readonly heading: string;
  /** Already resolved against the year's rules - see lib/fr/faq.ts. */
  readonly entries: readonly FaqEntry[];
  /** 'stacked' (the default) puts the heading above; 'split' beside. */
  readonly layout?: 'stacked' | 'split';
}

function Entry({ entry }: { readonly entry: FaqEntry }) {
  return (
    // id on the <details> so a link can address one question - a FAQ
    // answer is the kind of thing a support reply wants to point at.
    <details id={entry.id} className={styles.entry} open={entry.open === true ? true : undefined}>
      <summary className={styles.question}>{entry.question}</summary>
      {entry.pair === undefined ? (
        <p className={styles.answer}>
          {entry.answer}
          {entry.link === undefined ? null : (
            <>
              {' '}
              <a href={entry.link.href}>{entry.link.text}</a>
            </>
          )}
        </p>
      ) : (
        <div className={styles.pair}>
          <div className={styles.before}>
            <p className={styles.pairLabel}>{entry.pair.before.label}</p>
            <p className={styles.pairBody}>{entry.pair.before.body}</p>
          </div>
          <div className={styles.after}>
            <p className={styles.pairLabel}>{entry.pair.after.label}</p>
            <p className={styles.pairBody}>{entry.pair.after.body}</p>
          </div>
        </div>
      )}
    </details>
  );
}

export function Faq({ heading, entries, layout = 'stacked' }: FaqProps) {
  if (layout === 'split') {
    return (
      <section className={styles.split} data-faq>
        <h2 className={styles.heading}>{heading}</h2>
        <div className={styles.entries}>
          {entries.map((entry) => (
            <Entry entry={entry} key={entry.id} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.faq} data-faq>
      <h2 className={styles.heading}>{heading}</h2>

      {entries.map((entry) => (
        <Entry entry={entry} key={entry.id} />
      ))}
    </section>
  );
}
