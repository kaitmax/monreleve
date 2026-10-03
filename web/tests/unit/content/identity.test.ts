// web/tests/unit/content/identity.test.ts
//
// RULING R188: THE PRODUCT NAME HAS THREE FORMS AND ONE SOURCE.
//
//   "Mon Relevé"    French prose, headings, the wordmark. Authoritative.
//   "monreleve.ch"  the domain, unaccented because DNS is.
//   "monreleve"     ONLY where a byte sequence is constrained.
//
// THE RENAME IS OF THE PRODUCT, NOT OF THE VOCABULARY, and that distinction is
// the whole difficulty of this task. "frontalier" is the French common noun
// for the reader this product is built for - a cross-border worker - and the
// copy uses it correctly dozens of times:
//
//   "le statut de frontalier lui-même"        the reader's legal status
//   "les règles du télétravail frontalier"    the subject of the guides
//   "/calculateur-teletravail-frontalier"     a slug SPEC 14 makes PERMANENT
//
// A rename that swept the string would have broken all three, and the ones it
// broke silently would be the URLs: SPEC 14 freezes them, so a slug that
// changed would 404 every link ever shared. So the tests below check the
// PRODUCT name in the places a product is named, and say nothing about the
// word elsewhere.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INSTANCE_ID_ENV,
  MAIL_SUBDOMAIN,
  PRODUCTION_ORIGIN,
  SERVICE_NAME,
  SITE_DOMAIN,
  TEST_ORIGIN,
  asciiName,
  instanceRefusal,
} from '@/lib/content/identity';
import { APP_NAME, TITLE_TEMPLATE } from '@/lib/fr';

const WEB = process.cwd();

describe('R188: three forms, one source', () => {
  it('names the product in French, accented', () => {
    expect(APP_NAME).toBe('Mon Relevé');
    // R155's rule, restated as an assertion: the authoritative form carries
    // its accent. A build that normalised it away would be a silent
    // downgrade of every heading on the site.
    expect(APP_NAME.normalize('NFC')).toContain('é');
  });

  it('derives the byte-constrained form rather than declaring it', () => {
    // THE POINT OF THE RULING. If this were a second literal it could drift,
    // and the drift would land on /api/health - where R169 compares it to
    // decide whether to run the suite at all.
    expect(SERVICE_NAME).toBe('monreleve');
    expect(SERVICE_NAME).toBe(asciiName(APP_NAME));
  });

  it('strips accents rather than dropping the letters that carry them', () => {
    // The NFD trap: a naive replace of the combining range without the
    // decomposition first removes nothing, and a naive strip of non-ASCII
    // turns "Relevé" into "Relev".
    expect(asciiName('Relevé')).toBe('releve');
    expect(asciiName('Mon Relevé')).toBe('monreleve');
    expect(asciiName('À Ç Ê Ï Ô Û')).toBe('aceiou');
  });

  it('keeps the domain a registration rather than a spelling', () => {
    // SITE_DOMAIN is NOT derived, deliberately: it is a fact about DNS, not
    // about French orthography, and the two are free to diverge. What is
    // asserted is that today they agree, so a future divergence is a visible
    // edit rather than a silent one.
    expect(SITE_DOMAIN).toBe('monreleve.ch');
    expect(SITE_DOMAIN.startsWith(SERVICE_NAME)).toBe(true);
    expect(PRODUCTION_ORIGIN).toBe('https://monreleve.ch');
    expect(MAIL_SUBDOMAIN).toBe('notifications.monreleve.ch');
  });

  it('reserves the test origin under RFC 2606', () => {
    expect(TEST_ORIGIN).toBe('https://monreleve.example');
    expect(TEST_ORIGIN.endsWith('.example')).toBe(true);
    // It must never be the real domain: a suite that hit production because
    // somebody typed the wrong TLD is the failure this reserves against.
    expect(TEST_ORIGIN).not.toContain(SITE_DOMAIN);
  });

  it('composes the title template from the accented name', () => {
    expect(TITLE_TEMPLATE).toBe(`%s — ${APP_NAME}`);
    expect(TITLE_TEMPLATE).toContain('Mon Relevé');
  });
});

