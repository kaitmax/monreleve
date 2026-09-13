// web/app/(public)/guides/[slug]/page.tsx
//
// The article template. One file renders seven guides (FW17, FW18) and the
// fixture, which is why every element in FD13 is reusable and none of it is
// per-article.
//
// A SERVER COMPONENT, AND STATICALLY GENERATED. generateStaticParams lists
// every article at build, so the MDX is compiled once, into HTML, and no
// compiler reaches a browser. R136: content ships zero client JavaScript.
//
// AND THAT IS WHAT MAKES THE LINK VALIDATION A BUILD FAILURE. The MDX map's
// <a> resolves every internal href as it renders; rendering happens during
// generateStaticParams' static pass; so a guide linking a slug one character
// off stops the build rather than 404ing for readers.
//
// THE SECTION ORDER IS FD13's AND R137 ASSERTS IT AS A SEQUENCE:
// breadcrumb, h1, the three metadata chips, a rule, then the two-column body.
// Order is a property of the page rather than of anything on it - FW13 shipped
// a share row above the notice explaining it, with every element individually
// tested and correct.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { compileMDX } from 'next-mdx-remote/rsc';
import { CalendarCheck, Clock, UserCheck } from 'lucide-react';
import { GUIDES_COPY } from '@/lib/fr/guides';
import { canonicalsAvailable } from '@/lib/content/site';
import { formatDate } from '@/lib/ui/core';
import { Container } from '@/lib/ui/react/Container/Container';
import { TableOfContents } from '@/lib/ui/react/TableOfContents/TableOfContents';
import { allGuides, guideBySlug, publishedGuides } from '@/lib/guides/registry';
import { headingsIn } from '@/lib/guides/headings';
import { mdxComponents } from '@/lib/guides/mdx-components';
import { readingMinutes } from '@/lib/guides/reading-time';
import styles from './guide.module.scss';

/** FD13: Lucide at 14 in the chips, 1.75 stroke like everywhere else. */
const CHIP_ICON = 14;
const STROKE = 1.75;

interface RouteParams {
  readonly params: Promise<{ readonly slug: string }>;
}

/**
 * Every article, at build.
 *
 * FIXTURES INCLUDED, and deliberately: the fixture is what the template's
 * tests and baselines render, so it has to be a real route. It is excluded
 * from the sitemap, the hub and the mesh checker's obligations - the places
 * that decide what a READER or a CRAWLER reaches - rather than from the
 * router, which is what decides whether it can be tested at all.
 */
export function generateStaticParams(): { slug: string }[] {
  return allGuides().map((guide) => ({ slug: guide.frontmatter.slug }));
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const guide = guideBySlug(slug);

  if (guide === undefined) return {};

  const { frontmatter } = guide;

  return {
    title: frontmatter.title,
    description: frontmatter.description,

    // R81 governs every absolute claim: with no configured origin there is
    // no canonical, and a fixture is never indexed whatever the origin.
    ...(canonicalsAvailable() && !isFixtureSlug(slug)
      ? {}
      : { robots: { index: false, follow: true } }),
  };
}

/** A fixture is noindex whatever else is true. */
const isFixtureSlug = (slug: string): boolean =>
  !publishedGuides().some((guide) => guide.frontmatter.slug === slug);

export default async function GuidePage({ params }: RouteParams) {
  const { slug } = await params;
  const guide = guideBySlug(slug);

  if (guide === undefined) notFound();

  const { frontmatter, body, file } = guide;

  // ONE READ OF THE HEADINGS, USED TWICE. The outline and the ids on the
  // rendered headings come from the same call, so the table of contents
  // cannot link an anchor the document does not carry. Taking the outline
  // from the COMPILED html instead would mean the two agree only if two
  // passes agree with each other.
  const headings = headingsIn(body);

  // COMPILED HERE, AT BUILD. compileMDX runs inside this server component and
  // the route is statically generated, so the output is HTML in a file.
  const { content } = await compileMDX({
    source: body,
    components: mdxComponents({ file, headings }),
    options: { parseFrontmatter: false },
  });

  return (
    <main className={styles.page}>
      <Container width="public">
        <article className={styles.article}>
          {/* FD13's head, placed in the prose column by the grid. */}
          <header className={styles.head}>
          {/*
            FD13 section 2: the article head, aligned with the prose column.
            The order below is asserted by R137 - see
            tests/unit/pages/guide-section-order.test.tsx.
          */}
          <nav aria-label={GUIDES_COPY.breadcrumbLabel} data-breadcrumb>
            <ol className={styles.breadcrumb}>
              <li>
                <a href="/guides">{GUIDES_COPY.hubTitle}</a>
              </li>
              <li aria-current="page">{frontmatter.title}</li>
            </ol>
          </nav>

          {/* R88's hero pair, 40/48/700. One h1 per page. */}
          <h1 className={styles.title}>{frontmatter.title}</h1>

          {/*
            FD13's three chips, and the brief is explicit about the order:
            THE VERIFICATION DATE COMES FIRST. "On a subject whose rules
            change annually, when this was last checked matters more than who
            wrote it."
          */}
          <ul className={styles.chips} data-chips>
            <li className={styles.chip}>
              <CalendarCheck size={CHIP_ICON} strokeWidth={STROKE} aria-hidden="true" />
              <span>{GUIDES_COPY.reviewedOn(formatDate(frontmatter.lastReviewed))}</span>
            </li>
            <li className={styles.chip}>
              <UserCheck size={CHIP_ICON} strokeWidth={STROKE} aria-hidden="true" />
              <span>{GUIDES_COPY.reviewedBy(frontmatter.reviewer)}</span>
            </li>
            <li className={styles.chip}>
              <Clock size={CHIP_ICON} strokeWidth={STROKE} aria-hidden="true" />
              {/* COMPUTED, never authored - FD13. See lib/guides/reading-time.ts. */}
              <span>{GUIDES_COPY.readingTime(readingMinutes(body))}</span>
            </li>
          </ul>

          <hr className={styles.rule} />
          </header>

          {/*
            FD13 section 3: two columns at 1440, one below. The table of
            contents column is built in increment 3; the grid that holds it
            is here because the prose measure depends on it.
          */}
          <div className={styles.tocColumn} data-toc-column>
            <TableOfContents label={GUIDES_COPY.tocLabel} headings={headings} />
          </div>

          <div className={styles.prose} data-prose>
            <Container width="article">{content}</Container>
          </div>
        </article>
      </Container>
    </main>
  );
}
