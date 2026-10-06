// web/lib/alerts/rate-limit.ts
//
// A fixed window per client address. FW14 increment 2.
//
// WHAT IT IS ACTUALLY FOR. Not abuse in the abstract: this endpoint sends
// EMAIL to an address somebody else typed. Without a limit, a script can walk
// a list of addresses and make this service deliver an unsolicited message to
// every one of them - our domain, our reputation, their inbox. It also makes
// the enumeration timing attack that tests/db/subscribe-enumeration.test.ts
// documents expensive enough to stop being practical.
//
// IN MEMORY, AND THE LIMITS OF THAT ARE STATED. SPEC section 3 has no Redis -
// "pg-boss on Postgres, no Redis" - and a table write per attempt would make
// the rate limiter itself the load. So the window lives in the process, which
// means it is per-instance: two instances behind a proxy allow twice the
// attempts, and a restart forgets everything. For a single-VPS deployment
// (SPEC 18) that is the whole population, and the failure mode is a limit
// that is too generous rather than one that locks somebody out.
//
// NOT A DEFENCE AGAINST A BOTNET, and it does not pretend to be. A thousand
// addresses get a thousand windows. What it stops is the cheap version, which
// is the version that actually happens.

/** Attempts allowed per window, per client. */
const LIMIT = 5;

/** The window, in milliseconds. */
const WINDOW_MS = 10 * 60 * 1000;

interface Window {
  count: number;
  resetAt: number;
}

/**
 * The state, deliberately module-level.
 *
 * A Map that only ever grows is a leak, so an expired entry is dropped on
 * read and the whole map is swept when it gets large. A public endpoint sees
 * a lot of distinct addresses over a week.
 */
const windows = new Map<string, Window>();

/** Above this many tracked clients, sweep expired entries on the next check. */
const SWEEP_AT = 10_000;

export interface RateDecision {
  readonly allowed: boolean;
  /** Seconds until the window resets. Only meaningful when refused. */
  readonly retryAfter: number;
}

/**
 * Count an attempt and say whether to serve it.
 *
 * `now` is a parameter so the test can move time without waiting ten minutes
 * for a window to expire - the same reason the engine takes its clock as an
 * argument rather than reading one.
 */
export function checkRate(
  client: string,
  now: number = Date.now(),
  // The window's own ceiling. Defaults to LIMIT (the alert and sign-in-request
  // forms). AN-ONBOARD: the code-exchange endpoint passes a HIGHER one, because
  // its real guard is the per-request attempt counter (5) and this edge limit is
  // only a backstop against extreme abuse - set below LIMIT it would pre-empt the
  // counter and refuse a fat-fingered but honest person before they ran out of
  // tries.
  limit: number = LIMIT,
): RateDecision {
  if (windows.size > SWEEP_AT) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
  }

  const current = windows.get(client);

  if (current === undefined || current.resetAt <= now) {
    windows.set(client, { count: 1, resetAt: now + WINDOW_MS });

    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;

  if (current.count > limit) {
    return {
      allowed: false,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  return { allowed: true, retryAfter: 0 };
}

/** For tests. There is no production caller and there must not be one. */
export function resetRateLimit(): void {
  windows.clear();
}

/**
 * Who is asking, as well as we can tell behind a reverse proxy.
 *
 * NOT LOGGED, NOT STORED. The address is used as a Map key for ten minutes
 * and never written anywhere - /confidentialite says the public site does not
 * identify the reader, and an access log keyed by IP would be a different
 * claim from the one that page makes.
 *
 * x-forwarded-for is set by our own proxy (SPEC 18) and can be forged by a
 * client talking to the origin directly. The FIRST entry is the one the proxy
 * appends for the real peer; taking the last would let a client name its own
 * bucket by sending a header.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');

  // THE FIRST ENTRY, AND IT CAN STILL BE EMPTY. A header of "," is non-empty
  // and its first entry is not - checking the header alone let that through
  // and returned "", which is a real Map key and therefore a silent bucket
  // nobody named. Found by the test that asked for a non-empty key rather
  // than for a correct one.
  const first = (forwarded ?? '').split(',')[0]?.trim() ?? '';

  if (first !== '') return first;

  // No proxy header: everything shares one bucket, which is strict rather
  // than lax, and correct for a local or misconfigured deployment.
  return 'unknown';
}
