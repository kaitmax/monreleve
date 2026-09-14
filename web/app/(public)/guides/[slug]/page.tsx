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
import { Faq } from '@/lib/ui/react/Faq/Faq';
import { GuideCta } from '@/lib/ui/react/GuideCta/GuideCta';
import { JsonLd } from '@/lib/ui/react/JsonLd/JsonLd';
import { TableOfContents } from '@/lib/ui/react/TableOfContents/TableOfContents';
import { GUIDES_PATH, allGuides, guideBySlug, publishedGuides } from '@/lib/guides/registry';
import { faqPageLd } from '@/lib/content/jsonld';
import { anchorFor, headingsIn } from '@/lib/guides/headings';
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

  // FD13's GUIDES LIES list, resolved from the frontmatter's `related`.
  // A slug naming no article is dropped rather than rendered as a dead
  // link - and the mesh checker refuses it separately, which is where
  // that mistake should be reported.
  // ONE SOURCE, TWO CONSUMERS - the FW15 pattern, applied to content.
  //
  // The accordion a reader opens and the FAQPage a crawler reads are built
  // from THIS array. A claim in structured data that is not visible on the
  // page is cloaking; the only way to be sure the two agree is for there
  // to be one of them.
  //
  // The id is derived rather than authored: an author writing ids in
  // frontmatter would be writing anchors, which are URLs, by hand.
  const faq = frontmatter.faq.map((entry) => ({
    id: anchorFor(entry.question),
    question: entry.question,
    answer: entry.answer,
  }));

  const related = frontmatter.related
    .map((slug) => guideBySlug(slug))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);

  // COMPILED HERE, AT BUILD. compileMDX runs inside this server component and
  // the route is statically generated, so the output is HTML in a file.
  const { content } = await compileMDX({
    source: body,
    components: mdxComponents({ file, headings }),
    options: { parseFrontmatter: false },
  });

  return (
    <main className={styles.page}>
      {/*
        SPEC 14: FAQPage on the guides too. Generated from the same array
        the accordion renders, which is what makes it a description of the
        page rather than a claim about it (FW15 established the rule and
        lib/content/jsonld.ts enforces the property allow-list).

        Omitted entirely when an article declares no FAQ - an empty
        FAQPage is structured data about nothing.
      */}
      {faq.length === 0 ? null : <JsonLd data={faqPageLd(faq)} />}

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
            <Container width="article">
              {/*
                MARKED, so a test can ask for the ARTICLE's headings rather
                than every heading in the column. The closing card carries
                an h2 of its own, and the outline must be compared against
                what the AUTHOR wrote - which is what the table of contents
                indexes.
              */}
              <div data-article-body>{content}</div>

              {/*
                SPEC 14's FAQPage, on the guides as well as the calculator.
                Rendered before the closing card because it answers the
                article rather than following it.
              */}
              {faq.length === 0 ? null : (
                <Faq heading={GUIDES_COPY.faqHeading} entries={faq} />
              )}

              {/*
                SPEC 9.5's second calculator link, and FD13's "this exact
                card ends every guide". It is the TEMPLATE's - an author
                supplies the inline one - which is why the mesh checker
                asks the body for one link rather than two.
              */}
              <GuideCta />

              {/*
                FD13's article footer. SPEC 9.5: "every guide carries a
                derniere verification date and links /sources in its
                footer". The date is in the chips at the head; this is the
                link, and it is the template's rather than each author's
                so that no guide can ship without it.
              */}
              <footer className={styles.footer} data-guide-footer>
                <p className={styles.sources}>
                  {GUIDES_COPY.sourcesNote}{' '}
                  <a href="/sources">{GUIDES_COPY.sourcesLink}</a>
                </p>

                {related.length === 0 ? null : (
                  <nav aria-label={GUIDES_COPY.relatedHeading} data-related>
                    <p className={styles.relatedHeading}>{GUIDES_COPY.relatedHeading}</p>
                    <ul className={styles.relatedList}>
                      {related.map((entry) => (
                        <li key={entry.frontmatter.slug}>
                          <a href={`${GUIDES_PATH}/${entry.frontmatter.slug}`}>
                            {entry.frontmatter.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </footer>
            </Container>
          </div>
        </article>
      </Container>
    </main>
  );
}