describe('R301: the instance, not just the product', () => {
  // R169 proves /api/health NAMES this product; a sibling of the same product
  // passes it. instanceRefusal is the second question - WHICH instance - and
  // both directions matter: a refusal that fired on everything would be as
  // useless as one that fired on nothing.
  it('names the env var the harness and the server share', () => {
    // One home for the contract (R206): the route reads it, the suites check
    // it, and this is the constant they agree on.
    expect(INSTANCE_ID_ENV).toBe('FRONTALIER_INSTANCE_ID');
  });

  it('does not check when no instance was expected - warm reuse is untouched', () => {
    // THE OPT-IN DIRECTION. An ordinary run sets nothing, so a reused warm
    // server (instance null) is accepted - the whole reason reuse is kept.
    expect(instanceRefusal(undefined, null)).toBeNull();
    expect(instanceRefusal('', 'anything')).toBeNull();
    expect(instanceRefusal(undefined, 'anything')).toBeNull();
  });

  it('accepts the server that echoes the value this run set', () => {
    expect(instanceRefusal('run-abc', 'run-abc')).toBeNull();
  });

  it('refuses a sibling that answers without the marker, by name', () => {
    // FW33's case: the sibling passed R169 and answered /api/health with no
    // instance of ours. The message names what was expected and what was found.
    const message = instanceRefusal('run-abc', null);

    expect(message).not.toBeNull();
    expect(message).toContain('run-abc');
    expect(message).toContain('no instance marker');
  });

  it('refuses a sibling that echoes a DIFFERENT instance, by name', () => {
    const message = instanceRefusal('run-abc', 'run-xyz');

    expect(message).not.toBeNull();
    expect(message).toContain('run-abc');
    expect(message).toContain('run-xyz');
  });

  it('refuses a build predating the field (instance undefined in the body)', () => {
    // A server too old to carry the field answers `instance: undefined`; that
    // is a server this run did not start, so it is refused like any other.
    expect(instanceRefusal('run-abc', undefined)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// NO FOURTH FORM, AND THE UNACCENTED FORM WHERE NO READER MEETS IT
// ---------------------------------------------------------------------------

const FR = join(WEB, 'lib', 'fr');

/** Every .ts in lib/fr, which is where every reader-facing string lives. */
const COPY_FILES = readdirSync(FR).filter((name) => name.endsWith('.ts'));

/**
 * A quoted span, minus the comments - the same extraction R147 and R155 use.
 * Imported rather than rewritten, because a second copy of a scanner whose
 * failure mode is silent under-reporting is the shape this project keeps
 * finding.
 */
import { quotedSpans, withoutComments } from '../../support/quoted-spans';

interface Hit {
  readonly file: string;
  readonly line: number;
  readonly span: string;
}

function scanCopy(pattern: RegExp): readonly Hit[] {
  const hits: Hit[] = [];

  for (const file of COPY_FILES) {
    const source = withoutComments(readFileSync(join(FR, file), 'utf8'));

    source.split('\n').forEach((line, index) => {
      for (const span of quotedSpans(line)) {
        if (pattern.test(span)) hits.push({ file, line: index + 1, span });
      }
    });
  }

  return hits;
}

describe('R189: identity.json is asserted, not trusted', () => {
  /**
   * THE TRANSPORT FOR THE .mjs SCRIPTS, and a transcription of the derived
   * values above. R185: generated or asserted, never argued - a .mjs cannot
   * import the TypeScript that derives the name, so the JSON exists, and this
   * is what stops it drifting.
   *
   * WHAT DRIFT WOULD COST. scripts/lighthouse.mjs refuses to measure unless
   * /api/health answers with this value, and e2e/global-setup.ts refuses to
   * run the suite. A stale JSON would not produce a wrong number; it would
   * produce no number at all, with a message blaming the server.
   */
  it('carries exactly the derived identity', () => {
    const transport = JSON.parse(
      readFileSync(join(WEB, 'identity.json'), 'utf8'),
    ) as Record<string, string>;

    expect(transport.service, 'identity.json drifted from asciiName(APP_NAME)').toBe(
      SERVICE_NAME,
    );
    expect(transport.domain, 'identity.json drifted from SITE_DOMAIN').toBe(SITE_DOMAIN);
    expect(transport.testOrigin, 'identity.json drifted from TEST_ORIGIN').toBe(TEST_ORIGIN);
  });

  it('is the value the health route answers with', () => {
    // R189 in one line: the field and the guard are the same constant, and
    // the transport agrees with both. Three copies existed before FW20c -
    // the route, the e2e guard, and a literal in lighthouse.mjs.
    const route = readFileSync(join(WEB, 'app', 'api', 'health', 'route.ts'), 'utf8');
    const guard = readFileSync(join(WEB, 'e2e', 'global-setup.ts'), 'utf8');
    const lighthouse = readFileSync(join(WEB, 'scripts', 'lighthouse.mjs'), 'utf8');

    expect(route, 'the health route must not type the name').toContain('service: SERVICE_NAME');
    expect(guard, 'R169 compares the same constant').toContain('SERVICE_NAME');
    expect(lighthouse, 'R174 reads the transport rather than a literal').toContain(
      'identity.json',
    );
    expect(lighthouse, 'and holds no literal of its own').not.toContain("'frontalier'");
  });
});

describe('R188: no fourth form, and the ASCII form unseen', () => {
  it('writes the unaccented product name in no reader-facing string', () => {
    // "monreleve" unaccented is for byte-constrained contexts only. In lib/fr
    // it would be a fourth form - a misspelling of the product's own name, on
    // a page, in the language the product is written in.
    //
    // WORD-BOUNDED so the DOMAIN is not flagged: "monreleve.ch" is correct
    // wherever a host belongs, and lib/fr carries none today, but a copy
    // string naming the site by domain would be legitimate.
    const hits = scanCopy(/\bmonreleve\b(?!\.)/iu);

    expect(
      hits.map((hit) => `lib/fr/${hit.file}:${String(hit.line)}  ${hit.span}`),
      'the unaccented name in reader-facing copy - use APP_NAME',
    ).toEqual([]);
  });

  it('writes the product name as a literal nowhere, accented or not', () => {
    // EVERY occurrence derives from APP_NAME. A literal "Mon Relevé" in a
    // copy string is not wrong today and is a second source tomorrow - which
    // is the whole of R188 and the reason the old name could be changed in
    // one line.
    const hits = scanCopy(/Mon\s+Relev[ée]/iu).filter(
      // index.ts DECLARES it; that is the one source.
      (hit) => hit.file !== 'index.ts',
    );

    expect(
      hits.map((hit) => `lib/fr/${hit.file}:${String(hit.line)}  ${hit.span}`),
      'the product name typed into copy - interpolate APP_NAME instead',
    ).toEqual([]);
  });

  it('finds the copy files, so neither scan passes vacuously', () => {
    // R63. Both assertions above are absence assertions, and an extractor
    // that returned nothing would report perfect compliance.
    expect(COPY_FILES.length).toBeGreaterThan(15);
    expect(COPY_FILES).toContain('cgu.ts');

    // And the scanner reads what it is pointed at: the word this product is
    // ABOUT is still in the copy, dozens of times, and must be.
    expect(scanCopy(/\bfrontalier\b/iu).length, 'the common noun is gone').toBeGreaterThan(5);
  });

  it('keeps the old product name out of the places a product is named', () => {
    // THE OTHER DIRECTION. The common noun stays; the product name must not.
    // "du site frontalier", "frontalier calcule", "alertes frontalier" were
    // the shapes FW20c found, so they are the shapes asserted against.
    const named = scanCopy(/(?:site|application|service)\s+frontalier\b/iu);
    const subject = scanCopy(/\bfrontalier\s+(?:calcule|enregistre|est un|fait)\b/iu);

    expect(
      [...named, ...subject].map((hit) => `lib/fr/${hit.file}:${String(hit.line)}  ${hit.span}`),
      'the product is still called frontalier here',
    ).toEqual([]);
  });
});
