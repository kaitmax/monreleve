// web/tests/unit/api/android-minimum-version.test.ts
//
// GET /api/v1/android/minimum-version. AN-FORCE-UPDATE (R1110).
//
// ============================================================================
// WHAT IS PROVEN HERE
// ============================================================================
//
// The route answers the minimum supported Android versionCode from ONE server
// setting read at request time, and an unset, empty, blank or malformed value
// means NO minimum, said explicitly (`minimumVersionCode: null`) - never a
// guessed number. A wrong "yes" here would lock every person out of the app
// with a button to a listing that has nothing newer, so the parse is strict
// and every lenient reading JavaScript offers (Number('') is 0, Number('1e3')
// is 1000, parseInt('12abc') is 12) is pinned as "no minimum".
//
// THE FIXTURE IS THE JOIN (R204). Every case in
// fixtures/android-minimum-version-cases.json is driven through the REAL
// handler here and its body compared whole; the Kotlin side hands the same
// bodies to the app's real client parsing (MinimumVersionFixtureTest). Neither
// side can rename a field or change a reading without the other failing.
//
// BOTH DIRECTIONS (R196): "no minimum" alone is satisfied by a route that
// never reads the setting, so the valid cases are asserted just as hard.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from '@/app/api/v1/android/minimum-version/route';
import {
  ANDROID_MINIMUM_VERSION_ENV,
  PLAY_VERSION_CODE_CEILING,
  minimumVersionCode,
} from '@/lib/android/minimum-version';
import { SERVICE_NAME } from '@/lib/content/identity';

type Case = {
  name: string;
  setting: string | null;
  minimum: number | null;
  body: { service: string; minimumVersionCode: number | null };
};

const FIXTURE = JSON.parse(
  readFileSync(join(process.cwd(), '..', 'fixtures', 'android-minimum-version-cases.json'), 'utf8'),
) as { cases: Case[] };

function clear(): void {
  delete process.env[ANDROID_MINIMUM_VERSION_ENV];
}

beforeEach(clear);
afterEach(clear);

describe('the fixture was read (R133)', () => {
  it('holds unset, malformed and valid cases', () => {
    expect(FIXTURE.cases.length).toBeGreaterThan(10);
    expect(FIXTURE.cases.some((c) => c.setting === null)).toBe(true);
    expect(FIXTURE.cases.some((c) => c.minimum === null && c.setting !== null)).toBe(true);
    expect(FIXTURE.cases.some((c) => c.minimum !== null)).toBe(true);
  });

  it('names the setting by its constant, so the fixture and the code mean the same variable', () => {
    expect(ANDROID_MINIMUM_VERSION_ENV).toBe('ANDROID_MINIMUM_VERSION_CODE');
  });
});

describe('the real handler answers every fixture case exactly (R204)', () => {
  it.each(FIXTURE.cases.map((c) => [c.name, c] as const))('%s', async (_name, c) => {
    if (c.setting !== null) process.env[ANDROID_MINIMUM_VERSION_ENV] = c.setting;

    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(c.body);
    // The body says what the case means, so the fixture cannot drift from itself.
    expect(c.body.minimumVersionCode).toBe(c.minimum);
  });
});

describe('the setting is read at request time, not at build or import time', () => {
  it('follows a change between two requests in one process', async () => {
    const before = (await GET().json()) as { minimumVersionCode: number | null };

    process.env[ANDROID_MINIMUM_VERSION_ENV] = '3';
    const during = (await GET().json()) as { minimumVersionCode: number | null };

    clear();
    const after = (await GET().json()) as { minimumVersionCode: number | null };

    expect([before.minimumVersionCode, during.minimumVersionCode, after.minimumVersionCode]).toEqual([
      null,
      3,
      null,
    ]);
  });
});

describe('the answer names the product (R169)', () => {
  it('carries the same service name /api/health does', async () => {
    const body = (await GET().json()) as { service: string };

    expect(body.service).toBe(SERVICE_NAME);
  });
});

describe('it never needs a session', () => {
  it('takes no request at all, so it cannot read a token or a cookie', () => {
    // Structural, not behavioural: a handler declared with no parameter has
    // nothing to authenticate against. A later edit that starts reading the
    // request changes this arity and fails here first.
    expect(GET.length).toBe(0);
  });

  it('answers 200 with no credentials and sets no cookie', () => {
    process.env[ANDROID_MINIMUM_VERSION_ENV] = '2';

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});

describe('it is cacheable for minutes', () => {
  it('says so in Cache-Control, and is JSON', () => {
    const response = GET();

    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
    expect(response.headers.get('content-type')).toMatch(/^application\/json/);
  });
});

describe('minimumVersionCode, the one parse', () => {
  it('reads the environment by default', () => {
    process.env[ANDROID_MINIMUM_VERSION_ENV] = '41';

    expect(minimumVersionCode()).toBe(41);
  });

  it('accepts the ceiling and refuses one above it', () => {
    expect(PLAY_VERSION_CODE_CEILING).toBe(2_100_000_000);
    expect(minimumVersionCode(String(PLAY_VERSION_CODE_CEILING))).toBe(PLAY_VERSION_CODE_CEILING);
    expect(minimumVersionCode(String(PLAY_VERSION_CODE_CEILING + 1))).toBeNull();
  });

  it.each([['1'], ['10'], ['123456789']])('accepts %s', (value) => {
    expect(minimumVersionCode(value)).toBe(Number(value));
  });

  it.each([
    [undefined],
    [''],
    [' '],
    ['0'],
    ['-1'],
    ['1.5'],
    ['1e3'],
    ['12abc'],
    ['0x10'],
    ['01'],
    ['Infinity'],
    ['NaN'],
    ['1 2'],
    ['99999999999999999999'],
  ])('refuses %j as no minimum', (value) => {
    expect(minimumVersionCode(value)).toBeNull();
  });
});
