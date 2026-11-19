// web/lib/web-account/csrf.ts
//
// R902: EVERY STATE-CHANGING REQUEST FROM THE ACCOUNT AREA IS PROVEN SAME-ORIGIN.
//
// ============================================================================
// THE MECHANISM: AN ORIGIN CHECK, WITH FETCH METADATA IN FRONT OF IT
// ============================================================================
//
// Every state-changing request in the area is a POST - the two sign-in steps,
// sign-out, and both downloads (the PDF one records an issuance and supersedes
// the current version, so it is state-changing too). Each handler calls
// `checkSameOrigin` before it reads anything else, and a refusal is a 403.
//
//   1. Sec-Fetch-Site, when the browser sends it, must be `same-origin`. A
//      form posted from another site arrives `cross-site`; from a sibling
//      subdomain, `same-site`. Both are refused.
//   2. Origin MUST be present, and its host must equal the host this request
//      was addressed to. Every current browser sends Origin on a POST; a POST
//      without one is not a browser following our form, so it is refused
//      rather than trusted.
//
// WHY THE HOST HEADER AND NOT `request.url`'s ORIGIN. Inside the image the
// standalone server derives its URL from the address it is BOUND to,
// http://0.0.0.0:3000 (lib/http/redirect.ts records what that cost). A check
// against it would pass every local test and refuse every production sign-in.
// The Host header is what the browser addressed, and the proxy preserves it;
// X-Forwarded-Host is accepted beside it for a proxy that rewrites Host. A
// cross-site page cannot set either on a victim's request.
//
// WHY NOT A TOKEN AS WELL. A synchroniser token defends against a forged
// request that carries the victim's cookie. With SameSite=Lax the cookie is
// not sent on a cross-site POST at all, and the Origin check refuses the
// request before the cookie is even read - two independent layers, and the
// sign-in steps (which run before any cookie exists) are covered by the
// Origin check alone. A token would be a third mechanism with a state of its
// own to keep. Stated in REPORT-FW-WEB-ACCOUNT.txt's R907 table.

/** Why a request was refused. For the log and the tests; the person sees one sentence. */
export type CrossOriginRefusal = 'fetch_site_foreign' | 'origin_missing' | 'origin_foreign';

export type SameOriginVerdict = { readonly ok: true } | { readonly ok: false; readonly refusal: CrossOriginRefusal };

const SAME: SameOriginVerdict = { ok: true };

function hostOf(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

/** The host this request was addressed to, as the browser and the proxy saw it. */
function addressedHosts(headers: Headers): string[] {
  const forwarded = headers.get('x-forwarded-host')?.split(',')[0]?.trim();

  return [headers.get('host'), forwarded].filter(
    (host): host is string => typeof host === 'string' && host !== '',
  );
}

export function checkSameOrigin(headers: Headers): SameOriginVerdict {
  const fetchSite = headers.get('sec-fetch-site');

  if (fetchSite !== null && fetchSite !== 'same-origin') {
    return { ok: false, refusal: 'fetch_site_foreign' };
  }

  const origin = headers.get('origin');

  // "null" is what a sandboxed frame or a privacy-redirected form sends.
  if (origin === null || origin === '' || origin === 'null') {
    return { ok: false, refusal: 'origin_missing' };
  }

  const host = hostOf(origin);

  if (host === null || !addressedHosts(headers).includes(host)) {
    return { ok: false, refusal: 'origin_foreign' };
  }

  return SAME;
}
