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
//
// AND SINCE FW-CODE-CAP IT IS NO LONGER THE LAST WORD ON THE CODE EXCHANGE
// (R363). Everything above was written when this was the only thing standing
// between a guesser and a six-digit code, and read that way it was a
// guarantee - which it never was, because the Map empties on every deploy.
// The durable ceiling now lives in PostgreSQL: MAX_CODE_ATTEMPTS_PER_DAY in
// lib/auth/magic-link.ts, ten attempts per address per rolling twenty-four
// hours, counted across every code issued in the window and claimed
// atomically.
//
// SO READ THIS FILE AS THE FIRST FILTER AND NOT THE GUARANTEE. It is cheap,
// it runs before any query, and it stops a source hammering the endpoint;
// what it cannot do is survive a restart, which is exactly the property the
// table was added to supply. Nothing here changed - the reading of it did.

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
 * How many proxies this deployment trusts to have appended to
 * X-Forwarded-For. Default 1: Coolify's Traefik, and nothing in front of it.
 *
 * AN ENVIRONMENT VARIABLE BECAUSE IT IS A FACT ABOUT THE DEPLOYMENT, not
 * about this code. Put a CDN in front of Traefik and the real peer moves one
 * entry left; nothing in the repository can know that happened.
 *
 * docs/deploy.md records how an operator verifies the count against the real
 * VPS - one logged request, compared with the client's actual address. This
 * session cannot reach that host and does not claim the count is right there.
 */
function trustedProxyHops(): number {
  const raw = process.env.TRUSTED_PROXY_HOPS;
  const parsed = Number.parseInt(raw ?? '', 10);

  // A TYPO MUST NOT WIDEN THE BUCKET. "two", "0" and "-1" all fall back to
  // the default rather than being coerced into something that silently
  // reads the wrong entry - an operator mistake here is a security change,
  // so it fails to the strict, documented value.
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * Who is asking, as well as we can tell behind a reverse proxy.
 *
 * NOT LOGGED, NOT STORED. The address is used as a Map key for ten minutes
 * and never written anywhere - /confidentialite says the public site does not
 * identify the reader, and an access log keyed by IP would be a different
 * claim from the one that page makes.
 *
 * ============================================================================
 * THE n-TH ENTRY FROM THE RIGHT (R362), AND THIS FILE USED TO SAY THE OPPOSITE
 * ============================================================================
 *
 * The comment here read: "The FIRST entry is the one the proxy appends for
 * the real peer; taking the last would let a client name its own bucket by
 * sending a header." That is backwards, and it had the consequence it
 * describes.
 *
 * PROXIES APPEND. A client that sends `X-Forwarded-For: 9.9.9.9` and connects
 * to Traefik produces `9.9.9.9, <real peer>`. So the FIRST entry is exactly
 * the value the client chose, and reading it meant any caller could select
 * its own rate-limit bucket - or share one with everybody else - by setting a
 * header. Per-IP limiting was advisory against precisely the person it exists
 * to stop, which is why FW-CODE-CAP counts the real ceiling as "whatever the
 * attacker says it is".
 *
 * The RIGHTMOST entries are the ones our own infrastructure wrote. With n
 * trusted hops, the n-th from the right is the address the outermost trusted
 * proxy actually observed.
 *
 * SHORTER THAN n IS 'unknown', not a guess. A header with fewer entries than
 * the deployment says it should have means the request did not arrive the way
 * the configuration claims; inventing an entry would invent a bucket.
 */
export function clientKey(headers: Headers): string {
  const entries = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

  const hops = trustedProxyHops();
  const candidate = entries[entries.length - hops];

  if (candidate !== undefined && candidate !== '') return candidate;

  // No usable header: everything shares one bucket, which is strict rather
  // than lax, and correct for a local or misconfigured deployment.
  return 'unknown';
}
