// web/app/(public)/page.tsx
//
// A PLACEHOLDER home. FW20 builds the real one; this exists so the public
// shell is visible and so "/" is not a blank route while the legal pages are
// built around it.
//
// It owns the h1, which PublicShell deliberately does not emit - one per page,
// and the page is the only thing that knows what its heading is.
//
// THE TABULAR FIGURE STAYS, and it is not decoration. It is FW1 AC1's
// artifact: the proof that Inter is reaching a page with tabular numerals ON,
// which only a real browser can answer and which e2e/home.spec.ts asserts
// three ways - the feature settings, the variant property, and that the woff2
// actually arrived with a 200 rather than the stack merely being declared.
//
// It could have moved to the workbench, and that would have been worse: the
// workbench is a dev route, and the claim worth holding is about a PUBLIC
// page. FW20 should keep an equivalent assertion when it replaces this file.

import type { Metadata } from 'next';
import { HOME_COPY } from '@/lib/fr';
import { Container } from '@/lib/ui/react/Container/Container';
import styles from './home.module.scss';
import { currentTaxYear } from '@/lib/content/tax-year';
import { guideScope } from '@/lib/guides/scope';

// The title stays the layout's default - the bare product name for "/" -
// while the description is this page's own. A site-wide default description
// would apply to any page that forgot one, which is how every page ends up
// with the same snippet in a search result.
//
// generateMetadata RATHER THAN A CONSTANT, since FW18b extended R147 to
// lib/fr. The description names both thresholds and no longer types either:
// they arrive formatted, from the year's RuleSet, the same way the
// calculator's has since FW11. A static export cannot call anything, so the
// shape of the export is what the rule decides here.
//
// guideScope RATHER THAN A THIRD ceiling() HELPER. It returns the year's
// figures already formatted, with the same "integer takes no decimal" rule
// the calculator applies - and a third private copy of a formatting decision
// is the duplication R147 exists to refuse, one layer down.
export function generateMetadata(): Metadata {
  const { fiscal, social } = guideScope(currentTaxYear());

  return { description: HOME_COPY.description(fiscal, social) };
}

// FW1 AC1's TABULAR-NUMERAL PROOF MOVED TO /dev/composants, and it was
// visible here. The home page rendered a bare "1 234,5" between the intro and
// the footer - a test artifact on the product's front door, shipped since FW1
// and photographed by every accueil baseline since. FW20 found it by cropping
// one and reading it (R135).
//
// The proof still exists and still runs: AC1 asks that tabular numerals be
// verified ON A FIGURE, and the workbench is where component proofs belong.
// Both suites already visit it.

export default function HomePage() {
  return (
    <main className={styles.page}>
      <Container width="public">
        <h1 className={styles.title}>{HOME_COPY.heading}</h1>
        <p className={styles.intro}>{HOME_COPY.intro}</p>

        {/*
          THE PAGE'S ONE JOB: route to the calculator or the guides. todo.md
          says "no hero theatre", and two equal doors is what that leaves -
          neither recommended, because a reader who does not yet know the
          rules cannot use the calculator and should not be pushed at it.
        */}
        <ul className={styles.doors}>
          {HOME_COPY.doors.map((door) => (
            <li className={styles.door} key={door.href}>
              <p className={styles.doorLabel}>
                <a href={door.href}>{door.label}</a>
              </p>
              <p className={styles.doorBody}>{door.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </main>
  );
}
