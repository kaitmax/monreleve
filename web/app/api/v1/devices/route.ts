// web/app/api/v1/devices/route.ts
//
// POST /api/v1/devices - where a phone says where to send its reminders.
// FW27 increment 3.
//
// ============================================================================
// THE TOKEN MOVES TO WHOEVER IS SIGNED IN, AND THAT IS A SAFETY PROPERTY
// ============================================================================
//
// `Device.fcmToken` is unique, and a registration token belongs to an APP
// INSTALL rather than to a person. So one phone lent to somebody else, or one
// person signing out and another signing in, produces the same token arriving
// under a different account.
//
// If the row kept its first owner, the previous person's reminders would go on
// arriving on a phone that is now somebody else's - a notification naming a
// day the new user is logging, on a device the old user no longer holds. The
// upsert therefore REASSIGNS the row to the caller, which is the only reading
// that keeps a reminder going to the person who asked for it.
//
// It follows that possession of a token is not authority over an account:
// nothing here reads the token to decide WHO is calling. That comes from the
// bearer header and from nowhere else (lib/auth/bearer.ts), so registering a
// token somebody else's phone reported tells the server nothing except where
// to send YOUR reminders - and the person who still holds the phone re-
// registers on their next launch and takes it back.
//
// ============================================================================
// THE SESSION IS LINKED HERE BECAUSE IT CANNOT BE LINKED EARLIER
// ============================================================================
//
// SPEC §8 makes `DeviceSession.deviceId` nullable, and the schema says why: a
// session is created at the auth callback, and registration is a separate call
// the client makes afterwards. Sign-in must not depend on push permission.
// This is the call that closes the gap, so revoking one session can later name
// the device it belonged to.

import { NextResponse } from 'next/server';
import { AUTH_API_COPY } from '@/lib/fr/auth-api';
import { authenticate, unauthorised } from '@/lib/auth/bearer';
import { deviceRegistrationSchema } from '@/lib/devices/schema';
import { findLocationKeys } from '@/lib/entries/no-coordinates';
import { prisma } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/** Never cached: one person's device, behind a bearer token. */
const HEADERS = { 'cache-control': 'no-store, private', vary: 'Authorization' };

function refuse(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ status: 'error', code, message }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await authenticate(request);

  if (!auth.ok) return unauthorised(auth.code);

  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return refuse('malformed_body', AUTH_API_COPY.malformedBody);
  }

  // SPEC §13.1 / D18, before validation and for the same reason as on /me and
  // /entries: a `latitude` key is recorded as a COORDINATE rather than lost
  // inside a generic "unknown field" refusal. A device registration is a
  // plausible place for a client to attach "where this phone is".
  const coordinates = findLocationKeys(raw as Record<string, unknown>);

  if (coordinates.length > 0) {
    console.error(`[devices] refused: location keys in the body (${coordinates.sort().join(', ')})`);

    return refuse('coordinates_refused', AUTH_API_COPY.coordinateRefused);
  }

  const parsed = deviceRegistrationSchema.safeParse(raw);

  if (!parsed.success) return refuse('invalid_body', AUTH_API_COPY.invalidPayload);

  const { fcmToken, platform, appVersion } = parsed.data;

  try {
    const device = await prisma.device.upsert({
      where: { fcmToken },
      create: { userId: auth.userId, fcmToken, platform, appVersion },
      // SERVER-ASSIGNED, as every timestamp in this product is. A client that
      // could name when it was last seen could name a time it was not.
      update: { userId: auth.userId, platform, appVersion, lastSeenAt: new Date() },
      select: { id: true, platform: true, appVersion: true, lastSeenAt: true },
    });

    // D21's link, made now that both rows exist. `updateMany` rather than
    // `update` so a session revoked between the bearer check and this line is
    // a no-op rather than a 500 on a request that otherwise succeeded.
    await prisma.deviceSession.updateMany({
      where: { id: auth.sessionId },
      data: { deviceId: device.id },
    });

    // THE TOKEN IS NOT ECHOED. The client sent it and has it; repeating it
    // puts a device identifier into a response body, a proxy buffer and
    // whatever the client logs, for no purpose.
    return NextResponse.json(
      {
        id: device.id,
        platform: device.platform,
        appVersion: device.appVersion,
        lastSeenAt: device.lastSeenAt.toISOString(),
      },
      { status: 200, headers: HEADERS },
    );
  } catch (cause) {
    console.error('[devices] registration failed:', cause instanceof Error ? cause.message : 'unknown');

    return refuse('read_failed', AUTH_API_COPY.readFailed, 500);
  }
}
