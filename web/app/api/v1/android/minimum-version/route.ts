// web/app/api/v1/android/minimum-version/route.ts
//
// GET /api/v1/android/minimum-version - the minimum supported Android
// versionCode. AN-FORCE-UPDATE (R1110); docs/api-v1.md section 15.
//
// PUBLIC AND UNAUTHENTICATED, BY CONSTRUCTION. The handler takes no request,
// so it cannot read a token or a cookie: an app too old to be allowed in must
// still be able to ask whether it is, signed in or not. It reads no database
// either - one server setting, read per request (lib/android/minimum-version).
//
// THE ANSWER NAMES THE PRODUCT (R169), the same `service` /api/health carries,
// so the app can tell this product answered and not whatever else holds the
// port: a foreign or malformed answer makes the app carry on as it is (R1111,
// fail open), never show the update screen.
//
// NO MINIMUM IS SAID, NOT IMPLIED. `minimumVersionCode: null` is the explicit
// answer for an unset, empty or malformed setting; there is no default number.
//
// CACHEABLE FOR MINUTES. Five minutes in any cache between here and the app is
// how long a changed setting may take to reach everyone; the route itself is
// dynamic, so the server never answers from a value baked at build time.
//
// FROZEN ONCE SHIPPED (SPEC 18.1): an app in the field calls this path with
// this shape for as long as it is installed. iOS, when it has a host, joins
// with its own path beside this one rather than changing this one.

import { minimumVersionCode } from '@/lib/android/minimum-version';
import { SERVICE_NAME } from '@/lib/content/identity';

/** Per request: the setting is read when asked, never at build time. */
export const dynamic = 'force-dynamic';

/** Five minutes, in seconds. */
const CACHE_SECONDS = 300;

export function GET(): Response {
  return Response.json(
    { service: SERVICE_NAME, minimumVersionCode: minimumVersionCode() },
    { status: 200, headers: { 'cache-control': `public, max-age=${CACHE_SECONDS}` } },
  );
}
