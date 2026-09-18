# `/api/v1` — the contract with the Android client

Started in FW22. **FW23 freezes it.**

This file records the decisions a reader of the code would otherwise have to
infer, and the ones they would be right to challenge. It is not generated
documentation: everything here is a choice that cost something, written down
so the cost is visible to whoever inherits it.

The client is an Android application in the field. A route renamed after
release is a migration, plus an app release, plus every version still calling
the old shape (R187, extended to routes by the Phase 4 protocol).

---

## 1. Authentication

Passwordless throughout (D6, D23). **There is no signed-in web area** (D14),
and SPEC §10 makes the consequence explicit: *"Web never authenticates… no
session cookie on any public route — the v1 cookie exception (D12) is
withdrawn, and the 'zero cookies on the public surface' guarantee is total
again."*

**No route in this API sets a cookie.** Not "does not today" — there is no
session-cookie code path in the product. `tests/db/auth-round-trip.test.ts`
asserts `Set-Cookie` is absent from every response in the sign-in flow,
checked on the responses rather than trusted to the absence of cookie code.

### 1.1 The flow

```
POST /api/v1/auth/magic-link    { email }              -> 202, always
  (email arrives)
GET  /api/v1/auth/callback?token=…&email=…             -> 200 { access, refresh }
POST /api/v1/auth/refresh       { refreshToken }       -> 200 { access, refresh }
POST /api/v1/auth/sign-out      Authorization: Bearer  -> 200
POST /api/v1/auth/revoke-all    Authorization: Bearer  -> 200
```

### 1.2 The callback is a state-changing `GET`, deliberately

Normally wrong, and here unavoidable: the URL is reached from a mail client,
which cannot POST, and D14 forbids the interstitial page with a button that
would otherwise fix it — that page would be a signed-in web surface.

What makes it acceptable is not the method. **It is that the exposure is
bounded by the token rather than by the verb.**

- **Prefetching is expected, and burning the link is the designed outcome.**
  A link-preview fetcher, a corporate mail scanner, a security appliance that
  follows URLs before a human sees them — each of these consumes the link.
  That is not a bug and should not be filed as one.
- **A burnt link is recoverable.** The person asks for another from the app.
  The cost is one wasted round trip.
- **The session only ever reaches whoever receives that response.** The
  scanner that burnt the link is handed the token pair, which is why the token
  is single-use and short-lived (15 minutes): it bounds the window in which a
  fetch is worth anything, and the pair goes to the fetcher rather than being
  left lying around for the next one.

A future reader will see a `GET` that mutates state and assume nobody noticed.
Somebody did.

### 1.3 The refresh token travels in the body, never the `Authorization` header

The access token is presented as `Authorization: Bearer <token>` on every
authenticated route. The refresh token is **not**, and never should be.

Any intermediary that logs `Authorization` headers — a reverse proxy, a crash
reporter, an HTTP SDK with default instrumentation — captures whatever is in
that field. On every other route that is a credential with a fifteen-minute
life. On the refresh route it would be the ninety-day one, captured from the
single request that carries it.

`lib/auth/bearer.ts` **refuses a refresh token presented as a bearer token**,
returning `unknown_token`. That refusal is what makes this a rule rather than
a convention: without it a client eventually does the convenient thing and the
property lapses with nothing failing.

### 1.4 Refusal codes

Every error response carries a **stable ASCII `code`** and a **French
`message`**. The code is the contract; the message may be rewritten freely.
A client that branches on the French breaks when the copy improves.

| code | meaning | what the client does |
|---|---|---|
| `missing_token` | no `Authorization` header | a client defect |
| `malformed_authorization` | header present, not `Bearer <token>` | a client defect |
| `unknown_token` | no such token, or a refresh token at a bearer door | sign in again |
| `expired_token` | access token past its life | refresh silently |
| `rotated_token` | replaced by a rotation | refresh silently |
| `revoked_session` | session ended | **sign in again — do not refresh** |
| `invalid_link` | callback token unknown/expired/used/wrong address | ask for a new link |
| `invalid_refresh_token` | refresh token unusable, for any reason | sign in again |
| `malformed_body` | body was not JSON | a client defect |

**`expired_token` and `revoked_session` must stay distinct.** A client told
`expired` when the session was revoked will refresh, be refused, and loop.

**Revocation is checked before expiry**, so a token that is both reports
`revoked` — the more serious fact, and the one that stops the loop.

