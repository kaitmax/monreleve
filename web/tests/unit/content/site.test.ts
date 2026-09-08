// web/tests/unit/content/site.test.ts
//
// The absolute site origin, which FW10 needs in three places - metadataBase,
// the sitemap's absolute URLs, and robots.txt's sitemap reference - and which
// no document decides. The domain is an open question gated at Checkpoint C
// (SPEC section 22, README:135).
//
// SO THE DECISION IS DEFERRED AND THE MECHANISM IS NOT. That distinction is
// the one ruling R77 draws: the chain should stop on decisions, not on
// plumbing. Which domain this product lives at is a decision. Whether the
// sitemap, the canonicals and robots.txt all read one constant is not.
//
// WHAT THIS FILE USED TO ASSERT, AND WHY IT NO LONGER DOES. The first version
// of siteOrigin THREW when the variable was unset and NODE_ENV was production,
// and this file had a whole block proving it. The reasoning was right about
// the risk - a sitemap of localhost URLs is not provisional output but WRONG
// output, well-formed enough that no other gate objects - and wrong about the
// trigger: `next build` sets NODE_ENV=production, so it fired on every LOCAL
// build, and `pnpm build` is part of this project's Definition of Done.
// Measured: "Failed to collect page data for /".
//
// The absence is now handled by being impossible to MISTAKE rather than by
// refusing to build. localhost reads as undecided; a provided value is still
// validated strictly. The residual risk - a deploy that forgets the variable -
// is not closed here and is written up as a question.

import { afterEach, describe, expect, it } from 'vitest';
import { PROVISIONAL_ORIGIN, siteOrigin } from '@/lib/content/site';

const ENV = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (ENV === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ENV;
});

describe('the provisional origin', () => {
  it('is localhost, and says so by being localhost', () => {
    // Not a placeholder domain, not example.com, not the product name with a
    // guessed TLD. Any of those would be a CLAIM - and a plausible one, which
    // is worse, because a reader would not question it. localhost is the
    // explicit absence of a domain and reads correctly as undecided.
    expect(PROVISIONAL_ORIGIN).toBe('http://localhost:3000');
  });

  it('is returned whenever the variable is unset, in every environment', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(siteOrigin()).toBe(PROVISIONAL_ORIGIN);
  });

  it('is a real absolute origin, so metadataBase can parse it', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(() => new URL(siteOrigin())).not.toThrow();
  });
});

describe('a configured origin is validated, not trusted', () => {
  it('is used as given', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://frontalier.fr';

    expect(siteOrigin()).toBe('https://frontalier.fr');
  });

  it('loses a trailing slash', () => {
    // Everything downstream concatenates a path onto this, and
    // "https://host//mentions-legales" is a DIFFERENT URL from the
    // single-slash form - a duplicate-content problem rather than a cosmetic
    // one, on a site whose whole value is being trusted.
    process.env.NEXT_PUBLIC_SITE_URL = 'https://frontalier.fr/';

    expect(siteOrigin()).toBe('https://frontalier.fr');
    expect(siteOrigin()).not.toMatch(/\/$/);
  });

  it('drops a path, because an origin is not a base path', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://frontalier.fr/fr/accueil';

    expect(siteOrigin()).toBe('https://frontalier.fr');
  });

  it('THROWS on a bare hostname, which is the mistake that actually happens', () => {
    // "frontalier.fr" rather than "https://frontalier.fr". It yields a
    // RELATIVE url in the sitemap - invalid rather than merely wrong - and it
    // is well-formed enough that nothing else in the pipeline would object.
    process.env.NEXT_PUBLIC_SITE_URL = 'frontalier.fr';

    expect(() => siteOrigin()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it('THROWS on a path, and on a scheme that is not http(s)', () => {
    for (const bad of ['/frontalier', 'ftp://frontalier.fr', 'mailto:a@b.c']) {
      process.env.NEXT_PUBLIC_SITE_URL = bad;

      expect(() => siteOrigin(), bad).toThrow();
    }
  });

  it('names the fix in the message, not just the problem', () => {
    // A build failing with "invalid origin" costs an hour; one that names the
    // variable and the shape it wants costs a minute.
    process.env.NEXT_PUBLIC_SITE_URL = 'frontalier.fr';

    let message = '';

    try {
      siteOrigin();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toContain('NEXT_PUBLIC_SITE_URL');
    expect(message).toContain('scheme');
  });
});
