// web/app/api/v1/me/route.ts
//
// GET and PATCH /api/v1/me. FW26 increment 2.
//
// ============================================================================
// THE INVARIANTS ARE NOT CHECKED HERE, AND THAT IS THE DESIGN
// ============================================================================
//
// SPEC §8's two rules about these columns live in the database (R196), so they
// survive a writer that does not know they exist. This route is one such
// writer; the seed is another; a future admin path will be a third. What this
// file owes a client is not a third copy of the rule but a NAMED answer when
// the database refuses (R198) - `employment_rate_out_of_range` rather than a
// 500 that sends somebody to read the server log.
//
// The mapping is BY CONSTRAINT NAME, which FW21 already established as the way
// this project identifies which rule fired.
//
// ============================================================================
// CONSENT IS ENFORCED SERVER-SIDE, IN THE SAME WRITE
// ============================================================================
//
// SPEC §13 forbids detection without consent and D19 makes revocation
// immediate. Two consequences, both here rather than in a client:
//
//   revoking consent  -> `detectionConsentAt` cleared AND `loggingMode` forced
//                        to MANUAL, so the setting cannot say one thing while
//                        the system does another
//   AUTO_DETECT with  -> refused, because a row carrying it with a null stamp
//   no consent           is the forbidden state written down

import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { authenticate, unauthorised } from '@/lib/auth/bearer';
import { findLocationKeys } from '@/lib/entries/no-coordinates';
import { ME_SELECT, serialiseMe } from '@/lib/me/read';
import { mePatchSchema } from '@/lib/me/schema';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

function refuse(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ status: 'error', code, message }, { status });
}

/** Never cached: one person's configuration, behind a bearer token. */
const HEADERS = { 'cache-control': 'no-store, private', vary: 'Authorization' };

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await authenticate(request);

  if (!auth.ok) return unauthorised(auth.code);

  const row = await prisma.user.findUnique({ where: { id: auth.userId }, select: ME_SELECT });

  if (row === null) return refuse('read_failed', AUTH_API_COPY.readFailed, 500);

  return NextResponse.json(serialiseMe(row), { status: 200, headers: HEADERS });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await authenticate(request);

  if (!auth.ok) return unauthorised(auth.code);

  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return refuse('malformed_body', AUTH_API_COPY.malformedBody);
  }

  // SPEC 13.1 / D18, before validation: a `latitude` key is recorded as a
  // COORDINATE rather than as an unknown field, or the one interesting fact
  // about the request - that a client is sending coordinates - is lost in a
  // generic refusal.
  const coordinates = findLocationKeys(raw as Record<string, unknown>);

  if (coordinates.length > 0) {
    console.error(`[me] refused: location keys in the body (${coordinates.sort().join(', ')})`);

    return refuse('coordinates_refused', AUTH_API_COPY.coordinateRefused);
  }

  const parsed = mePatchSchema.safeParse(raw);

  if (!parsed.success) {
    return refuse('invalid_body', AUTH_API_COPY.invalidPayload);
  }

  const { detectionConsent, ...settings } = parsed.data;

  // The state AFTER this request, needed to judge the consent rules against
  // what the row will be rather than against what it was.
  const current = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { loggingMode: true, detectionConsentAt: true },
  });

  if (current === null) return refuse('read_failed', AUTH_API_COPY.readFailed, 500);

  const consentAfter =
    detectionConsent === undefined
      ? current.detectionConsentAt !== null
      : detectionConsent;

  // ASKING FOR AUTO_DETECT WHILE CONSENT IS ABSENT is the forbidden pair
  // stated as a request, and it is refused rather than stored.
  //
  // The mirror case - a row already on AUTO_DETECT whose consent is being
  // revoked - is NOT refused. It is the one thing revocation must always be
  // allowed to do, and the write below forces MANUAL alongside it. A rule that
  // refused it would make stopping data collection require a second request,
  // which is precisely the persuasion D19 forbids.
  if (settings.loggingMode === 'AUTO_DETECT' && consentAfter === false) {
    return refuse('consent_required', AUTH_API_COPY.invalidPayload);
  }

  const data: Prisma.UserUpdateInput = {
    ...settings,
    ...(settings.activityStartDate === undefined
      ? {}
      : {
          activityStartDate:
            settings.activityStartDate === null
              ? null
              : new Date(`${settings.activityStartDate}T00:00:00.000Z`),
        }),
    ...(detectionConsent === undefined
      ? {}
      : {
          // SERVER-ASSIGNED, always. A client that could name the moment it
          // consented could name one it did not.
          detectionConsentAt: detectionConsent ? new Date() : null,
          // Revocation stops detection here, not on the client's honour.
          ...(detectionConsent ? {} : { loggingMode: 'MANUAL' as const }),
        }),
  };

  try {
    const row = await prisma.user.update({
      where: { id: auth.userId },
      data,
      select: ME_SELECT,
    });

    return NextResponse.json(serialiseMe(row), { status: 200, headers: HEADERS });
  } catch (cause) {
    // R198 BY CONSTRAINT NAME. The database owns these rules; the client is
    // owed the name of the one it broke rather than "500".
    const message = cause instanceof Error ? cause.message : String(cause);

    if (message.includes('User_employmentRate_range')) {
      return refuse('employment_rate_out_of_range', AUTH_API_COPY.invalidPayload);
    }

    if (message.includes('User_exactTotalWorkDays_iff_exact')) {
      return refuse('exact_total_required', AUTH_API_COPY.invalidPayload);
    }

    console.error('[me] update failed:', message);

    return refuse('read_failed', AUTH_API_COPY.readFailed, 500);
  }
}
