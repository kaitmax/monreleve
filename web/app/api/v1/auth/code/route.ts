// web/app/api/v1/auth/code/route.ts
//
// POST /api/v1/auth/code  { email, code }  -> 200 { access, refresh }
// AN-ONBOARD: the six-digit code exchange.
//
// AN ADDITIONAL WAY IN, NOT A REPLACEMENT. The App Link callback (R195) is
// frozen and unchanged; this route is the second door the relay asks for, built
// for the two cases the link cannot serve: before monreleve.ch verifies the App
// Link (the link opens a browser and fails), and when the mail is read on a
// different device. It opens the SAME session the callback does - the same token
// pair, the same rotation and replay rules - because it ends in the same
// issueTokenPair.
//
// NO ENUMERATION (docs/api-v1.md 1.5, extended). An address with no pending
// request is refused `invalid_code`, identical to a wrong guess, so the endpoint
// cannot be used to test who has an account. The account is created at the
// EXCHANGE, the first moment somebody has proven they hold the code - exactly as
// the callback creates it, and for the same reason.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { checkRate, clientKey } from '@/lib/alerts/rate-limit';
import { consumeCode } from '@/lib/auth/magic-link';
import { issueTokenPair } from '@/lib/auth/tokens';
import { prisma } from '@/lib/db/client';

const BODY = z.object({ email: z.string(), code: z.string() });

/** A credential must not be cached or kept - the same header the callback sets. */
const HEADERS = { 'Cache-Control': 'no-store, no-cache, must-revalidate, private' };

function refuse(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ status: 'error', code, message }, { status, headers: HEADERS });
}

/**
 * A BACKSTOP, SET WELL ABOVE THE PER-REQUEST COUNTER. The per-code guard is
 * consumeCode's five-attempt limit; this edge window exists only to stop a source
 * hammering the endpoint across many requests. Twenty per ten minutes is far more
 * than any honest person needs (even someone who exhausts one code's five tries,
 * asks for a new one, and tries again stays under it) and far below what a script
 * would want - so a legitimate fat-fingered user meets `too_many_attempts`, never
 * `rate_limited`, and only abuse meets this.
 */
const EXCHANGE_RATE_LIMIT = 20;

/**
 * The existing rate limits per address and per network source, namespaced so the
 * exchange does not share the request form's or the alert form's buckets. Both
 * are checked and both are counted: by IP to stop one source hammering many
 * addresses, by address to stop many sources hammering one.
 */
function allowed(email: string, headers: Headers): boolean {
  const ip = clientKey(headers);
  const byAddress = checkRate(`auth:code:email:${email}`, Date.now(), EXCHANGE_RATE_LIMIT);
  const byIp = checkRate(`auth:code:ip:${ip}`, Date.now(), EXCHANGE_RATE_LIMIT);

  return byAddress.allowed && byIp.allowed;
}

export async function POST(request: Request): Promise<NextResponse> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return refuse('malformed_body', AUTH_API_COPY.malformedBody, 400);
  }

  const parsed = BODY.safeParse(raw);

  if (!parsed.success) {
    return refuse('malformed_body', AUTH_API_COPY.malformedBody, 400);
  }

  const email = parsed.data.email.trim().toLowerCase();

  if (!allowed(email, request.headers)) {
    return refuse('rate_limited', AUTH_API_COPY.codeRateLimited, 429);
  }

  const result = await consumeCode(email, parsed.data.code);

  if (!result.ok) {
    switch (result.reason) {
      case 'code_expired':
        return refuse('code_expired', AUTH_API_COPY.codeExpired, 400);
      case 'too_many_attempts':
        // 429: the request is spent. Telling the person to ask for a new one is
        // what recovers them - the message says so (R198).
        return refuse('too_many_attempts', AUTH_API_COPY.tooManyAttempts, 429);
      case 'invalid_code':
      default:
        return refuse('invalid_code', AUTH_API_COPY.invalidCode, 400);
    }
  }

  // THE ACCOUNT IS CREATED HERE, NOT AT REQUEST TIME - the first moment somebody
  // has proven they hold the code. The create carries only the address, exactly
  // as the callback does, so a person who signs in by code for the first time
  // keeps whatever settings a later PATCH gives them (never overwritten here).
  const user = await prisma.user.upsert({
    where: { email: result.email },
    update: { emailVerified: new Date() },
    create: { email: result.email, emailVerified: new Date() },
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
    { status: 200, headers: HEADERS },
  );
}