### 1.5 Where the API deliberately says less

`POST /api/v1/auth/magic-link` answers **202 with the same body for every
outcome**: registered, unregistered, rate-limited, mail provider down.

This is not an oversight and must not be "improved". A sign-in form that
answers differently for a known and an unknown address is an account
enumeration oracle, and for this product membership is itself the sensitive
fact — an account implies living in France and working in Switzerland.
`/confidentialite` promises not to enable that inference.

The request does **identical work** either way (same validation, same two
writes, same send), so the identical response is backed by an identical code
path rather than by a timing pad somebody tunes and then stops trusting.

`POST /api/v1/auth/refresh` likewise answers `invalid_refresh_token` for
unknown, expired, already-rotated and revoked alike — including the replay
that just revoked the session. Telling a caller "that token was already used"
would confirm to a thief that the real client is active.

**R198 is not "always say more".** It is "the boundary decides, and the
decision is deliberate". §1.4 is where the client is entitled to know; §1.5 is
where telling it would be the vulnerability.

---

## 2. Sessions and tokens

Tokens are **opaque** — 32 random bytes, no structure, no claims — and every
fact about them is a database row.

**This is a SPEC requirement, not a preference.** SPEC §10: *"the refresh
token is only invalidated by sign-out, account deletion, or a server-side
revoke."* A self-contained token cannot deliver that sentence: it stays valid
until it expires whatever the server decides, because there is no un-signing.
`DELETE` is a complete answer; a signature is not. The cost is one indexed
lookup per request.

| | lifetime | rotated |
|---|---|---|
| access | 15 minutes | on every refresh |
| refresh | 90 days | on every use |

**Reuse detection ends the whole session.** A consumed refresh token presented
again means it was captured — the legitimate client has moved to the successor
and has no reason to send the old one. The server cannot tell which holder is
the thief, so it trusts neither: `revokedReason = TOKEN_REPLAYED`.

> **This is a fourth way a session ends**, where SPEC §10 names three
> (sign-out, account deletion, server-side revoke). SPEC's sentence is about a
> daily-use app not nagging its user; this is about a credential known to be in
> two hands. Recorded in `REPORT-FW22.txt`.

Revoking one session leaves other devices signed in. The **session** is the
unit, not the account. `revoke-all` is the wide one and ends the calling
session too — somebody asking it may be holding the device they lost.

---

## 3. The audit trail, and one bound on it

`EntryEvent` is append-only: no UPDATE, no DELETE, enforced by database
triggers rather than by convention (FW21, AC2). `EntryEvent.entryId` carries
**no foreign key**, deliberately — the trail must outlive the row it records,
and an event carries enough to be read alone (R203).

**Outliving the ROW is not outliving the ACCOUNT.** FW26's account deletion
(D11) removes user, entries, events and devices together, so the append-only
property is bounded by account lifetime.

Nobody should read *"append-only, no foreign key"* as *"retained after
erasure"*. It is not, and `/confidentialite` says so.

---

## 4. `/.well-known/assetlinks.json`

Not `/api/v1`, but part of the same contract: it is what makes the sign-in
link an Android App Link rather than a browser redirect.

**It is served only when it can be believed, not when it can be parsed.**

- Unset variables → **404**. An empty statement list is not "we have not said
  yet" — it is a complete, published statement that *no* application is
  associated with this domain, which Android reads, caches and acts on.
- Malformed values → **404** and a log line. A fingerprint with a typo yields
  a syntactically valid file that verifies against nothing, and the symptom
  ("the link opens a browser sometimes") is about as far from the cause as a
  symptom gets.

`PARK4-2` names exactly what AN14 must supply — including that if Play
re-signs the upload, **Google's signing key** is the one that ships, and a
statement naming only the upload key verifies for nobody.

---

## 5. Tenancy

**Identity comes from the bearer token and from nowhere else.** No route reads
a user id from a body field, a query parameter or a header.

This is enforced by absence rather than by validation: `lib/auth/bearer.ts`
reads one header and never looks at the rest of the request, so a later
handler cannot forget the rule. `tests/db/bearer.test.ts` plants a victim's id
in the body, the query string and a header, verifies each plant landed (R180),
and requires the resolved identity to be the token's — plus a fourth test that
removes the token and requires the planted id alone to get nothing, without
which the other three would pass against a guard that ignored the token too.
