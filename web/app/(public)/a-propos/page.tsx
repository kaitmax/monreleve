// web/app/(public)/a-propos/page.tsx
//
// SPEC 9.1's /a-propos, and todo.md gives it one subject: "who reviewed the
// rules". The honest answer is nobody, so that is the first section.
//
// R160's DISCIPLINE AT PAGE LENGTH. Every guide's chip reads "Relecture
// experte : en attente" because naming the team implied a review that has not
// happened. This page is that sentence with its reasons, and todo.md's
// TODO-REVIEWER placeholder is what it replaces - a placeholder is not
// something a reader can read.
//
// NO FOUNDER STORY, NO MISSION STATEMENT, NO TEAM. A product whose whole
// argument is that it claims no more than its record supports cannot open
// with a paragraph about a journey.
//
// IT REUSES /sources' STYLESHEET rather than growing a second one. The two
// pages are the same shape - a lead, sections of prose, a list of headed
// entries - and a second stylesheet would be two sets of decisions to keep in
// step for one appearance. A third page wanting it is the moment to extract
// one, not this one.

import type { Metadata } from 'next';
import { A_PROPOS_COPY as COPY } from '@/lib/fr/a-propos';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from '../sources/sources.module.scss';

export const metadata: Metadata = {
  title: COPY.title,
  description: COPY.description,
};

export default function AProposPage() {
  return (
    <main className={styles.page}>
      <Container width="article">
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.lead}>{COPY.lead}</p>

        {/*
          FIRST, BECAUSE IT IS THE ANSWER TO THE QUESTION THE PAGE IS FOR. A
          reader arrives here asking who is behind this and whether anyone
          qualified has checked it. Burying that under a method section would
          be answering a question they did not ask.
        */}
        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.reviewHeading}</h2>
          <p className={styles.prose}>{COPY.reviewBody}</p>
          <p className={styles.prose}>{COPY.reviewConsequence}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>{COPY.methodHeading}</h2>
          <p className={styles.prose}>{COPY.methodIntro}</p>

          <dl className={styles.readings}>
            {COPY.method.map((step) => (
              <div className={styles.reading} key={step.heading}>
                <dt className={styles.readingHeading}>{step.heading}</dt>
                <dd className={styles.readingBody}>{step.body}</dd>
              </div>
            ))}
          </dl>

          {/*
            THE REFUSAL IS THE POINT OF THE THREE STEPS, so it closes them
            rather than opening its own section: the method is only worth
            stating because of what it forbids.
          */}
          <p className={styles.prose}>{COPY.methodRefusal}</p>

          <p className={styles.prose}>
            <a href="/sources">{COPY.sourcesLink}</a>
          </p>
        </section>
      </Container>
    </main>
  );
}
