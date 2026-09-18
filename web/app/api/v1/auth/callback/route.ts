// web/app/api/v1/auth/callback/route.ts
//
// GET /api/v1/auth/callback?token=...&email=... - the link in the email.
// FW22 increment 5 (the route for increment 2's token).
//
// THIS IS THE ONE URL A PERSON CLICKS, and everything about its shape follows
// from that. It is a GET because it is reached from a mail client; it takes
// its parameters in the query because a link cannot carry a body; and it is
// the target of the Android App Link, so tapping it on a phone with the app
// installed opens the app rather than a browser (SPEC 10).
//
// A GET THAT CHANGES STATE, WHICH IS NORMALLY WRONG. It consumes a
// single-use token and opens a session. The alternative - a landing page with
// a button that POSTs - is what a product with a web UI would do, and D14
// says this one has none: there is no page to render, and adding one would be
// a signed-in web surface that SPEC 10 forbids ("Web never authenticates").
//
// The cost is real and is bounded by the token, not by the method: anything
// that fetches the URL consumes it. A link-preview fetcher, a mail scanner, a
// forwarded message - each of those burns the link, and the person asks for
// another. That is why the token is single-use and fifteen minutes long: the
// damage from a fetch is a wasted link, never a session in the wrong hands,
// because the ONLY thing that receives the session is the response to the
// fetch itself.
//
// NO COOKIE, NO REDIRECT TO A PAGE. It answers with JSON the app reads. A
// browser that lands here sees it too, which is a poor experience and an
// honest one - and AN14 is where the App Link makes it never happen.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { consumeMagicLink } from '@/lib/auth/magic-link';
import { issueTokenPair } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db/client';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const email = (url.searchParams.get('email') ?? '').trim().toLowerCase();

  const identifier = await consumeMagicLink(email, token);

  if (identifier === null) {
    // ONE ANSWER FOR EVERY FAILURE - no such token, expired, already used,
    // wrong address. Distinguishing them would tell whoever holds a stale
    // link whether it was ever valid, and there is nothing a person does
    // differently: in every case they ask for a new one.
    return NextResponse.json(
      { status: 'error', code: 'invalid_link', message: AUTH_API_COPY.invalidLink },
      { status: 400 },
    );
  }

  // THE ACCOUNT IS CREATED HERE, NOT AT REQUEST TIME. This is the first
  // moment somebody has proven they control the address, and creating a User
  // row before that would let anyone fill the table with addresses they do
  // not own - and would make the request endpoint's "same work either way"
  // claim false, because a new row is work an existing address does not need.
  const user = await prisma.user.upsert({
    where: { email: identifier },
    update: { emailVerified: new Date() },
    create: { email: identifier, emailVerified: new Date() },
  });

  const pair = await issueTokenPair(user.id);

  return NextResponse.json(
    {
      status: 'ok',
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      accessExpiresAt: pair.accessExpiresAt.toISOString(),
      refreshExpiresAt: pair.refreshExpiresAt.toISOString(),
    },
    {
      status: 200,
      // A CREDENTIAL MUST NOT BE CACHED OR KEPT. no-store is the instruction
      // that matters; the others are belt and braces for proxies that predate
      // it. The URL itself carries the token, so a cached response is a
      // credential sitting in a shared cache.
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, private' },
    },
  );
}
