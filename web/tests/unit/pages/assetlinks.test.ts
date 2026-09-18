// web/tests/unit/pages/assetlinks.test.ts
//
// FW22 increment 5: /.well-known/assetlinks.json publishes a statement or it
// publishes nothing.
//
// BOTH STATES ARE ASSERTED, and the second is the one that matters. "It 404s
// when unset" is an absence assertion, and an absence assertion is satisfied
// by a route that 404s always - including one whose JSON is malformed, whose
// environment variables are misspelled, or which was deleted. So the file also
// sets the variables and requires a statement Android would actually accept.
// R133: the signal has to be specific enough that only the right thing
// produces it.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from '@/app/.well-known/assetlinks.json/route';

const PACKAGE = 'ch.monreleve.app';
const FINGERPRINT =
  '14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5';
const SECOND =
  'A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90:A1:B2:C3:D4:E5:F6:07:18:29:3A:4B:5C:6D:7E:8F:90';

function clear(): void {
  delete process.env.ANDROID_PACKAGE_NAME;
  delete process.env.ANDROID_SHA256_CERT_FINGERPRINTS;
}

beforeEach(clear);
afterEach(clear);

describe('unset: it publishes nothing, rather than publishing "nothing"', () => {
  it('returns 404 when neither variable is set', () => {
    expect(GET().status).toBe(404);
  });

  it.each([
    ['only the package name', { ANDROID_PACKAGE_NAME: PACKAGE }],
    ['only the fingerprints', { ANDROID_SHA256_CERT_FINGERPRINTS: FINGERPRINT }],
  ])('returns 404 with %s', (_label, env) => {
    Object.assign(process.env, env);

    expect(GET().status).toBe(404);
  });

  it('NEVER returns an empty statement list', async () => {
    // THE WHOLE POINT OF THE ROUTE. `[]` is not "we have not said yet" - it is
    // a complete, published statement that NO application is associated with
    // this domain, which Android will read, cache and act on. Serving it while
    // the fingerprints are merely unknown publishes something false in the one
    // file whose purpose is to be believed.
    const response = GET();

    expect(response.status).toBe(404);

    const body = (await response.json()) as unknown;

    expect(Array.isArray(body)).toBe(false);
  });
});

describe('set: it publishes a statement Android can verify', () => {
  it('returns the shape the specification defines', async () => {
    process.env.ANDROID_PACKAGE_NAME = PACKAGE;
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = FINGERPRINT;

    const response = GET();

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      relation: string[];
      target: { namespace: string; package_name: string; sha256_cert_fingerprints: string[] };
    }[];

    expect(body).toHaveLength(1);
    expect(body[0]?.relation).toEqual(['delegate_permission/common.handle_all_urls']);
    expect(body[0]?.target.namespace).toBe('android_app');
    expect(body[0]?.target.package_name).toBe(PACKAGE);
    expect(body[0]?.target.sha256_cert_fingerprints).toEqual([FINGERPRINT]);
  });

  it('carries several fingerprints, which a release and a debug key need', async () => {
    process.env.ANDROID_PACKAGE_NAME = PACKAGE;
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = `${FINGERPRINT}, ${SECOND}`;

    const body = (await GET().json()) as { target: { sha256_cert_fingerprints: string[] } }[];

    expect(body[0]?.target.sha256_cert_fingerprints).toEqual([FINGERPRINT, SECOND]);
  });

  it('uppercases what it is given, because Android compares exactly', async () => {
    process.env.ANDROID_PACKAGE_NAME = PACKAGE;
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = FINGERPRINT.toLowerCase();

    const body = (await GET().json()) as { target: { sha256_cert_fingerprints: string[] } }[];

    expect(body[0]?.target.sha256_cert_fingerprints).toEqual([FINGERPRINT]);
  });
});

describe('malformed: it refuses rather than publishing something that cannot verify', () => {
  // A FINGERPRINT WITH A TYPO produces a file that is syntactically fine and
  // verifies against nothing. The symptom - "the link opens a browser
  // sometimes" - is about as far from the cause as a symptom gets, so a
  // malformed value becomes a 404 and a log line instead.
  it.each([
    ['a truncated fingerprint', FINGERPRINT.slice(0, 40)],
    ['no colons', FINGERPRINT.replaceAll(':', '')],
    ['a non-hex character', FINGERPRINT.replace('14', 'ZZ')],
  ])('returns 404 for %s', (_label, value) => {
    process.env.ANDROID_PACKAGE_NAME = PACKAGE;
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = value;

    expect(GET().status).toBe(404);
  });

  it.each([
    ['a package name with no dot', 'monreleve'],
    ['a package name starting with a digit', '1ch.monreleve.app'],
  ])('returns 404 for %s', (_label, value) => {
    process.env.ANDROID_PACKAGE_NAME = value;
    process.env.ANDROID_SHA256_CERT_FINGERPRINTS = FINGERPRINT;

    expect(GET().status).toBe(404);
  });
});
