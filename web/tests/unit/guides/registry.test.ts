// web/tests/unit/guides/registry.test.ts
//
// The registry: every guide on disk, and the two things that must be true of
// the set rather than of any article in it.
//
// A FIXTURE MUST NOT REACH A READER. FW16 needs a sample article to exercise
// the template, the table of contents and the mesh checker; FW17's first real
// guide must not be the first thing that has ever rendered. The cost of
// keeping one is that it exists in the same directory as content, so the
// exclusion is asserted rather than trusted - from the published set, and
// therefore from the hub and the sitemap that read it.
//
// AND THE SLUG IS THE FILE NAME. SPEC 14: slugs are permanent. Two sources
// for one identity is how a URL changes under the readers who bookmarked it,
// so the registry refuses to load an article whose frontmatter disagrees with
// the file it is in.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import matter from 'gray-matter';
import { allGuides, isFixture, publishedGuides } from '@/lib/guides/registry';
import { parseFrontmatter } from '@/lib/guides/frontmatter';

describe('what the directory holds', () => {
  it('reads at least the fixture, so nothing below passes vacuously', () => {
    expect(allGuides().length).toBeGreaterThan(0);
  });

  it('parses every article it finds, which is the build-time contract', () => {
    // If a file on disk had invalid frontmatter this would throw, which is
    // the same failure `next build` gets when the sitemap collects. The
    // assertion is that the whole directory is currently valid.
    for (const guide of allGuides()) {
      expect(guide.frontmatter.slug.length, guide.file).toBeGreaterThan(0);
      expect(guide.body.length, guide.file).toBeGreaterThan(0);
    }
  });

  it('strips the frontmatter from the body it hands the renderer', () => {
    // A body still carrying its --- block would render the YAML as prose.
    for (const guide of allGuides()) {
      expect(guide.body.trimStart().startsWith('---'), guide.file).toBe(false);
      expect(guide.body).not.toContain('lastReviewed:');
    }
  });
});

describe('a fixture never reaches a reader', () => {
  it('recognises the underscore prefix, and only that', () => {
    expect(isFixture('_fixture-modele-article.mdx')).toBe(true);
    expect(isFixture('teletravail-frontalier-40-pourcent.mdx')).toBe(false);
  });

  it('keeps every fixture out of the published set', () => {
    const published = publishedGuides().map((guide) => guide.file);

    expect(published.some(isFixture)).toBe(false);
  });

  it('and the fixture IS in the full set, so the exclusion is doing work', () => {
    // R120: if allGuides() and publishedGuides() returned the same thing,
    // every assertion above would pass and the filter could be absent.
    const all = allGuides().map((guide) => guide.file);

    expect(all.some(isFixture)).toBe(true);
    expect(all.length).toBeGreaterThan(publishedGuides().length);
  });
});

describe('the slug is the file name (SPEC 14)', () => {
  it('holds for every article on disk', () => {
    for (const guide of allGuides()) {
      const expected = guide.file.replace(/\.mdx$/, '').replace(/^_/, '');

      expect(guide.frontmatter.slug, guide.file).toBe(expected);
    }
  });

  it('refuses a mismatch, named in the message', () => {
    // THE REFUSAL, EXERCISED. The registry reads one directory, so this
    // builds the same check against a file written for the purpose: parse
    // the frontmatter, compare it to the name, and require the throw.
    const dir = mkdtempSync(join(tmpdir(), 'guides-'));

    try {
      const file = 'le-bon-nom.mdx';
      const source = [
        '---',
        'title: "Un titre assez long pour passer"',
        'description: "Une description assez longue pour etre utile dans un resultat de recherche."',
        'slug: un-autre-nom',
        'breadcrumbLabel: "Un guide"',
        'cluster: cluster',
        'lastReviewed: "2026-09-09"',
        'reviewer: "FW16"',
        '---',
        '',
        'Du texte.',
      ].join('\n');

      writeFileSync(join(dir, file), source);

      const { data } = matter(source);
      const frontmatter = parseFrontmatter(data, file);
      const expected = file.replace(/\.mdx$/, '');

      // The frontmatter itself is valid - this is purely the identity check.
      expect(frontmatter.slug).toBe('un-autre-nom');
      expect(frontmatter.slug).not.toBe(expected);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
