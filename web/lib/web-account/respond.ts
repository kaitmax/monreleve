// web/lib/web-account/respond.ts
//
// The two answers every POST handler in the account area gives: a 303 to a page
// of this site (relative, R364), or a 403 for a request that is not ours (R902).

import { NextResponse } from 'next/server';
import { MON_RELEVE_COPY } from '@/lib/fr/mon-releve';
import { relativeRedirect } from '@/lib/http/redirect';
import type { CrossOriginRefusal } from '@/lib/web-account/csrf';

/** Nothing the area answers may be stored by a cache: it is one person's. */
const NO_STORE = 'no-store, private';

/**
 * 303 to a page of this site, optionally setting or clearing THE cookie.
 *
 * The Set-Cookie value comes only from lib/web-account/cookie.ts; this takes it
 * as a string so the one writer stays the one writer.
 */
export function seeOther(target: string, setCookie?: string): NextResponse {
  const response = relativeRedirect(target);

  response.headers.set('cache-control', NO_STORE);

  if (setCookie !== undefined) response.headers.append('set-cookie', setCookie);

  return response;
}

/** R902's refusal. The reason goes to the log, never to the caller. */
export function crossOriginRefused(refusal: CrossOriginRefusal): NextResponse {
  console.warn(`[web-account] refused a request that is not same-origin (${refusal})`);

  return new NextResponse(MON_RELEVE_COPY.crossOrigin, {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': NO_STORE },
  });
}

/** One field of a posted form, as a string, or '' for anything else (absent, a file, unreadable). */
export async function formField(request: Request, name: string): Promise<string> {
  try {
    const value = (await request.formData()).get(name);

    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

/** Several fields at once - a body can be read only once. */
export async function formFields<K extends string>(
  request: Request,
  names: readonly K[],
): Promise<Record<K, string>> {
  let form: FormData | null = null;

  try {
    form = await request.formData();
  } catch {
    form = null;
  }

  const out = {} as Record<K, string>;

  for (const name of names) {
    const value = form?.get(name);

    out[name] = typeof value === 'string' ? value : '';
  }

  return out;
}
