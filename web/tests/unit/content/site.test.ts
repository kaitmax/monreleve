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
import {
  PROVISIONAL_ORIGIN,
  canonicalsAvailable,
  isProvisionalOrigin,
  isRuntime,
  servingWithoutOrigin,
  siteOrigin,
} from '@/lib/content/site';

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

// ---------------------------------------------------------------------------
// RULING R81. The runtime marker is the signal the first version of this
// module lacked: NODE_ENV=production is set by `next build`, so it could not
// tell "serving" from "building on a laptop". FRONTALIER_RUNTIME=1 can.
// ---------------------------------------------------------------------------

describe('the runtime marker (R81)', () => {
  afterEach(() => {
    delete process.env.FRONTALIER_RUNTIME;
  });

  it('is off unless explicitly 1', () => {
    // Not "any truthy value": an accidental FRONTALIER_RUNTIME=0 or =false
    // must not switch on a guard that returns 503s.
    for (const value of ['0', 'false', '', 'yes', 'true']) {
      process.env.FRONTALIER_RUNTIME = value;

      expect(isRuntime(), value).toBe(false);
    }

    process.env.FRONTALIER_RUNTIME = '1';
    expect(isRuntime()).toBe(true);
  });

  it('reports the provisional origin as provisional', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(isProvisionalOrigin()).toBe(true);

    process.env.NEXT_PUBLIC_SITE_URL = 'https://frontalier.fr';
    expect(isProvisionalOrigin()).toBe(false);
  });
});

describe('servingWithoutOrigin is the condition R81 names', () => {
  afterEach(() => {
    delete process.env.FRONTALIER_RUNTIME;
  });

  it('is true only when BOTH hold - serving, and no origin configured', () => {
    // The whole point of the pairing. Either alone is a normal state:
    // building without an origin is every local build, and serving WITH one
    // is production working correctly.
    delete process.env.NEXT_PUBLIC_SITE_URL;

    delete process.env.FRONTALIER_RUNTIME;
    expect(servingWithoutOrigin(), 'building, no origin').toBe(false);

    process.env.FRONTALIER_RUNTIME = '1';
    expect(servingWithoutOrigin(), 'serving, no origin').toBe(true);

    process.env.NEXT_PUBLIC_SITE_URL = 'https://frontalier.fr';
    expect(servingWithoutOrigin(), 'serving, with origin').toBe(false);

    delete process.env.FRONTALIER_RUNTIME;
    expect(servingWithoutOrigin(), 'building, with origin').toBe(false);
  });

  it('leaves the BUILD-TIME fallback intact, which R81 requires explicitly', () => {
    // The failure the first design caused: `pnpm build` is part of this
    // project's Definition of Done, and guarding on NODE_ENV broke it.
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.FRONTALIER_RUNTIME;

    expect(() => siteOrigin()).not.toThrow();
    expect(siteOrigin()).toBe(PROVISIONAL_ORIGIN);
  });
});

describe('canonicals key off the origin, not the marker - and that is deliberate', () => {
  afterEach(() => {
    delete process.env.FRONTALIER_RUNTIME;
  });

  it('are unavailable whenever the origin is the stand-in, marker or not', () => {
    // Next bakes `metadata` for a statically prerendered route at BUILD time,
    // so a canonical cannot react to a runtime marker - by the time the
    // marker is visible the tag is already written. Omitting on the
    // PROVISIONAL condition is what actually protects a reader: a canonical
    // pointing at localhost is worse than no canonical, because a crawler
    // treats it as an instruction rather than as an absence.
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(canonicalsAvailable()).toBe(false);

    process.env.FRONTALIER_RUNTIME = '1';
    expect(canonicalsAvailable(), 'the marker must not change this').toBe(false);

    process.env.NEXT_PUBLIC_SITE_URL = 'https://frontalier.fr';
    expect(canonicalsAvailable()).toBe(true);
  });
});
