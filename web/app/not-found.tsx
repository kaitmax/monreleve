// web/app/not-found.tsx
//
// The 404, and it renders PublicShell ITSELF rather than inheriting it.
//
// WHY IT HAS TO. app/(public)/layout.tsx supplies the shell to everything in
// that route group, but a 404 is by definition a URL that matched no segment,
// so Next renders the ROOT not-found - outside the group, with no group layout
// around it. A not-found.tsx placed inside (public) would only ever be reached
// by a notFound() call from a page in that group, which is not the case this
// page exists for. So the shell is composed here, once, deliberately.
//
// NO ILLUSTRATION, NO "OUPS", LEFT-ALIGNED. The prompt is explicit and it is
// right: a reader who followed a stale link or mistyped an address is looking
// for the way out, and a centred cartoon between them and it is a cost with no
// benefit. One sentence saying what probably happened, two links that go
// somewhere useful.
//
// PLAIN ANCHORS, matching PublicShell's header, footer and CTA, which use
// <a href> throughout rather than next/link. Nothing in the SPEC or the code
// records WHY - raised as a question in the report rather than answered here,
// because a page that reached for next/link on its own would make the public
// surface inconsistent in a way no ruling asked for.
//
// The links point at the calculator and the home page. The calculator is
// FW11, so that href is currently a 404 too - as are every nav and footer link
// the shell already renders. Increment 5's route registry is where that stops
// being spread across files.

import { NOT_FOUND_COPY } from '@/lib/fr';
import { Container } from '@/lib/ui/react/Container/Container';
import { guideNavLinks } from '@/lib/guides/registry';
import { PublicShell } from '@/lib/ui/react/PublicShell/PublicShell';
import styles from './not-found.module.scss';

export default function NotFound() {
  return (
    <PublicShell guideLinks={guideNavLinks()}>
      <main className={styles.page}>
        <Container width="article">
          <h1 className={styles.title}>{NOT_FOUND_COPY.heading}</h1>
          <p className={styles.body}>{NOT_FOUND_COPY.body}</p>

          <div className={styles.links}>
            <a className={styles.link} href={NOT_FOUND_COPY.calculatorHref}>
              {NOT_FOUND_COPY.calculator}
            </a>
            <a className={styles.link} href={NOT_FOUND_COPY.homeHref}>
              {NOT_FOUND_COPY.home}
            </a>
          </div>
        </Container>
      </main>
    </PublicShell>
  );
}
