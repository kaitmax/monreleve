// web/lib/guides/mdx-components.tsx
//
// What MDX renders into. SPEC 9.5 names the kit: "a bordered summary block
// for rule summaries (reads as reference, not marketing); comparison tables
// with hairline rules only, no zebra; warning banners for the traps; an
// accordion for FAQ blocks".
//
// A MAP RATHER THAN FREEDOM, and that is the point of having one. An author
// writing raw <div className="..."> in an article would be inventing layout
// per article, which is how seven guides come to look like seven sites. The
// map gives every heading, paragraph and table one appearance, decided here.
//
// THE LINK IS THE LOAD-BEARING PIECE. Every internal href is resolved against
// the route registry and the guides directory AS IT RENDERS - and because
// articles render during static generation, an unresolvable link stops the
// build. A guide linking a slug one character off otherwise renders
// perfectly, 404s for readers, and leaves a hole in the mesh that nothing
// reports.
//
// NO 'use client' ANYWHERE IN THIS FILE. R136: content ships zero client
// JavaScript. The FAQ accordion is the same native <details> FW15 built for
// the calculator, for the same reason - the answers must be in the DOM for a
// crawler and for a reader with scripting off.

import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import type { ReactNode } from 'react';
import { DataGrid } from '@/lib/ui/react/DataGrid/DataGrid';
import { GuideInlineCta } from '@/lib/ui/react/GuideInlineCta/GuideInlineCta';
import type { Heading } from './headings';
import { assertResolves } from './links';
import styles from './mdx.module.scss';

/**
 * The article this map is rendering, so a failure can name it.
 *
 * Passed in rather than read from a context: a context would make the file
 * name optional at the call site, and the whole value of the message is that
 * it names the article.
 */
export interface MdxContext {
  readonly file: string;

  /**
   * The article's outline, from the same read the table of contents uses.
   *
   * THE IDS COME FROM HERE RATHER THAN FROM A SECOND SLUGIFY CALL. Both
   * consumers taking the same array is what makes it impossible for the
   * outline to link an anchor the document does not carry - the failure
   * that turns a table of contents into six links that do nothing.
   */
  readonly headings: readonly Heading[];
}

interface LinkProps {
  readonly href?: string;
  readonly children?: ReactNode;
}

interface BlockProps {
  readonly children?: ReactNode;
}

interface HeadingProps extends BlockProps {
  readonly id?: string;
}

/**
 * The map's type comes from next-mdx-remote rather than from mdx/types.
 *
 * @types/mdx is not installed and adding it would be a third dependency
 * for one type alias; the compiler this map is handed to already declares
 * exactly what it accepts, and taking the type from there means the two
 * cannot disagree.
 */
type ComponentMap = NonNullable<MDXRemoteProps['components']>;

export function mdxComponents(context: MdxContext): ComponentMap {
  /**
   * Headings are handed out in document order, which is the order the MDX
   * compiler renders them in.
   *
   * A COUNTER RATHER THAN A TEXT LOOKUP, because two sections may share a
   * name and headingsIn() has already disambiguated them by POSITION. A
   * lookup by text would give both the first one's id, which is invalid
   * HTML and makes the second entry in the outline unreachable.
   */
  let next = 0;
  const idFor = (): string | undefined => context.headings[next++]?.id;

  return {
    h2: ({ children }: HeadingProps) => (
      <h2 className={styles.h2} id={idFor()}>
        {children}
      </h2>
    ),

    h3: ({ children }: HeadingProps) => (
      <h3 className={styles.h3} id={idFor()}>
        {children}
      </h3>
    ),

    // Body-L 17/26, FD13's article measure. The prose column is capped at
    // 680 px by the layout, not here.
    p: ({ children }: BlockProps) => <p className={styles.p}>{children}</p>,

    ul: ({ children }: BlockProps) => <ul className={styles.list}>{children}</ul>,
    ol: ({ children }: BlockProps) => <ol className={styles.list}>{children}</ol>,
    li: ({ children }: BlockProps) => <li className={styles.item}>{children}</li>,

    /**
     * THE VALIDATING LINK. Internal hrefs resolve or the build stops.
     *
     * next/link is deliberately not used: lib/ui/react has a standing rule
     * against it (tests/unit/meta/no-next-link.test.ts) because a prefetching
     * router on a content site fetches pages nobody asked for. A guide is
     * plain HTML navigation.
     */
    a: ({ href, children }: LinkProps) => {
      const target = href ?? '';

      assertResolves(target, context.file);

      return (
        <a className={styles.link} href={target}>
          {children}
        </a>
      );
    },

    /**
     * SPEC 9.5's "bordered summary block for rule summaries". FD13 draws it
     * as the « EN BREF » card: a white card, an uppercase eyebrow, rows of
     * label and value.
     */
    Encadre: ({ titre, children }: BlockProps & { readonly titre: string }) => (
      <aside className={styles.summary} data-summary>
        <p className={styles.eyebrow}>{titre}</p>
        {children}
      </aside>
    ),

    /**
     * SPEC 9.5's traps. FD13: amber is the ACCENT and the icon; the text
     * stays at text-primary, because warning-coloured body copy is the thing
     * nobody can read.
     */
    Avertissement: ({ children }: BlockProps) => (
      <aside className={styles.warning} data-warning role="note">
        {children}
      </aside>
    ),

    /**
     * SPEC 9.5's comparison tables: "hairline rules only, no zebra". FW9's
     * DataGrid already draws exactly that, so the map hands tables to it
     * rather than styling a second one here.
     */
    DataGrid,

    /**
     * FD13's inline calculator card, FW18b, and the one new component this
     * task added.
     *
     * NAMED IN FRENCH like Encadre and Avertissement, because an author
     * writing a French article types it in the middle of French prose.
     * DataGrid keeps its English name because it is FW9's product component
     * handed through unchanged; this one exists only for articles.
     *
     * IT TAKES NO PROPS, and the map passes none. SPEC 9.5 puts exactly one
     * of these in each guide, pointing at the calculator; a `titre` or
     * `href` prop here is how seven articles grow seven offers.
     */
    CarteCalculateur: GuideInlineCta,
  };
}
