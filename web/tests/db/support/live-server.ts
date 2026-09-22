// web/tests/db/support/live-server.ts
//
// Is a server of OURS running, and where? FW25b increment 1.
//
// ============================================================================
// WHY A PDF TEST NEEDS ONE AND THE OTHER DATABASE TESTS DO NOT
// ============================================================================
//
// Every other route in tests/db is driven by importing its handler and handing
// it a `Request`. That works because those handlers only read the database.
//
// The PDF handler drives a BROWSER, and the browser makes a real HTTP request
// back to the print route. There is no way to prove a PDF was produced without
// something to fetch: a handler-only test can prove the refusals and nothing
// else.
//
// ============================================================================
// R169: IT MUST NAME THIS PRODUCT, NOT MERELY ANSWER
// ============================================================================
//
// FW20 ran 91 tests to completion against a different application's container
// on port 3000, which answered `/api/health` with a valid 200 of its own. A
// check that only proves something is LISTENING proves nothing about WHAT, so
// the `service` field is the signal and a 200 is not.
//
// Here the cost of getting it wrong would be a PDF rendered from a neighbour's
// page, asserted for banned words it was never going to contain, and passing.
//
// R133: when there is no server, the suite says so BY NAME rather than
// quietly reporting fewer tests - the same rule gate:clone follows for the
// steps a clone cannot run.

import { SERVICE_NAME } from '@/lib/content/identity';

/** The port this product's server would be on (R170). */
function port(): string {
  return process.env.FRONTALIER_PORT ?? process.env.PORT ?? '3000';
}

/**
 * The origin of a running server that identifies itself as this product, or
 * null with the reason it could not be used.
 */
export async function liveOrigin(): Promise<{ origin: string } | { skip: string }> {
  const origin = `http://localhost:${port()}`;

  let response: Response;

  try {
    response = await fetch(`${origin}/api/health`, {
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    return {
      skip: `no server answered ${origin}/api/health - start one with \`pnpm dev\` (R170: set FRONTALIER_PORT to move it)`,
    };
  }

  if (!response.ok) {
    return { skip: `${origin}/api/health answered ${response.status}` };
  }

  const body: unknown = await response.json().catch(() => null);
  const service =
    typeof body === 'object' && body !== null && 'service' in body
      ? (body as { service?: unknown }).service
      : undefined;

  // THE POSITIVE SIGNAL. A foreign application answering 200 with valid JSON
  // of its own is exactly the case FW20 shipped past.
  //
  // R181: the name is READ from the module the route answers with, never typed
  // beside it. e2e/global-setup.ts derives it the same way, so the two checks
  // cannot disagree about who we are.
  if (service !== SERVICE_NAME) {
    return {
      skip: `${origin} answered /api/health but did not name this product (service=${JSON.stringify(service)}) - a port collision, most likely`,
    };
  }

  return { origin };
}
