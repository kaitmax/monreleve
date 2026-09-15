// web/lib/guides/mdx-options.ts
//
// HOW AN ARTICLE IS COMPILED. One object, because the page and the test that
// proves the page works must not be able to disagree about it.
//
// blockJS: false IS THE LOAD-BEARING LINE, and it is a correction rather than
// a preference. next-mdx-remote@6 defaults it to TRUE, and its own
// documentation says what that does: "patterns like {variable} or {func()}
// will be removed while preserving JSX components and standard Markdown" -
// and, in the plugin itself, "Remove JavaScript expressions from JSX attribute
// values".
//
// R147 REQUIRES THE OPPOSITE. "Every threshold, cap, basis and rate that
// appears in guide prose comes from RuleSet through a component or an MDX
// EXPRESSION." Under the default, an author writing {fiscal} gets nothing at
// all. Measured, not reasoned - this is the RED that
// tests/unit/guides/scope.test.tsx captured before this line existed:
//
//   <p>Le plafond est de  du temps de travail annuel.</p>
//   <aside><p>Un contenu.</p></aside>
//
// The figure is gone, the sentence closes over the hole, the JSX prop is gone
// with it, and NOTHING FAILS: the build succeeds, the frontmatter parses, the
// claims resolve, the typed-number scan finds nothing because there is no
// typed number, and the next baseline certifies the hole forever. The planted
// case stays in that test as a permanent assertion.
//
// WHAT TURNING IT OFF ACTUALLY ALLOWS, stated rather than assumed: JavaScript
// in an MDX file, evaluated at BUILD, in the process that generates the site.
// The content is first-party - files in content/guides, added by commit,
// reviewed like code - so the trust boundary is the repository, the same one
// every other build-time file in it already sits inside. blockDangerousJS is
// left at its default TRUE, so eval, Function, process, require and the rest
// are still refused; that is defence in depth rather than the guard being
// relied on, and it is asserted rather than assumed.
//
// NO REMARK OR REHYPE PLUGIN. Heading ids come from lib/guides/headings.ts
// rather than rehype-slug, deliberately and for the reason that file states:
// an anchor is a URL, and one produced by a dependency is a URL whose shape
// lives in somebody else's release notes.

import type { MDXRemoteProps } from 'next-mdx-remote/rsc';

type Options = NonNullable<MDXRemoteProps['options']>;

/**
 * The compile options every article shares, minus the scope.
 *
 * The scope is per-render because it resolves a tax year; everything here is
 * a property of how this product compiles MDX at all.
 */
export const MDX_OPTIONS = {
  // The registry has already read the frontmatter with gray-matter and
  // validated it; re-parsing it here would be a second reader of one file.
  parseFrontmatter: false,

  // See above. Without this, R147's mechanism deletes the figures it exists
  // to deliver.
  blockJS: false,

  // Left at the library default, and named rather than omitted so that
  // turning blockJS off does not read as turning both off.
  blockDangerousJS: true,
} as const satisfies Options;
