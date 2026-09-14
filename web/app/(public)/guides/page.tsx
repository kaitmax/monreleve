// web/app/(public)/guides/page.tsx
//
// The hub. SPEC 9.5's launch content is seven articles and this is the page
// that holds them together.
//
// GENERATED FROM THE REGISTRY, WHICH IS THE POINT: "a guide cannot exist and
// be absent from the hub" is not a rule somebody follows, it is a consequence
// of reading the same directory the router reads. A hand-written list would
// be one entry behind after FW18 and the failure would be silent - the
// article exists, nothing links to it, and it is invisible to a crawler that
// reaches the site through this page.
//
// THE PILLAR COMES FIRST, THEN ITS CLUSTERS, THEN THE CANTON PAGES. That is
// SPEC 9.5's own ordering of the launch content, and it is the shape of the
// mesh: the pillar is the definitive page, the clusters hang off it, the
// canton page is long-tail.
//
// /guides STAYS `planned` IN THE ROUTE REGISTRY UNTIL IT HAS CONTENT. The
// route exists - the breadcrumb on every article points at it, and the mesh
// checker needs a hub to check against - but with no published guides it
// would be an empty page in the sitemap, which is the "sitemap of 404s"
// problem one level down: not a broken link, a page that tells a crawler
// nothing. FW17 flips the flag when the first article lands.

import type { Metadata } from 'next';
import { GUIDES_COPY } from '@/lib/fr/guides';
import { formatDate } from '@/lib/ui/core';
import { Container } from '@/lib/ui/react/Container/Container';
import { GUIDES_PATH, publishedGuides } from '@/lib/guides/registry';
import type { Cluster } from '@/lib/guides/frontmatter';
import styles from './hub.module.scss';

export const metadata: Metadata = {
  title: GUIDES_COPY.hubTitle,
  description: GUIDES_COPY.hubDescription,
};

/** SPEC 9.5's order: the definitive page, what hangs off it, the long tail. */
const ORDER: readonly Cluster[] = ['pillar', 'cluster', 'canton'];

export default function GuidesHubPage() {
  const guides = publishedGuides();

  return (
    <main className={styles.page}>
      <Container width="narrow">
        <h1 className={styles.title}>{GUIDES_COPY.hubTitle}</h1>
        <p className={styles.intro}>{GUIDES_COPY.hubIntro}</p>

        {ORDER.map((cluster) => {
          const inCluster = guides.filter(
            (guide) => guide.frontmatter.cluster === cluster,
          );

          // An empty group renders nothing rather than an empty heading.
          // FW16 ships no content, so today every group is empty and this
          // page is its own intro - which is why the route is not in the
          // sitemap yet.
          if (inCluster.length === 0) return null;

          return (
            <section key={cluster} className={styles.group} data-group={cluster}>
              <h2 className={styles.groupTitle}>{GUIDES_COPY.groupTitle[cluster]}</h2>

              <ul className={styles.list}>
                {inCluster.map((guide) => (
                  <li key={guide.frontmatter.slug} className={styles.entry} data-guide-entry>
                    <a
                      className={styles.entryLink}
                      href={`${GUIDES_PATH}/${guide.frontmatter.slug}`}
                    >
                      {guide.frontmatter.title}
                    </a>

                    <p className={styles.entryDescription}>{guide.frontmatter.description}</p>

                    {/*
                      SPEC 9.5: every guide carries a derniere verification
                      date. It is on the article and it is here too, because
                      the hub is where a returning reader decides whether
                      anything has been checked since they last looked.
                    */}
                    <p className={styles.entryDate}>
                      {GUIDES_COPY.reviewedOn(formatDate(guide.frontmatter.lastReviewed))}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </Container>
    </main>
  );
}
