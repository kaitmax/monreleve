// web/lib/ui/react/TableOfContents/TableOfContents.tsx
//
// FD13 section 3: the sticky table of contents, 280 px, stuck 32 px from the
// top as the page scrolls.
//
// A SERVER COMPONENT WITH NO ACTIVE-ITEM HIGHLIGHT, AND THAT IS A DECISION
// RATHER THAN AN OMISSION. FD13 marks the current section with a 3 px brand
// pill on its left edge. Knowing which section is current means watching the
// scroll position - an IntersectionObserver, an effect, a piece of state -
// which is client JavaScript on a CONTENT page.
//
// R136 says content ships zero client JavaScript, and the prompt put the
// choice plainly: justify the bytes or ship without the highlight and say so.
// The bytes are not justifiable here. What the highlight buys is knowing
// where you are in a document you are already looking at; what it costs is a
// script, a hydration boundary and a scroll listener on every guide, on a
// page whose entire value is that it loads instantly and works with
// scripting off. The pill is drawn for the ANCHOR THE READER CLICKED - see
// the stylesheet's :target rule, which is CSS doing the same job for the case
// that matters most.
//
// WHY IT IS A LIST OF LINKS AND NOT A NAV OF BUTTONS: a fragment link works
// with no JavaScript, is copyable, and lands in history. Every alternative
// needs a script to do what an <a href="#..."> already does.

import type { Heading } from '@/lib/guides/headings';
import styles from './TableOfContents.module.scss';

export interface TableOfContentsProps {
  /** The section heading, from lib/fr. */
  readonly label: string;
  /** Taken from the MDX in the same pass that gave the headings their ids. */
  readonly headings: readonly Heading[];
}

export function TableOfContents({ label, headings }: TableOfContentsProps) {
  // An article with no sections gets no outline rather than an empty card.
  if (headings.length === 0) return null;

  return (
    <nav className={styles.toc} aria-label={label} data-toc>
      <p className={styles.label}>{label}</p>

      <ol className={styles.list}>
        {headings.map((heading) => (
          <li key={heading.id} className={styles.item} data-depth={heading.depth}>
            <a className={styles.link} href={`#${heading.id}`}>
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
