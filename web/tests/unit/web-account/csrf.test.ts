// web/tests/unit/web-account/csrf.test.ts
//
// R902: the same-origin check, BOTH DIRECTIONS (R196's shape). A check that
// refused everything would pass every refusal below, so the acceptances are as
// much the point as the refusals - including the one that matters in the
// image: a request whose URL origin is the bound address (http://0.0.0.0:3000)
// while its Host and Origin are the public site.

import { describe, expect, it } from 'vitest';
import { checkSameOrigin } from '@/lib/web-account/csrf';

function headers(values: Record<string, string>): Headers {
  return new Headers(values);
}

describe('accepted', () => {
  it('a form posted from this site, Origin and Host agreeing', () => {
    expect(checkSameOrigin(headers({ host: 'monreleve.ch', origin: 'https://monreleve.ch' }))).toEqual({
      ok: true,
    });
  });

  it('with fetch metadata saying same-origin', () => {
    expect(
      checkSameOrigin(
        headers({ host: 'monreleve.ch', origin: 'https://monreleve.ch', 'sec-fetch-site': 'same-origin' }),
      ).ok,
    ).toBe(true);
  });

  it('a local server on a moved port (R170)', () => {
    expect(checkSameOrigin(headers({ host: 'localhost:3400', origin: 'http://localhost:3400' })).ok).toBe(true);
  });

  it('behind a proxy that rewrites Host, through X-Forwarded-Host', () => {
    expect(
      checkSameOrigin(
        headers({ host: '0.0.0.0:3000', 'x-forwarded-host': 'monreleve.ch', origin: 'https://monreleve.ch' }),
      ).ok,
    ).toBe(true);
  });

  it('whatever the request URL says - the check never reads it', () => {
    // The function takes HEADERS only; a Request addressed at the bound
    // address with the public Host is the image's case.
    const request = new Request('http://0.0.0.0:3000/mon-releve/deconnexion', {
      method: 'POST',
      headers: { host: 'monreleve.ch', origin: 'https://monreleve.ch' },
    });

    expect(checkSameOrigin(request.headers).ok).toBe(true);
  });
});

describe('refused', () => {
  it('a form posted from another site', () => {
    expect(checkSameOrigin(headers({ host: 'monreleve.ch', origin: 'https://evil.example' }))).toEqual({
      ok: false,
      refusal: 'origin_foreign',
    });
  });

  it('a POST with no Origin at all', () => {
    expect(checkSameOrigin(headers({ host: 'monreleve.ch' }))).toEqual({ ok: false, refusal: 'origin_missing' });
  });

  it('the opaque "null" origin a sandboxed frame sends', () => {
    expect(checkSameOrigin(headers({ host: 'monreleve.ch', origin: 'null' })).ok).toBe(false);
  });

  it('a cross-site request by fetch metadata, even with a matching Origin', () => {
    expect(
      checkSameOrigin(
        headers({ host: 'monreleve.ch', origin: 'https://monreleve.ch', 'sec-fetch-site': 'cross-site' }),
      ),
    ).toEqual({ ok: false, refusal: 'fetch_site_foreign' });
  });

  it('a sibling subdomain (same-site is not same-origin)', () => {
    expect(
      checkSameOrigin(
        headers({ host: 'monreleve.ch', origin: 'https://www.monreleve.ch', 'sec-fetch-site': 'same-site' }),
      ).ok,
    ).toBe(false);
    expect(checkSameOrigin(headers({ host: 'monreleve.ch', origin: 'https://www.monreleve.ch' })).ok).toBe(false);
  });

  it('a malformed Origin', () => {
    expect(checkSameOrigin(headers({ host: 'monreleve.ch', origin: 'not a url' })).ok).toBe(false);
  });

  it('a request with no Host to compare against', () => {
    expect(checkSameOrigin(headers({ origin: 'https://monreleve.ch' })).ok).toBe(false);
  });
});
