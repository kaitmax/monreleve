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
  (email arrives, carrying a link AND a 6-digit code)
GET  /api/v1/auth/callback?token=…&email=…             -> 200 { access, refresh }
POST /api/v1/auth/code          { email, code }        -> 200 { access, refresh }
POST /api/v1/auth/refresh       { refreshToken }       -> 200 { access, refresh }
POST /api/v1/auth/sign-out      Authorization: Bearer  -> 200
POST /api/v1/auth/revoke-all    Authorization: Bearer  -> 200
```

A client signs out with whatever access token it holds, which after an idle
period has often expired. So sign-out takes the same 401 path as every other
call: refresh once, retry once, and if the refresh is refused the session is
already dead and the client only wipes locally (AN-SIGNOUT-REFRESH, R706).

The callback and `/api/v1/auth/code` are **two ways through one request**: the same
email carries a link and a six-digit code, tied to the same single-use sign-in
request and expiring together. Using either one consumes both. The code exists
because the link opens the app only once `monreleve.ch` verifies the App Link, and
because mail is often read on another device — see §1.6.

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
| `invalid_code` | wrong code, or no pending request for the address | check the digits, or ask for a new code |
| `code_expired` | the request existed but its window passed | ask for a new code |
| `too_many_attempts` | the per-request attempt limit was reached | ask for a new code |
| `rate_limited` | too many exchange calls from this address/source | wait, then try again |
| `invalid_refresh_token` | refresh token unusable, for any reason | sign in again |
| `malformed_body` | body was not JSON, or not `{ email, code }` | a client defect |

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

### 1.6 `POST /api/v1/auth/code` — the six-digit code

`{ email, code }` → **200** with the same `{ access, refresh }` pair the callback
returns, and the same `Cache-Control: no-store` and no cookie. It is an
**additional** door, not a replacement: the App Link callback (§1.1, §1.2) is
unchanged and frozen.

- **The code and the link are one request.** The email carries both; they expire
  together (fifteen minutes); using either consumes both. Exchanging the code
  signs the person in and makes the link in that same email dead, and vice versa.
- **Six digits are safe only with an attempt limit.** A million combinations is
  nothing to a script, so each request allows **five** wrong attempts; after the
  fifth the request is dead (`too_many_attempts`) — even the correct code is then
  refused — and the person asks for a new code. That counter is the real guard.
  A per-address and per-source edge limit (`rate_limited`) sits far above it as a
  backstop against hammering, never in the way of an honest mistype.
- **The code is stored hashed** (SHA-256, like the link token) and compared in
  constant time. The table is never a list of valid codes.
- **No enumeration (§1.5 extended).** An address with no pending request is
  refused `invalid_code`, identical to a wrong guess, so the endpoint cannot be
  used to test who has an account. A `VerificationToken` row exists for any
  address that requested a link, registered or not (§1.5), so even `code_expired`
  and `too_many_attempts` reveal only that a link was once requested — which
  anyone can cause for any address — never that an account exists.
- **The account is created at the exchange**, the first moment somebody has proven
  they hold the code, exactly as the callback creates it, carrying only the
  address so a first-time sign-in by code overwrites no settings.

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
---

## 6. `/api/v1/entries` — the entries contract

**FROZEN AS OF FW23.** Every field name, every error code and both route
shapes below are fixed. A change after AN5 ships requires a **version**, not an
edit: `/api/v2/entries` beside this one, both served, until no client in the
field calls the old one.

This is not ceremony. The client is an Android application on somebody's phone,
and a phone updates when its owner decides to. A renamed field costs a
migration, an app release, and a tail of versions still sending the old shape
for as long as anyone keeps a handset — R187, at the one place in this product
where it is not recoverable.

**What the freeze forbids, precisely.** Read it as "nothing changes" and you
will leave real improvements unmade; read it as "anything goes" and you will
break a handset somebody cannot update. It forbids exactly three things:

| | |
|---|---|
| **Renaming** any field, in a request or a response | a shipped client looks for the old name and finds nothing |
| **Removing** any field or error `code` | same |
| **Changing what an existing field MEANS** | the worst of the three, because nothing fails — the client parses happily and is wrong |

**What stays free**, and the first row is the one that matters most:

| | |
|---|---|
| **Adding a field to a RESPONSE** | a client built per §6.4 ignores keys it does not know. This is the escape hatch, and it is meant to be used |
| Every French `message` | a client that branches on it was already broken |
| The HTTP status *within* a class | 400 → 422 is fine; 400 → 200 is not |
| The order of keys inside a JSON object | never part of the contract |

**Adding a field to a REQUEST is not free**, and the asymmetry is the whole
point: a new *optional* request field is additive and fine, but making an
existing optional field required, or adding a required one, breaks every client
that does not send it.

R217 is the worked example. The `POST` answer gained `entries` *after* this
document said FROZEN, because a response gaining a key breaks nobody — and the
cost of not adding it was a second round trip paid by every client forever, on
the call the app makes most often. Deferring it would have cost a response
change plus an app release instead of one increment.

### 6.1 `POST /api/v1/entries` — the offline queue flushing

One batch is one user action: the queue draining after a tunnel, a flight, a
weekend in the mountains. It is **all-or-nothing** — a half-applied batch would
leave the client unable to say what happened without reading everything back.

```
POST /api/v1/entries
Authorization: Bearer <access token>
Content-Type: application/json

{ "entries": [ { … }, { … } ] }
```

Between 1 and **200** items, and at most **256 KiB** of body. Both limits exist
because `note` is free text: without the byte bound, 200 maximum-length notes
would quietly decide how much this route reads.

An **empty** `entries` array is refused rather than answered 200. Zero items
means the queue logic sent something it should not have, and acknowledging it
hides that for the life of the client.

<!-- fields:write -->

| field | may a client assume |
|---|---|
| `clientMutationId` | **The idempotency key (D30).** The client's own id, 1–64 characters, unique across the account. Re-sending a batch whose ids the server has already seen writes nothing, appends no event, and answers **200** — a replay is acknowledged, never an error, because the retry is what makes all-or-nothing safe. **"Already seen" means the server has applied this mutation at any point**, not that the day still carries it: the check reads the append-only trail, so a replay is still recognised after the day has been edited by something else. See section 6.4. |
| `dayDate` | A calendar day as `YYYY-MM-DD`, **never an instant**. Validated as a real day: `2026-02-30` and `2026-13-01` match the pattern and are refused. Interpreted in Europe/Paris — the reader lives in France (SPEC §8). |
| `portion` | `FULL`, `AM` or `PM`. Defaults to `FULL`. The row's identity is `(dayDate, portion)`, so `AM` and `PM` are two rows. **A day keeps the granularity it was recorded in (R490): `FULL` may not sit beside `AM` or `PM` for one account and day** - see *One granularity per day* below. |
| `kind` | `CH`, `HOME`, `MISSION_FR`, `MISSION_THIRD` or `ABSENT`. |
| `absenceReason` | `CONGE`, `MALADIE`, `FERIE` or `AUTRE`. **Required iff `kind` is `ABSENT`**, and refused otherwise — both directions, in the schema *and* as a database CHECK constraint, so the rule survives a writer that does not know it exists (R196). |
| `note` | Free text, at most 500 characters. A person's aide-mémoire, not a document. |
| `provenance` | `MANUAL`, `DETECTED_CONFIRMED` or `DETECTED_CORRECTED`. Defaults to `MANUAL`. |
| `detectedKind` | What detection proposed. **Required when `provenance` is not `MANUAL`**; permitted, and meaningful, on a `MANUAL` row (see §6.3). |
| `detectedAt` | When the proposal was produced on-device. An ISO instant with an offset. |
| `clientClaimedAt` | What the offline client asserts about when this was written. **Stored verbatim and never trusted as evidence** — the server keeps this *and* its own `firstRecordedAt`, and the dossier shows both, so a reader sees the gap rather than being handed one number and asked to believe it. |

<!-- /fields:write -->

**Unknown keys are refused, not stripped.** Zod strips by default, and
stripping is a lie with a success code: a client sending `firstRecordedAt`, a
misspelt `dayDte`, or a `latitude` would receive 200 and believe the value was
stored. The app would then show a day as synced while the server holds
something different, and nobody would find out until a dossier is wrong a year
later.

Three names are refused **specifically because a client must never send them**:
`firstRecordedAt` and `recordedAt` are the server clock and the whole evidence
claim; `userId` is tenancy, which comes from the token and nowhere else; `id`
is the server naming its own rows.

**Answer:**

```json
{
  "status": "ok",
  "written": 2,
  "duplicates": 1,
  "entries": [ { … }, { … }, { … } ]
}
```

`written` produced a row; `duplicates` were already here and are **acknowledged
rather than retried**. A client reconciles its queue from those two numbers.

`entries` carries **the current state of every day the batch named**, in exactly
the shape and order §6.2 specifies — the same object, from the same code, so a
client needs one parser rather than two. This is what lets the app clear the
pending state SPEC §13.2 describes **without a second request**.

**Duplicates are included, and that is the half that matters.** A client retries
precisely because it never received the first answer; a replay that withheld the
rows would deny the timestamps to the one caller that cannot obtain them any
other way, and the second round trip would survive in exactly the case this
exists to remove.

**A refusal carries no `entries` key at all.** The batch is all-or-nothing, so
an error must not hand back rows that suggest something landed.

**One granularity per day (R490, FW-GRANULARITY).** For one account and one
calendar day the server holds either a `FULL` row or `AM` and/or `PM` rows,
never both: a day holding `FULL` beside a half would be counted twice in the
*Relevé* (a whole day plus half a day, twice over). The rule is a database
**exclusion constraint**, so it holds for every writer. A write that would break
it is refused **400 `granularity_conflict`** - a `FULL` where `AM` or `PM`
exists, an `AM`/`PM` where `FULL` exists, or both in one batch - and
**nothing of that batch is written, and no `EntryEvent` is appended**, because a
batch is all-or-nothing. It is **400 and not 409 on purpose**: a client that
isolates a refused multi-item batch item by item (the Android `SyncEngine` does,
R296) lands the good days and holds only the refused one, whereas a 409 is held
whole. `AM` beside `PM` stays legal; **editing a day's rows, including changing
a `FULL` row's `kind`, is never refused**, and a day already holding both
(none existed in production when this landed) is neither repaired nor rewritten
by the rule. This is **additive** under the freeze: a new code on an existing
refusal status, no field added or removed; a client built per section 6.5, which
treats an unknown 4xx as terminal for that request, is already correct.

**The same holds when two writers race** (FW-DOSSIER-EMPTY-3, R591). Two
concurrent requests for one day in different granularities can make PostgreSQL
abort one as a deadlock or write conflict rather than raise the exclusion
violation; the server retries that transaction **exactly once** (the aborted
attempt wrote nothing), so the loser is answered `400 granularity_conflict` -
or, with nothing left to conflict with, its write lands - and never `500
write_failed` for the race alone. A retry that fails again is `write_failed`,
as before.

**One batch may not name the same `(dayDate, portion)` twice.** It is refused
with `invalid_payload`, and the message names both positions — *"entries[1]
repeats 2026-04-07 FULL, already at entries[0]"* — because a client author is
holding a queue rather than a batch and needs to know which two items collided.

### 6.2 `GET /api/v1/entries?year=YYYY` — the read path

```
GET /api/v1/entries?year=2026
Authorization: Bearer <access token>
```

**The year is the page. There is no pagination, and that is a decision rather
than an omission.**

The result set has a *structural* ceiling, not a hoped-for one:
`@@unique([userId, dayDate, portion])` permits at most one row per portion per
day, `EntryPortion` has three values, and a leap year has 366 days — **1098
rows, ever**. Nothing a client, a user or a malformed batch can do exceeds it.
(The oft-quoted "about 260 working days" is the *typical* count, not the bound:
`ABSENT` is a kind, so all 366 calendar days can be declared, and a user who
changes granularity mid-year leaves `FULL` rows beside `AM`/`PM` ones.)

**A cursor would be wrong here, not merely unnecessary.** The client reconciles
a *set*. A half-fetched year is indistinguishable from a year with missing days
— and which days are missing is the one fact this product exists to report
honestly. A snapshot that arrives whole or fails cannot lie about completeness;
a paged feed that stops on page three renders as a year the user did not live.

So **the server never truncates.** A short array never carries a 200. A year
that cannot be served whole is `read_failed`, never a partial success.

**The envelope is an object, never a bare array.** That is the one decision
with no recovery at any price: a top-level array can never gain a sibling key.
If the ceiling ever moves, `nextCursor` can be added beside `entries` and every
client built per §6.4 keeps working.

```json
{
  "status": "ok",
  "year": 2026,
  "entries": [
    {
      "id": "cly3k8qv10001s6a1b2c3d4e5",
      "clientMutationId": "9f1c0f2e-7b3a-4a6d-9f21-0b2d4c6e8a10",
      "dayDate": "2026-04-07",
      "portion": "FULL",
      "kind": "CH",
      "absenceReason": null,
      "note": "Bureau Genève",
      "provenance": "DETECTED_CORRECTED",
      "detectedKind": "HOME",
      "detectedAt": "2026-04-07T17:02:11.000Z",
      "clientClaimedAt": "2026-04-07T18:44:02.000Z",
      "firstRecordedAt": "2026-04-07T18:44:09.311Z",
      "lastModifiedAt": null
    }
  ]
}
```

<!-- fields:read -->

| field | may a client assume |
|---|---|
| `id` | Opaque and **stable for the life of the row** — an edit updates in place rather than minting a new one. It is what `EntryEvent.entryId` refers to. It is *not* the reconciliation key: align on `(dayDate, portion)`. |
| `clientMutationId` | **The id of the LAST write the server applied to this row**, not the one that created it. So equality with a pending mutation proves the server applied *your* write; **inequality proves only that the last write was not yours** — it is not an instruction to re-send. On a second device, re-sending on inequality overwrites a newer edit with stale content. |
| `dayDate` | `YYYY-MM-DD`, the same string that was sent. Never an instant. |
| `portion` | `FULL`, `AM` or `PM`. |
| `kind` | One of the five kinds. |
| `absenceReason` | The reason, or `null`. Non-null iff `kind` is `ABSENT`. |
| `note` | The note, or `null`. |
| `provenance` | `MANUAL`, `DETECTED_CONFIRMED` or `DETECTED_CORRECTED`. |
| `detectedKind` | What detection proposed, or `null`. **Survives an edit that does not mention it** — deleting an overridden proposal is a review rejection (SPEC §8). Supplying one replaces it. |
| `detectedAt` | When the proposal was produced, or `null`. Survives an edit alongside `detectedKind`. |
| `clientClaimedAt` | What the client asserted **about the write that produced this row’s current state** — verbatim as sent, or `null` if that write asserted none. **An edit that does not mention it clears it**, and that is not evidence loss: the earlier claim stays on the `CREATED` event in the trail. See §6.3. |
| `firstRecordedAt` | **The server clock at first receipt, and it never moves.** A database trigger rejects any update that changes it. This is the timestamp the *Relevé annuel* rests on. |
| `lastModifiedAt` | **The instant this day was last edited, or `null` if it never was.** Derived from the append-only trail: `max(EntryEvent.recordedAt)` over that entry's `MODIFIED` events. See §6.3 for why it is not `updatedAt`. |

<!-- /fields:read -->

**Every key is always present.** Empty values are an explicit `null`, never an
omitted key: `absent` and `null` differ to kotlinx.serialization and to Moshi,
and a test asserting a field is *undefined* passes both when the server
correctly omits it and when the server has no such field at all.

**Instants are UTC with a `Z` and milliseconds, always.** The client's original
offset on `detectedAt` and `clientClaimedAt` is already lost at write — the
column is `timestamp(3)` — so no change of serialiser recovers it. If a
device's believed zone ever matters evidentially, that is a *column* change,
not an API change.

**Order: `dayDate` ascending, then `FULL`, `AM`, `PM`.** Stated here in words
rather than inherited from the Postgres enum's declaration order, which an
`ALTER TYPE … ADD VALUE … BEFORE` could silently rearrange. Because the sort
key is the natural key, the order is *total*: two calls with no writes between
them return identical arrays.

**The year window is inclusive at both ends** — `YYYY-01-01` through
`YYYY-12-31`, compared as stored calendar days. A half-open upper bound would
compute the next year's first day, and for `?year=9999` that is not a
four-digit day at all: a 500 on an input this route's own rule accepts.

**A year holding nothing is `200` with `"entries": []`, never 404.** "You have
no entries for 2019" is a true and useful answer; 404 says "no such resource",
which is a different claim and would make the client branch on two shapes for
one meaning.

**The query string is strict.** Exactly `year`, once. Any other parameter is
refused with `unknown_parameter` **and the offending keys are named in the
answer** — because this refusal can be triggered by something outside the
client's control, such as a proxy appending a cache-buster, and a total failure
whose cause is invisible is a hunt through somebody else's infrastructure.
Named, it is in the client's own crash report, and the fix stays a one-line
server deploy. Strict → lenient breaks nobody; lenient → strict breaks every
client already sending something we ignored, so it is strict now or never.

**Never cached.** `Cache-Control: no-store, private` and `Vary: Authorization`,
asserted on the served response rather than trusted to route configuration. An
authenticated `GET` is the one shape a framework or a proxy will happily treat
as static, and the failure mode is one person's year served to another.

### 6.3 Three field decisions worth the paragraph

**`detectedKind` on a `MANUAL` row is legal, and the asymmetry is deliberate.**
A `DETECTED_*` row must say what was proposed — the forward rule. The reverse
is not enforced, because auto mode can propose a day, have the proposal expire
unconfirmed, and the reader backfill it later: no proposal was accepted or
corrected, so the provenance is `MANUAL`, and the annex is *more* honest for
recording that detection had proposed something. A later reader must not
"tidy" this into symmetry.

**`lastModifiedAt` is derived from the trail, not from `updatedAt`.** The
obvious implementation is `Entry.updatedAt`, and it is wrong here. Measured:
on a row nobody has edited, `firstRecordedAt` and `updatedAt` differ by about
five milliseconds — `firstRecordedAt` is the batch clock taken once, while
Prisma stamps `@updatedAt` at query execution, several statements later. SPEC
§12 prints the last-modified timestamp **"when different"**, so backing it with
`updatedAt` fires on *every* row and the one thing the column exists to tell a
reader — *was this day edited?* — becomes unreadable in the legal document.
`null` when never modified is a state a reader can act on.

**The API says `lastModifiedAt` while the column is `updatedAt`.** SPEC §8
names the column; SPEC §12 froze the CSV header as *exact and stable* with
`lastModifiedAt`. One published fact gets one published name across the API,
the CSV and the PDF; the column name is an implementation detail that never
leaves the server.

**An edit keeps the proposal and drops the claim, and the asymmetry is the
point.** `detectedKind` and `detectedAt` survive an edit that says nothing
about them; `clientClaimedAt` does not. They are answering different questions.
The detection pair is *what the system proposed and the reader overrode* — a
fact about the record's history that SPEC §8 forbids deleting. `clientClaimedAt`
is *what the client asserted about the write that produced the row as it stands*,
and after an online edit there is no such assertion to report. Nothing is lost
either way: every write's claim is on its own `EntryEvent`, and the trail is
append-only.

This was found by the FW23 walkthrough, not by a test. The row came back with
`clientClaimedAt: null` while this document said "verbatim as sent", which a
client author would reasonably read as *the original claim survives*. The
behaviour was right and the sentence was wrong — and in a frozen contract the
sentence is the thing being frozen.

**`late` now has a home, and it is not this response.** SPEC §12 lists it as a
CSV column and SPEC §11.3 defines the seven-day backfill threshold behind it.
FW24 built that home — `lib/entries/late.ts` — so the dossier, the CSV and the
PDF all read one rule. The field is **not** on this response today; adding it
is additive under §6.3 and can happen the day a client needs it.

A client still **must not** adjudicate lateness against a threshold of its own:
a `7` compiled into an APK is the least revisable constant in this system. It
MAY predict — SPEC §11.3 gives the entry sheet a prospective warning that fires
while the reader is still editing, before any write, which no server value can
supply.

**Lateness is measured against the server's observation, never the client's
claim.** `firstRecordedAt` decides it; `clientClaimedAt` never does, and the
function that computes it has no parameter for one. The reason is who would
benefit from the other choice: a device that could assert an earlier moment
could clear its own late flag, and the annex's whole value is that the server's
timestamp is not negotiable.

**So an entry written offline and synced eight days later is genuinely late,**
and the document says so. That is not a defect of the offline path. The dossier
prints `clientClaimedAt` beside `firstRecordedAt` (SPEC §12 item 5) precisely so
a reader sees the device's account and the server's observation together and
judges the gap themselves — two facts, both shown, neither standing in for the
other.

### 6.4 Replay, ordering, and what is still open

**A replay is recognised by the trail, not by the current row.** The duplicate
check reads `EntryEvent`, which is append-only and records every mutation the
server has ever applied. It does *not* read the day's current
`clientMutationId`, which records only the mutation that wrote it **last**.

The difference is not academic. It was a live data-loss defect until R219:

| | |
|---|---|
| 1 | mutation **A** writes 2026-04-07 as `CH` |
| 2 | mutation **C** edits it to `HOME` |
| 3 | the queue retries **A**, as a queue does when it never received the answer |
| 4 | under the old check **A** looked new, and was applied |
| 5 | the day was `CH` again. **The correction was gone.** |

Log a day in a tunnel, correct it that evening on wifi, let the queue drain
afterwards. That is the whole reproduction. The contract always said what it
says now; what changed in R219 is that it became true.

**What is NOT closed, and a client author should know it.** A *replay* of an old
mutation is refused. A **genuinely new** mutation that arrives late - queued
behind an edit, or sent before one and delivered after - still wins, because
SPEC 13.2 orders writes by **server receipt**. The user-visible symptom is the
same: a day reverts to older content.

Receipt order is the wrong order for an offline queue and `clientClaimedAt` is
the honest one. Changing it is a change to a *stated rule* rather than to an
implementation, so it waits for AN5's evidence about what the queue actually
emits - recorded here rather than decided quietly. Until then: **a client should
not assume the last write it sent is the one the server kept.** Read the year
back after a queue drain.

**AN5 evidence: what the Android queue emits.** The Android client keys its local
store on `(dayDate, portion)` - that pair is the Room entity's primary key - and
recording a day *coalesces* onto that key: a re-record REPLACES the pending row in
place, with a fresh `clientMutationId`, rather than appending a second mutation. So
the queue holds **at most one pending mutation per `(dayDate, portion)`**, and one
worker drains it (unique work, never two concurrently). Two consequences, both from
a *single device*:

- it can never place two items for one `(dayDate, portion)` in a batch, so the
  reserved `conflict` (409) can never fire against it; and
- it can never emit two *out-of-order* mutations for one day, because there is only
  ever one to emit - the older is coalesced away before the newer is queued, or is
  already synced and gone.

So the reversion above is **not reachable from one device**. It requires TWO devices
with two independent queues: device A's older-but-genuinely-new mutation arriving
after device B's newer one, winning by server receipt. No single-device coalescing
can prevent that, because the two mutations never share a queue to coalesce in. The
structural evidence is the Android suite's `OrderingEvidenceTest`
(`aBatchNeverCarriesTwoItemsForOneDayAndPortion`).

The product is single-user and effectively single-device today, so the reversion is
not reachable in practice now. The decision - keep server-receipt order, or move to
`clientClaimedAt` - stays the operator's, unchanged by AN5 (the rule is frozen,
R156); AN5 only supplies the evidence it was parked for.

### 6.5 What a client must do to stay compatible

These are requirements on the *client*, and they cannot be retrofitted to a
version already in the field. If the first Android build gets them wrong, no
field can ever be added to these responses.

- **Ignore unknown keys** when parsing every response. This is what makes
  additive change possible; strict parsing closes the escape hatch before it is
  used.
- **Treat an unrecognised `code` as terminal** for that request, and never
  retry a 4xx. A client that switches exhaustively over today's codes turns the
  next added one into a breaking change.
- **Treat an unrecognised enum value** — a sixth `kind`, a fourth `portion` —
  as opaque and display it rather than crashing.
- **Branch on `code`, never on `message`.** The French is rewritten whenever it
  can be written better.
- **Surface every `warning` a calculation returns, never only the figures.**
  This is the one obligation on this list that is about *honesty* rather than
  about parsing, and it is the easiest to drop because the figures alone look
  complete.

  Only 2026 has a rule set of its own. `ruleSetFor` applies the latest known
  rules to any other year and does **not** refuse — so a calculation for 2019
  is computed under 2026 thresholds. The engine is honest about it: it emits a
  warning naming the year it actually applied. **That warning is the only
  thing standing between an honest answer and a wrong one**, and a client that
  renders the rate while discarding it publishes a figure derived from rules
  that did not exist in the year it claims to describe.

  `lib/dossier` is held to this by three tests, including the negative case so
  a caller that warned unconditionally fails too. Nothing holds a client to it
  but this sentence.

### 6.6 The order of checks is part of the contract

Both routes check in the same order, and it is observable: a request that
breaks two rules is told about the *earlier* one.

| | `POST` | `GET` |
|---|---|---|
| 1 | authenticate | authenticate |
| 2 | bound the body, before parsing | — |
| 3 | scan for coordinates, **before validation** | scan the query string, **before validation** |
| 4 | validate the payload | validate the query |
| 5 | write | read |

**Coordinates are scanned before validation on purpose.** A `?lat=` is *both* a
coordinate and an unknown parameter; a payload carrying `latitude` is also an
unknown key. If validation ran first, every such request would be answered
"unknown field" and the one interesting fact about it — that a client is
sending coordinates — would never be recorded (SPEC §13.1, D18).

The scan covers nested objects, arrays, and any key whose **name contains** a
banned word, case-insensitively. It reads **keys and never values**, so a
coordinate this product refuses to store cannot survive in the error about
refusing to store it, nor in the log line about that error.

### 6.7 One field is altered in one export, and only there

`note` is the only free-text field this API carries, and it is the only field
whose representation differs between surfaces. The difference is deliberate and
narrow, and it is written here so no client author discovers it from a
support ticket.

| surface | what a note opening `=` `+` `-` `@` looks like |
|---|---|
| `GET /api/v1/entries` | **unaltered**, byte for byte |
| the PDF | **unaltered**, byte for byte |
| the CSV export | prefixed with a single apostrophe `'` |

**Why the CSV alone.** Excel and LibreOffice evaluate a cell beginning with one
of those four characters as a *formula*. The threat model is unusual and worth
stating plainly: the attacker and the victim are not the same person. A user
writes their own dossier and hands it to a fiduciaire, so a crafted note would
run in **the accountant's** spreadsheet. It is not a way to reach another user
of this product; it is a way to reach the person the document is *for*.

**Why not everywhere.** Editing a user's words sits badly in a product whose
whole claim is that it reports what was recorded — and the objection dissolves
once you notice the CSV is not the evidence document. The **PDF** is. So the
format that *executes* is defended, and the formats that *are* the record carry
the note exactly as typed. A client that re-displays `note` needs no special
handling; one that re-exports it to a spreadsheet should do what this API does.

**What a client may assume.** That the apostrophe is never part of the stored
value, that it never appears in a payload, and that it will never be stripped
on write — the record keeps what the user typed. Excel consumes the apostrophe
as its text-literal marker and shows the note as written; other readers show one
leading character that was not in the note, which is the visible cost of the
mitigation and the reason it is documented rather than silent.

**The same asymmetry decides where the CSV names its titulaire.** It does not —
not in any column, not in any row. SPEC §12 freezes the CSV header as *exact and
stable*, so an identity column would break every spreadsheet built on it, and a
leading comment row would break RFC 4180 for every reader that is not Excel.

So **the CSV is attributable by its filename alone**:
`releve-<year>-<name-slug>.csv`, in `Content-Disposition`. The slug folds
accents and admits only ASCII letters and digits, because the value is parsed
as an HTTP header and the name is user-controlled.

**The filename carries the titulaire when it can.** A name that slugifies to
nothing — one written entirely in a script the slug does not fold, or in
punctuation — falls back to `releve-<year>.csv`, because a trailing separator
reads as a truncation bug rather than as a missing name. A client must not
assume the person's name is always present in the filename; it must assume the
**year** always is. This is stated rather than left to be discovered, because a
reader told the export is attributable by filename should not meet one where it
is not.

**The CSV is not the document of record — the PDF is**, and the PDF names its
titulaire in its header block where an auditor reads it. A client that needs to
attribute an export reads the filename or, better, the PDF. A client that
re-uploads a CSV somewhere should carry the filename with it: nothing inside
those bytes says whose year it is.

---

---

## 7. Error codes

Stable, ASCII, and **frozen**. The `code` is what a client branches on; the
`message` beside it is French for a human and may be rewritten at any time.

| code | route | status | fires when |
|---|---|---|---|
| `missing_token` | any `/v1` | 401 | no `Authorization: Bearer` header |
| `invalid_token` | any `/v1` | 401 | the token is unknown |
| `expired_token` | any `/v1` | 401 | the access token has expired |
| `revoked_session` | any `/v1` | 401 | the session was ended — sign-out, revoke-all, account deletion, or a detected replay (§2) |
| `payload_too_large` | `POST` | 413 | the body exceeds 256 KiB |
| `malformed_body` | `POST` | 400 | the body is not JSON |
| `coordinates_refused` | both | 400 | a location key appears in the payload or the query string |
| `invalid_payload` | `POST` | 400 | the batch fails validation; `issues[]` names each path and rule |
| `granularity_conflict` | `POST` | 400 | the batch would leave one account-day holding `FULL` beside `AM` or `PM` (§6.1, R490). Nothing was written and no event appended; a client that isolates a multi-item 400 item by item lands the good days and holds the refused one. Additive. |
| `conflict` | `POST` | 409 | **Reserved.** No path produces it today. It is kept for the out-of-order case in section 6.4 should that ruling land: a late write refused rather than silently applied is what a client would need to be told. Until then a client will not see it - and per section 6.5 must still treat it as terminal rather than retrying. |
| `write_failed` | `POST` | 500 | ours. Nothing was written; the whole batch rolled back |
| `invalid_year` | `GET` | 400 | `year` is absent, repeated, or not exactly four digits |
| `unknown_parameter` | `GET` | 400 | a query parameter this route does not read; `parameters[]` names them |
| `read_failed` | `GET` | 500 | ours. The year could not be served **whole**, so it is not served at all |

**Refusals are labelled by the rule that fired, not collapsed into one.** The
exception is deliberate and lives in §1.5: the sign-in and refresh routes
answer identically for every cause, because telling an unauthenticated caller
*which* case fired is the vulnerability.

---

---

## 8. `GET /api/v1/dossier?year=YYYY` — the document as data

**It is placed after the error codes rather than beside §6, deliberately.** The
dossier is not part of the entries resource, and inserting a section between §6
and §7 would renumber §7 — a contract document's headings are addresses, and
moving one to satisfy a reading order is the wrong trade.

**The route assembles nothing.** `lib/dossier` computes and the route
serialises a frozen field list. SPEC §12 makes the Android *Relevé* screen and
the PDF "the same document at two widths", which holds only while one
computation stands behind both — so a figure recomputed anywhere downstream is
a second implementation, and the surface it would eventually disagree with is
the one an auditor reads.

### 8.1 The payload

| field | what it is |
|---|---|
| `taxYear` | the year requested, echoed |
| `period` | `{ fraction, startDate }` — what the figures actually cover |
| `titulaire` | the person's name. Never empty; the route refuses instead |
| `generatedAt` | ISO instant, server-assigned |
| `canton` | the canton of work |
| `employmentRate` | 1–100 |
| `denominatorKind` | `SIMPLIFIED240` or `EXACT` |
| `tiles` | `workedDays`, `swissDays`, `teleworkDays`, `missionDays` |
| `zone` | the rates, both ceilings' headroom, and the **warnings** |
| `months` | twelve rows, with the cumulative declarable rate |
| `annex` | every entry **and every working day without one** |
| `absenceDays` | D28: counted once here and in no other figure |
| `recordedEntries` | how many annex rows carry an entry |
| `creditedMissionDays` | how many mission days were **counted against the annual cap** — France and third state together. Additive (PARKAN-49) |
| `rateWithoutMissions` | the declarable rate with the **missions removed** — telework alone. Additive (PARKAN-49) |

### 8.2 What a client may assume

- **`period.fraction` is the property; `period.startDate` is only today's
  cause.** A fraction below 1 means the basis was prorated and the figures
  cover part of the year. Render the span from `startDate` when it is present,
  and say *partial* when it is not — do **not** key your rendering on
  `startDate` alone, which is how the web document came to print *« Année 2026
  entière »* over prorated figures.
- **`recordedEntries === 0` is not the same as a compliant year.** Both declare
  0 % telework. One means the person logged nothing. A client that renders the
  rate without this distinction shows somebody a clean result for a year they
  never filled in.
- **A year with no day recorded is answered like any other year: `200`, the
  same envelope.** `recordedEntries` is `0`, every `annex` row is
  `recorded: false`, every tile and month counts no day, and
  `zone.declarableRate` is `0` — the engine's answer over the year's own basis,
  which `tiles.workedDays` states and which is positive. It is a computed figure
  over a real denominator, not a placeholder; what keeps the year honest is
  `recordedEntries`, above. The PDF says it in a sentence (§11.4) and the CSV on
  every row (§12.2). This holds for the current year on 1 January too, and for
  the first year of an activity that began partway through it (`period.fraction`
  below 1). FW-DOSSIER-EMPTY.
- **A year that ends before the account's `activityStartDate` is refused, by
  name: `400 year_before_activity`** — on this route, the CSV (§12.3) and the
  PDF (§11.3) alike. It is not an empty year: an empty year has a positive basis
  and is answered above; this one has **none**. Its period is zero, both engines
  refuse a zero period (`PERIOD_OUT_OF_RANGE`), so no rate is defined over it,
  and a 0 % over nothing would be meaningless (§8.3). The activity's *first*
  year is not this year: it is prorated (`period.fraction` below 1) and answered
  `200`. FW-DOSSIER-EMPTY (R580) — it replaced the three different answers the
  first pass measured (`500`, `500`, `422`). The Android client's previous-year
  probe treats any answer that is not a document as "no days", so it needed no
  change.
- **`annex` contains unlogged days.** A row with `recorded: false` carries a
  `dayDate` and nothing else — no portion, no kind, no timestamp. SPEC §12
  item 5 requires them printed rather than skipped.
- **`zone.warnings` must be surfaced, never only the figures** — see §6.5,
  which is the same obligation stated where a client meets it first.
- **`result` is not on the wire.** The engine's own output duplicates four of
  `zone`'s figures, and two sources for one figure inside a frozen contract is
  the drift this document exists to prevent. Its unique fields may be added
  later as named fields (§6.3's additive rule permits it).
- **`creditedMissionDays` is how many missions the rate COUNTED, not how many
  were logged.** The `missionDays` tile is the total recorded; this is how many
  of them fell under the annual cap *and* the ceiling headroom. When the regime
  is lost the two diverge at their most instructive — twelve logged, zero
  counted — and a client that shows the tile without this cannot say why the
  rate did not move. It is the engine's `creditedMissionDays`; a client must not
  recompute it.
- **`rateWithoutMissions` is telework alone, and `rateWithoutMissions <=
  declarableRate` always.** It is the declarable rate the engine returns for the
  same person with the mission rows removed, so it can never exceed the fiscal
  ceiling while telework is under it. Equality means no mission day was
  credited. A client renders it beside `declarableRate`; it does **not** divide
  the tiles to obtain it — that is a second implementation of a figure the
  engine already produced (FW12).

### 8.3 Refusals

| code | status | fires when |
|---|---|---|
| `missing_token` / `invalid_token` | 401 | no bearer, or one that does not resolve |
| `coordinates_refused` | 400 | a location key in the query — checked **first** |
| `unknown_parameter` | 400 | any parameter other than `year`, including a planted `userId` |
| `invalid_year` | 400 | not four digits |
| `future_year` | 400 | a year that has not happened, in Europe/Paris |
| `year_before_activity` | 400 | a year that ends before the account's `activityStartDate`, so its period is zero (§8.2) |
| `titulaire_missing` | 422 | the account has no name, so no document can be attributed |
| `canton_missing` | 422 | the account has no canton, so no year of it can be computed — SPEC §7 resolves the regime from the canton, and no default is right for everybody |
| `read_failed` | 500 | ours: the year could not be built |

**`future_year` is its own code and not `invalid_year`.** The engine would
answer for 2031 — a full basis, nothing logged, 0 % declared — and that answer
is not so much wrong as *meaningless*, which is worse, because it looks like a
compliant year. `invalid_year` would send a client author to check their
parser.

**`year_before_activity` is a refusal for the same reason, from the other
end.** A year that has not happened and a year before the work began are both
years with no meaningful figure. Over the second there is not even a basis:
neither engine defines a rate over zero working days — both refuse the period —
and a 0 % would be meaningless, so none is invented and no `200` is served.
FW-DOSSIER-EMPTY (R580). It answered `500 read_failed` before.

**`canton_missing` names a settings gap that used to answer `500
read_failed`**, the code that sends a reader to the database for something the
account's own settings fix (R198). FW-DOSSIER-EMPTY (R583). The PDF route names
the same state `dossier_incomplete` (§11.3).

**Both carry a French `message` of their own** (FW-DOSSIER-EMPTY-3, R587), on
this route and on the CSV — and `year_before_activity` on the PDF too. Until
then they lent other codes' sentences: `year_before_activity` carried
`invalid_year`'s, which calls a well-formed year malformed, and `canton_missing`
`read_failed`'s, which promises a retry that cannot succeed. The first now names
the year asked for and says it ends before the activity began; the second sends
the reader to the canton in their settings. The text lives in
`AUTH_API_COPY` and is not repeated here; a client still branches on the `code`
(§1.4).

**When an account has more than one gap, the canton is named first**: the
dossier checks the canton, then the period, then the name, so an account with
no canton asking for a year before its activity start is told
`canton_missing`, here and on the CSV. The PDF route checks the name before it
builds anything (§11.2), so there a nameless account is told
`titulaire_missing` first.

**"Has not happened" is read in Europe/Paris**, the clock of every calendar day
elsewhere in this contract and the one a Paris-dated client asks by. At 00:30 on
1 January in Paris — 23:30 UTC on 31 December — the new year is the current
year and answered (§8.2's empty year), and the year after it is still
`future_year`. It read the server's UTC clock until FW-DOSSIER-EMPTY (R582), and
for that first hour refused the year the reader was in.

---

## 9. `/api/v1/me` — settings

`GET` returns the configuration fields and the holder `name`. `PATCH` accepts any
subset of them, refuses an unknown key rather than stripping it, and refuses an
empty body.

**`email` is not a setting and is not returned.** The address is the fact §1.5
goes to some length to keep a sign-in form from confirming; a settings endpoint
handing it back on every poll would be the same leak through a quieter door.

**`name` IS settable and returned (AN-ONBOARD).** It is the document's titulaire
(§8) and onboarding's first step; it is returned so a re-sign-in on a new phone
can skip that step when a name already exists. It is the owner's own data behind
their own bearer token — not the leak the email would be. A name that trims to
nothing is refused (`invalid_body`): the dossier and the PDF refuse to generate
without a titulaire (§8.3, §11.3), so it is caught at the door rather than stored
to fail later.

### 9.1 The fields

| field | `GET` | `PATCH` | notes |
|---|---|---|---|
| `name` | ✓ | ✓ | the titulaire; trimmed, non-empty, ≤ 120 chars |
| `canton` | ✓ | ✓ | one of the 26 codes |
| `employmentRate` | ✓ | ✓ | 1–100, enforced by the database |
| `denominatorKind` | ✓ | ✓ | `SIMPLIFIED240` or `EXACT` |
| `exactTotalWorkDays` | ✓ | ✓ | required iff `EXACT`; `null` clears it |
| `granularity` | ✓ | ✓ | `DAY` or `HALF_DAY` |
| `activityStartDate` | ✓ | ✓ | `YYYY-MM-DD` or `null` |
| `reminderTime` | ✓ | ✓ | `HH:mm`, wall clock |
| `reminderEnabled` | ✓ | ✓ | |
| `loggingMode` | ✓ | ✓ | `MANUAL` or `AUTO_DETECT` |
| `detectionConsentAt` | ✓ | — | server-assigned; see §9.3 |
| `detectionConsent` | — | ✓ | boolean; grants or revokes |

### 9.2 What a client may assume

- **`activityStartDate` is a day, not an instant** — `YYYY-MM-DD`. Sending a
  timestamp is refused. A client that rendered a midnight-UTC instant would
  show the day before for half the year in Paris.
- **`reminderTime` is a wall-clock `HH:mm`**, not an instant: *half past five
  where the reader lives*, on both sides of a DST boundary.
- **The invariants are enforced by the database, and named here.**
  `employment_rate_out_of_range` and `exact_total_required` are refusals a
  client can act on. SPEC §8 states both rules and R196 put them in the schema
  so they survive a writer that does not know they exist — this route is one
  such writer, and a third copy of the bound in the API would be the defect
  rather than the safety net it resembles.

### 9.3 Consent, in both directions

A client sends **`detectionConsent: true | false`**. It never sends
`detectionConsentAt`: timestamps are server-assigned throughout this product,
and a client that could name the moment it consented could name one it did not.

| request | effect |
|---|---|
| `detectionConsent: true` | `detectionConsentAt` stamped now |
| `detectionConsent: false` | stamp cleared **and `loggingMode` forced to `MANUAL`** |
| `loggingMode: AUTO_DETECT` with no consent | refused, `consent_required` |
| `loggingMode: AUTO_DETECT` **and** `detectionConsent: true` together | accepted |

**Revocation forcing `MANUAL` is server-side and is not a request the client
may decline.** SPEC §13 forbids detection without consent, so a row carrying
`AUTO_DETECT` beside a null stamp is the forbidden state written down — and a
setting that says one thing while the system does another is found out by the
person who revoked it.

**Revoking while already on `AUTO_DETECT` is never refused.** It is the one
thing revocation must always be permitted to do; refusing it would make
stopping data collection take two requests, which is the persuasion D19 exists
to forbid.

---

## 10. `POST /api/v1/devices` — where a phone says to send its reminders

Added in FW27. One call, made after sign-in and on every launch afterwards.

```
POST /api/v1/devices
Authorization: Bearer <access token>
Content-Type: application/json

{ "fcmToken": "…", "platform": "android", "appVersion": "1.5.0" }
```

| field | required | notes |
|---|---|---|
| `fcmToken` | yes | 1–4096 characters. The FCM registration token. |
| `platform` | no | `android`, which is also the default. A closed set, not a free string. |
| `appVersion` | no | 1–40 characters. A token is worth registering from a build that does not know its own version. |

The response is the stored row **without the token**:

```json
{ "id": "…", "platform": "android", "appVersion": "1.5.0", "lastSeenAt": "2026-07-07T15:30:00.000Z" }
```

### 10.1 The token moves to whoever is signed in

`Device.fcmToken` is unique, and a registration token belongs to an **app
install**, not to a person. One phone lent, sold, or simply signed out of and
into a second account produces the same token arriving under a different id.

**The row is reassigned to the caller.** If it kept its first owner, the
previous person's reminders would go on arriving on a phone that is now
somebody else's — a notification naming a day they are no longer logging, on a
device they no longer hold.

It follows that **possession of a token is not authority over an account**.
Nothing on this route reads the token to decide who is calling; that comes from
the bearer header and from nowhere else. Registering a token another phone
reported tells the server only where to send *your* reminders, and the person
who still holds that phone takes it back on their next launch.

### 10.2 Re-registering is idempotent

A client registers on every launch. The same token twice leaves **one row**,
with `appVersion` and `lastSeenAt` refreshed. `lastSeenAt` is server-assigned,
like every timestamp in this product.

### 10.3 What it refuses

| body | code |
|---|---|
| not JSON | `malformed_body` |
| missing or empty `fcmToken`, unknown field, wrong `platform` | `invalid_body` |
| any latitude, longitude, altitude or speed key | `coordinates_refused` |
| no bearer, or a bearer that does not resolve | 401, with the usual auth code |

**Unknown fields are refused rather than stripped**, for the reason the entries
route refuses unknown parameters: a client that misspells a field and receives
200 has been told its change was saved. A device model, an advertising id, a
locale or a timezone are all unknown fields.

**The coordinate refusal names the keys and never the values.** A coordinate
this product refuses to store must not survive inside the error message about
refusing to store it.

### 10.4 When a token is deleted

Only when the push service says it is gone — **404 or 410, and nothing else**.

A 401, a 403, a 429, a 500, a 503 or a network error leaves the row alone and
costs one missed reminder. Pruning on any of those would empty the table during
a credential outage or a quota incident, and the symptom — somebody quietly
stops receiving reminders, months before they mention it — is about as far from
its cause as a symptom gets. The rule is a whitelist of two statuses rather
than a list of exceptions, so a status nobody anticipated keeps the row.

There is **no `DELETE`**. Signing out revokes the session; the token is pruned
when the service reports it dead, and deleting the account removes the row with
everything else (D11).

---

# The four routes this contract did not describe

**Added by FW31. THE FREEZE IS UNAFFECTED, and that sentence is the point of
this heading.** FW23 froze this contract, and R187 extended to routes makes a
rename a migration plus an app release plus every version still calling the old
shape. Writing down a route that has been served all along is **not** a change
to the contract and **not** a version bump: nothing here is new, nothing here
moved, and no client that works today stops working. What changes is that these
four are now inside the freeze rather than outside it.

They were found by FW30's adversarial audit, which compared the routes this
document describes against the routes `app/api/v1/**/route.ts` actually
serves and found **nine of thirteen**. The missing four were
`/api/v1/export/pdf` — the *Relevé annuel* itself, the product's reason to
exist — `/api/v1/export/csv`, and both GDPR rights paths.

**The omission is now impossible rather than merely corrected.**
`web/tests/unit/meta/api-contract.test.ts` derives the route set from the
filesystem, because that is what Next routes from, and fails on any route this
document does not mention — and, in the other direction, on any path this
document mentions that nothing serves. A hand-kept list would have been correct
on the day it was written and would then have drifted in exactly the way it did.

---

## 11. `GET /api/v1/export/pdf?year=YYYY` — the document as a file

Added in FW25b. **Appended rather than inserted beside §6.7's CSV paragraph**,
for the reason §8 gives: a contract document's headings are addresses, and
renumbering §7 to group the two exports together would move one.

**The success answer is bytes, not JSON.** Every other route in this document
answers JSON on both sides. Here a 200 carries `application/pdf` and only the
refusals are JSON. A client that parses every response as JSON is broken on the
one path that worked.

```
GET /api/v1/export/pdf?year=2026
Authorization: Bearer <access token>
```

The query string is the same one §6.2 specifies, read by the same module:
exactly `year`, once, exactly four ASCII digits. There is no other parameter,
and there is no request body.

| header on a 200 | value |
|---|---|
| `Content-Type` | `application/pdf` |
| `Content-Disposition` | `attachment; filename="releve-<year>.pdf"` |
| `Cache-Control` | `no-store, private` |
| `Vary` | `Authorization` |

**Never cached**, for §6.2's reason: an authenticated `GET` is the one shape a
proxy will happily treat as static, and the failure mode is one person's year
served to another.

### 11.1 The route does not build a PDF — it prints the page that *is* the document

`/releve/print` is the document. This route drives headless Chromium at it and
returns what comes back. **One renderer, one layout, no drift.** A PDF library
beside the page would be a second implementation of the same document, and the
browser and the accountant would then be reading two things that agree only for
as long as somebody keeps them agreeing.

Chromium is a separate process and does not share this request's
`Authorization` header, so the route **mints what the print route already
accepts**: a token signed with `AUTH_SECRET`, scoped to one person *and one
year*, living 120 seconds. The browser then makes an ordinary anonymous request
that happens to carry a capability. The credential was already in a URL before
this route existed — a human opening the rendered dossier in a browser sends no
`Authorization` header — so this inherits that decision rather than adding a
second one.

**None of it is visible to a client.** The print token never reaches the caller,
`/releve/print` is not part of this contract, and the URL the browser fetches is
built from **this request's own origin** rather than from a configured public
address: behind a proxy, a configured one would send the render out through the
internet and back.

The handler declares `runtime = 'nodejs'` explicitly. Playwright drives a child
process and touches the filesystem, and the edge runtime can do neither — stated
rather than inherited, because the default moving would be a deployment failure
rather than a compile error.

### 11.2 The order of checks, and why it earns its keep here more than anywhere

Both entries routes check in the order §6.6 sets out. This route adds two steps
before the expensive one, and the order is observable the same way: a request
that breaks two rules is told about the earlier one.

| | |
|---|---|
| 1 | authenticate |
| 2 | scan the query string for coordinates, **before validation** |
| 3 | validate the query |
| 4 | the account has a titulaire |
| 5 | a signing key exists |
| 6 | take the render slot, then render |

**Steps 1–5 cost microseconds; step 6 costs a browser.** One render was measured
at 279.9 MB resident across four processes, so validating the year after
launching Chromium would mean one malformed request paying ~300 MB to discover
the year was `abc`.

**The titulaire check is here rather than inside the render**, and that is not
an optimisation. A document with no identified titulaire cannot be produced at
all (SPEC §12 item 1), so discovering it inside Chromium would cost a render
*and* report `renderer_unavailable` — a code that sends whoever reads the log
hunting a missing binary (R198). The predicate is the one `buildDossier` refuses
with, not a second reading of what a blank name is.

**Coordinates are scanned before validation** for §6.6's reason: a `?lat=` is
*both* a coordinate and an unknown parameter, and if validation ran first the one
interesting fact about the request — that a client is sending coordinates —
would never be recorded (SPEC §13.1, D18). The log line names the keys and never
the values.

### 11.3 Refusals

| code | status | fires when |
|---|---|---|
| §1.4's auth codes | 401 | no bearer, or one that does not resolve; `WWW-Authenticate: Bearer` |
| `coordinates_refused` | 400 | a location key in the query — checked **first** |
| `unknown_parameter` | 400 | any parameter other than `year`; `parameters[]` names them |
| `invalid_year` | 400 | `year` absent, repeated, or not exactly four digits |
| `titulaire_missing` | 422 | the account has no name, so no document can be attributed |
| `not_configured` | 503 | `AUTH_SECRET` is unset or is the placeholder `.env.example` ships |
| `year_before_activity` | 400 | a year that ends before the account's `activityStartDate` — §8.3's code, checked **before** a browser is launched |
| `dossier_incomplete` | 422 | the dossier for that year could not be built, checked **before** a browser is launched — an account with no canton (the state §8.3 and §12.3 name `canton_missing`) |
| `renderer_busy` | 503 | one render is running and both waiting places are taken; `Retry-After: 30` |
| `renderer_timeout` | 503 | waited 30 s for a slot without reaching the front; `Retry-After: 60` |
| `renderer_unavailable` | 503 | Chromium would not start, or the print route did not answer 200 |
| `renderer_unstyled` | 503 | the page rendered without its stylesheet |
| `renderer_fontless` | 503 | the stylesheet arrived and the webfont behind it did not |
| `read_failed` | 500 | ours. Anything else the render threw |

**Busy and timed-out are not the same fact**, and a client should act on them
differently: turned away at the door means retry shortly; waited and gave up
means the machine is saturated and backing off is right. That is what the two
`Retry-After` values say, and a `Retry-After` is what turns a 503 into an
instruction — without one a client either gives up or hammers, and both are
worse than waiting. **The other four 503s carry no `Retry-After` at all**, and a
client must not wait on a header that is not there.

**Six 503s where one would do**, because each sends whoever reads it somewhere
else (R198): a missing signing key, a full waiting room, a wait that ran out, a
browser that would not start, a stylesheet that did not arrive, and a font that
did not. Collapsing them into *"export failed"* would make the cheapest of these
indistinguishable from the most expensive.

**`renderer_unstyled` and `renderer_fontless` are refusals, not degradations,**
and that is the decision worth defending. A document whose CSS failed to load
still contains every word, every table row and every figure; one in the fallback
face is correctly laid out and fully legible. Both pass every structural
assertion anybody has written, and both are unfilable. So the renderer
establishes presence — a known design token resolves, and the family the page
asks for actually loaded — before it prints, and refuses rather than emitting a
document nobody looked at. It is R205's rule on a renderer: served only when it
can be believed, not when it can be parsed.

**`renderer_unavailable` also covers a print route that answered anything but
200.** That is no longer how an *account* state reaches it: since FW-VERIFY the
route builds the dossier itself before it launches a browser (the issuance
record's figures are read from it), so a named account that has never set a
canton is refused `422 dossier_incomplete` without a render, and a year before
the activity start `400 year_before_activity`. This paragraph used to say such an
account was told `renderer_unavailable`; FW-DOSSIER-EMPTY measured the route
and corrected it.

**`dossier_incomplete` and `canton_missing` are one condition under two
names.** An account with no canton cannot have any year computed; the dossier
and the CSV name that `canton_missing` (§8.3, §12.3), and this route keeps the
code it already answered for it, `dossier_incomplete`, which it also answers for
any other failure to build the dossier. The code is not renamed, because
renaming a code is one of the three things §6 forbids (FW-DOSSIER-EMPTY, R583).
A client that wants to say *"set your canton"* reads it from the dossier
route, where the condition has its own name.

**A year before the activity start moved from `422 dossier_incomplete` to `400
year_before_activity`, and that move is additive under §6's own terms.** §6
forbids exactly three things — renaming a field or code, removing one, and
changing what an existing one means. None happened: `dossier_incomplete` is
neither renamed nor removed and still answers the account with no canton; a new
code was added beside it; and 422 → 400 stays *within* the 4xx class, which §6
lists as free. The one meaning that narrowed was never published: until
FW-DOSSIER-EMPTY this document did not list `dossier_incomplete` at all, and
the first pass recorded this year's answers as an open question no client was
to build on. A client written to §6.5 treats an unrecognised code as terminal
and never retries a 4xx, so it treats the new answer exactly as it treated the
old one. FW-DOSSIER-EMPTY (R580).

**From the titulaire check onward the French message is the same one**
(`AUTH_API_COPY.readFailed`, also §8.3's), while the three earlier refusals each
carry their own — with one exception since FW-DOSSIER-EMPTY-3 (R587):
`year_before_activity` carries §8.3's own message for it. That sentence tells the reader the app will retry, which is
true of a busy renderer and false of an account with no name — the sharpest
available argument for §1.4's rule that a client branches on the `code` and
never on the French.

### 11.4 What a client may assume

- **The filename carries the year and never the name.** `releve-<year>.pdf`,
  always, with no slug. §6.7 makes the CSV attributable by its filename alone
  because nothing inside those bytes says whose year it is; the PDF does not need
  that, because it names its titulaire in its header block where an auditor
  reads it. **A client that attributes an export by parsing a filename must not
  apply the CSV's shape to this one** — the two exports differ here deliberately.
- **`note` reaches the PDF unaltered**, byte for byte. The apostrophe prefix
  §6.7 describes is the CSV's alone, for the reason given there: the format that
  *executes* is defended, and the format that *is* the record carries what the
  user typed.
- **Bounded, not rate-limited.** One render at a time, at most two waiting.
  FW30's adversarial audit fired five concurrent exports and measured
  `503 503 200 200 200`. A person pressing the button twice is the realistic
  burst and is served; the sixth is refused by name rather than joining an
  unbounded queue that converts memory pressure into latency and then into an
  OOM anyway.
- **A 503 here is never an authentication problem**, and none of the six should
  trigger a refresh, a sign-out, or a prompt to sign in again.
- **Six of these codes appear nowhere else in this document** —
  `not_configured` and the five `renderer_*`. That is precisely the case §6.5's
  rule exists for: treat an unrecognised `code` as terminal for that request, and
  never retry a 4xx.
- **§8.3's `future_year` has no counterpart here.** `GET /api/v1/dossier?year=2031`
  is refused 400; the same year on this route is not refused on that ground — it
  authenticates, validates, mints a token and is handed to the renderer. A client
  must not infer one route's refusals from the other's. (Its sibling
  `year_before_activity` *does* have a counterpart here, and on the CSV: all
  three routes build the same dossier, and it is the dossier that refuses.)
- **The PDF does not carry the engine's warnings.** `zone.warnings` is on the
  dossier payload (§8.1) and nothing on the printed document renders it, so the
  obligation §6.5 and §8.2 both state — surface every warning, never only the
  figures — is one a client discharges from the dossier response, not by handing
  somebody the file.
- **A year with no day recorded is a document, issued like any other.** The
  file is produced (`200`) and opens with one sentence saying no day is
  recorded for that year, and that its rates are computed over zero days and
  do not describe the person's situation (`DOSSIER_COPY.emptyYear`, keyed on
  `recordedEntries === 0` — so a year holding only absences does not say it).
  Its issuance is recorded exactly as for any year: a verification code, and the
  hash of the bytes returned. FW-DOSSIER-EMPTY (R516; the wording is R585's).

## 12. `GET /api/v1/export/csv?year=YYYY` — the annex as a spreadsheet

Added in FW25. One year, one file, handed to a fiduciaire.

```
GET /api/v1/export/csv?year=2026
Authorization: Bearer <access token>
```

```
200 OK
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="releve-2026-camille-rey.csv"
Cache-Control: no-store, private
Vary: Authorization
```

**A success is CSV and a refusal is JSON.** Every error on this route carries
the usual `{ "status": "error", "code", "message" }` envelope, so a client
branches on the status *before* it touches the body — a parser pointed at the
body first will meet two different formats on one route.

**The query string is §6.2's, parsed by the same function.** `year`, once,
exactly four ASCII digits, every other parameter refused **and named**. Not a
second year parser that agrees until the day one of them learns something
(R206) — the same `parseReadQuery` the entries read path and §8 use.

### 12.1 It is the dossier's annex, serialised — not a second query

The route builds the same dossier §8 returns and writes `annex` out as rows. It
does not query entries itself, and that is a decision rather than convenience:
the CSV and the evidence annex bound the same property — *which days are in
this year* — from opposite sides (R175), and a `findMany` of its own would be a
second answer to that question, diverging the day either changed its window. A
test asserts the two carry the same day set, having first established that the
set is non-empty.

Four consequences a client author should have in front of them:

- **A year with nothing logged is not an empty file.** The annex's universe is
  every Monday-to-Friday of the year, *union* the days actually logged, because
  SPEC §12 item 5 requires a day with no entry to be printed rather than
  skipped. So an untouched year exports one row per weekday with the day filled
  and the rest of the columns empty. A **weekend** day that carries an entry
  still appears; **public holidays are not excluded**, because this product does
  not know a canton's holiday calendar and inventing one would be a second
  source of truth about what a working day is.
- **A gap row is recognised by its empty columns, not by a marker.** The
  `recorded` flag §8.2 tells a client to read is **not** a CSV column: SPEC §12
  froze the columns and that is not one of them. A reader tells an unlogged
  day by `portion` being empty.
- **`late` is `false` on a gap row, and there it means "no late recording",
  not "recorded on time".** Nothing was recorded, so nothing can be late.
- **It is not a sync format.** No `id`, no `clientMutationId` — a client
  reconciling state reads §6.2 and aligns on `(dayDate, portion)`, as it does
  everywhere else in this contract.

### 12.2 The columns, and the file around them

SPEC §12's columns, exact, stable, and in SPEC §12's order. The header
line and the row builder are written from one list, so a column added to one
cannot go missing from the other.

| column | what a client may assume |
|---|---|
| `dayDate` | ISO `YYYY-MM-DD`, always, and never a locale format. `03/04/2026` means a different day depending on who opens it; ISO is unambiguous everywhere and sorts chronologically **as text**, so a reader who sorts the column without parsing it still gets the year in order. |
| `portion` | `FULL`, `AM` or `PM` — **empty on an unlogged day**, which is what identifies one. |
| `kind` | One of the five kinds, or empty on an unlogged day. |
| `absenceReason` | The reason, or empty. Non-empty iff `kind` is `ABSENT`. |
| `provenance` | `MANUAL`, `DETECTED_CONFIRMED` or `DETECTED_CORRECTED`, or empty. |
| `detectedKind` | What detection proposed, or empty. |
| `note` | The note — **the one column altered on its way into this file**. §6.7 says what is done to it, and why it is done here and nowhere else. |
| `firstRecordedAt` | The server clock at first receipt, as a full ISO instant with a `Z` and milliseconds — distinguishable from a day at a glance. Empty on an unlogged day. |
| `lastModifiedAt` | When the day was last edited, or empty if it never was. Derived from the append-only trail, not from `updatedAt`; §6.3 says why that distinction is load-bearing in a legal document. |
| `clientClaimedAt` | What the client asserted about the write that produced this row, or empty. §6.3 says what an edit does to it. |
| `late` | The literal `true` or `false`, the same two words in every row. Not Excel's localised `VRAI`/`FAUX`: the file is read by other tools too, and a spreadsheet can filter on either. It is SPEC §12.3's rule — more than seven days between the day and its first recording — computed in `lib/entries/late.ts`, the one home §6.3 names, which the dossier, the CSV and the PDF all read. |

**The file begins with a UTF-8 BOM.** Three bytes whose whole job is to stop
Excel reading UTF-8 as its ANSI code page and turning *Détection corrigée* into
mojibake. They are invisible to anything that decodes UTF-8 properly —
including `Response.text()`, whose decoder strips a leading BOM, which is why
the test that asserts it reads the bytes rather than the string.

**Records end with CRLF**, including the last one: RFC 4180, and the ending
several readers expect rather than a file that stops mid-record.

**Quoting is RFC 4180 plus the semicolon.** A field containing a comma, a
double quote or a line break is wrapped in quotes and an embedded quote is
doubled. A semicolon is quoted too, which the standard does not require —
several European Excel locales use `;` as their delimiter, and a note
containing one would otherwise split the row there. Nothing else is quoted, so
the file reads as a document in a text editor rather than as a wall of
quotation marks.

**A null is an empty cell, never the word `null`.**

**A year with no day recorded is a file, not a refusal**: the header, then one
row per working day of the year, every one with an empty `portion`. The CSV
carries no sentence saying so, as the PDF does (§11.4) — its columns are SPEC
§12's and frozen, and a prose row would break RFC 4180 for every reader that is
not Excel (§6.7) — so the empty `portion` on every row is how this file says it.

**Order is `dayDate` ascending, then `FULL`, `AM`, `PM`** — §6.2's order,
because these are §6.2's rows. **The year window is inclusive at both ends**,
`YYYY-01-01` through `YYYY-12-31`, built by the same function the read path
uses rather than by a window re-derived here.

**Never cached**, for §6.2's reason and asserted on the served response: an
authenticated export is the one shape a proxy will happily treat as static, and
the failure mode is one person's year served to another.

### 12.3 What it refuses

| code | status | fires when |
|---|---|---|
| the auth codes of §1.4 | 401 | no bearer, or one that does not resolve; the response carries `WWW-Authenticate: Bearer` |
| `coordinates_refused` | 400 | a location key in the query string — checked **first**, before the year is even looked at |
| `unknown_parameter` | 400 | any parameter other than `year`; `parameters[]` names them |
| `invalid_year` | 400 | `year` is absent, repeated, or not exactly four digits |
| `year_before_activity` | 400 | a year that ends before the account's `activityStartDate` — §8.3's code and reason |
| `titulaire_missing` | 422 | the account has no name, so no document can be attributed |
| `canton_missing` | 422 | the account has no canton — §8.3's code and reason |
| `read_failed` | 500 | ours. The year could not be built, so nothing is served |

**The check order is §6.6's `GET` column, unchanged**: authenticate, scan for
coordinates *before* validation, validate the query, read. It is observable —
`?year=2026&latitude=46.2` is answered about the coordinate, and so is the same
request with a malformed year, because a location key is *also* an unknown
parameter and only one of those two facts is worth recording (SPEC §13.1, D18).

**`titulaire_missing` is 422 and its own code**, for §8.3's reason: a document
that cannot be attributed is not a relevé, and the remedy is to set a name
rather than to go looking at the database. Note that the `message` beside it is
**`read_failed`'s**, which tells the reader the days could not be read and that
the application will try again — so a client that renders the French instead of
branching on the code promises a retry that cannot succeed. The code is the
contract and the message is free (§1.4); this is where that split costs
something.

**There is no `future_year` here, and §8.3 has one.** Both routes build the
same dossier through the same loader, and only the dossier route refuses a year
that has not happened. `?year=2031` is served by this route: 200, one gap row
for every weekday of 2031, every `late` false. Written down because a client
author reading §8.3 would reasonably expect the pair to agree.

**`read_failed` covers more than a database being down.** The account row
vanishing mid-request lands here. An account with **no canton** and a year that
ends before the account's activity start used to land here too, through paths
with no code of their own; since FW-DOSSIER-EMPTY (R580, R583) they are
`canton_missing` and `year_before_activity`, the same codes §8.3 answers,
because this file is that dossier's annex.

### 12.4 What §6.7 already settles, and is not repeated here

Two facts about this route live in §6.7, where the decision that produced them
is explained: **the apostrophe prefixed to a note beginning `=` `+` `-` `@`**,
applied in this file and on no other surface, and **the filename**,
`releve-<year>-<name-slug>.csv`, which is the only place this export names
whose year it is. A client author writing an export screen should read §6.7
before this table: the bytes themselves carry no identity at all, and the CSV
is not the document of record.

---

## 13. `GET /api/v1/account/export` — everything, for one person

Added in FW26. **This is where `/confidentialite` becomes code**: the privacy
notice has said since FW10 that a person can take their record with them, and
this is the route that hands it over.

```
GET /api/v1/account/export
GET /api/v1/account/export?format=csv
Authorization: Bearer <access token>
```

**It is not scoped to a year**, where §6.2 fetches a year, §8 computes one and
`/api/v1/export/csv` serialises one. The module behind it opens *"everything
this product holds about one person"*, and every read in it is
`where: { userId }` with no date bound at all.

**There is no schema behind this route.** One optional parameter, `format`,
compared against two literals; every other parameter is refused by name. The
effect is §6.2's strictness — a parameter the route does not read is a refusal
rather than a silent drop — reached in code rather than through a validator,
and no comment says why.

### 13.1 Two formats, and one of them is not the record

| | |
|---|---|
| `?format=json`, and the default | settings, entries, **the trail**, devices, reminders and sessions |
| `?format=csv` | the entries alone, through the dossier's own serialiser |

**A spreadsheet holds one table and the export is six.** So the format that
cannot carry the record carries the part of it a person is most likely to open,
and the JSON stays the one that is complete. **The two are not equivalent
downloads** and a client that offers both should not present them as though
they were.

Both are `Content-Disposition: attachment`, both `Cache-Control: no-store,
private` with `Vary: Authorization`. This is an authenticated `GET` of one
person's entire record — the one shape a framework or a proxy will happily
treat as static, and the failure mode is one person's record served to another.

### 13.2 The JSON payload

**There is no `status` envelope.** The 200 body is the export itself, not
`{ "status": "ok", … }`. A client that asserts `status === "ok"` on every 200
in this API breaks on this route. The top level is still an **object**, so
§6.2's one irrecoverable decision is honoured: it can gain a sibling key.

```json
{
  "exportedAt": "2026-07-07T15:30:00.000Z",
  "settings": {
    "canton": "GE",
    "employmentRate": 100,
    "denominatorKind": "SIMPLIFIED240",
    "exactTotalWorkDays": null,
    "granularity": "HALF_DAY",
    "activityStartDate": null,
    "reminderTime": "17:30",
    "reminderEnabled": true,
    "loggingMode": "MANUAL",
    "detectionConsentAt": null
  },
  "entries": [
    {
      "dayDate": "2026-03-05",
      "portion": "AM",
      "portionLabel": "Matin",
      "kind": "ABSENT",
      "kindLabel": "Absence — autre",
      "absenceReason": "MALADIE",
      "absenceLabel": "Absence — maladie",
      "note": null,
      "provenance": "DETECTED_CORRECTED",
      "provenanceLabel": "Détection corrigée",
      "detectedKind": "CH",
      "firstRecordedAt": "2026-03-05T18:44:09.311Z",
      "clientClaimedAt": "2026-03-05T18:44:02.000Z",
      "clientMutationId": "9f1c0f2e-7b3a-4a6d-9f21-0b2d4c6e8a10"
    }
  ],
  "trail": [
    {
      "action": "CREATED",
      "recordedAt": "2026-03-05T18:44:09.311Z",
      "dayDate": "2026-03-05",
      "portion": "AM",
      "portionLabel": "Matin",
      "kind": "ABSENT",
      "kindLabel": "Absence — autre",
      "provenance": "DETECTED_CORRECTED",
      "provenanceLabel": "Détection corrigée",
      "detectedKind": "CH",
      "clientClaimedAt": "2026-03-05T18:44:02.000Z",
      "clientMutationId": "9f1c0f2e-7b3a-4a6d-9f21-0b2d4c6e8a10"
    }
  ],
  "devices": [{ "platform": "android", "createdAt": "2026-01-12T08:02:44.120Z" }],
  "reminders": [{ "sentOn": "2026-03-05", "sentAt": "2026-03-05T16:30:00.000Z" }],
  "sessions": [
    {
      "createdAt": "2026-01-12T08:02:41.007Z",
      "lastUsedAt": "2026-07-07T15:29:58.441Z",
      "revokedAt": null,
      "revokedReason": null
    }
  ]
}
```

| key | what it is | order |
|---|---|---|
| `exportedAt` | when the file was produced. Server clock, like every stamp in this product | — |
| `settings` | §9.1's ten fields, through the same serialiser `/api/v1/me` uses | — |
| `entries` | one row per recorded day-portion, **every year** | `dayDate` ascending, then `FULL`, `AM`, `PM` |
| `trail` | every `EntryEvent` | `recordedAt` ascending |
| `devices` | one row per registered device | `createdAt` ascending |
| `reminders` | one row per reminder actually sent | `sentOn` ascending |
| `sessions` | every sign-in ever made, including the ended ones | `createdAt` ascending |

**Everything is ordered, so two exports of an unchanged account differ only in
`exportedAt`.** An export that shuffled its rows between downloads would be
impossible to diff, which is the first thing somebody checking a record does.

**The trail is in it, and that is the point.** Entries alone are a list of days
the person already knows. What makes the record worth having is when each day
was first recorded, when it was edited and what it was before — the layer SPEC
§12 calls what makes the document evidence rather than assertion. An export
without it is a claim the person cannot check.

**Every code travels with the word for it.**

| code | word beside it | the words |
|---|---|---|
| `portion` | `portionLabel` | *Journée entière*, *Matin*, *Après-midi* |
| `kind` | `kindLabel` | *Suisse*, *Domicile*, *Mission en France*, *Mission pays tiers*, *Absence — autre* |
| `absenceReason` | `absenceLabel` | *Absence — congé*, *— maladie*, *— jour férié*, *— autre* |
| `provenance` | `provenanceLabel` | *Saisie manuelle*, *Détection confirmée*, *Détection corrigée* |

The first version shipped the codes alone, and **reading it as a person found
the defect the row counts could not**: a French reader opening their own data
met English-ish enum tokens, in a product whose every other surface is
carefully French. The code stays, because an export is also machine-readable
and somebody re-importing it elsewhere needs the stable token. The word is
added beside it — both, rather than either.

The words come from `DOSSIER_COPY` (R206), so an export and the PDF cannot
describe the same day differently. A code with no word in the table serialises
**as itself**, never as `null`.

**`kindLabel` on an `ABSENT` row always reads *« Absence — autre »*, and the
reason carries the specific word.** A sick day is `kind: "ABSENT"`,
`kindLabel: "Absence — autre"`, `absenceReason: "MALADIE"`,
`absenceLabel: "Absence — maladie"`. A client that renders `kindLabel` alone
shows every absence as *autre*. It is stated here because it reads as a defect;
`tests/db/account-export.test.ts` pins exactly this on a `MALADIE` row.

### 13.3 The rows

| field on an entry | what a client may assume |
|---|---|
| `dayDate` | `YYYY-MM-DD`. Never an instant |
| `portion` / `portionLabel` | `FULL`, `AM` or `PM`, and the word |
| `kind` / `kindLabel` | one of the five kinds, and the word |
| `absenceReason` / `absenceLabel` | the reason and its word, or `null` for both |
| `note` | **unaltered**, byte for byte as typed, including a leading `=` — see §6.7 |
| `provenance` / `provenanceLabel` | the provenance, and the word |
| `detectedKind` | what detection proposed, or `null`. **No label beside it** |
| `firstRecordedAt` | the server clock at first receipt, which never moves |
| `clientClaimedAt` | what the client asserted, verbatim, or `null` |
| `clientMutationId` | the id of the last write the server applied to this row (§6.2) |

**Three fields §6.2 carries are absent here**: `id`, `detectedAt` and
`lastModifiedAt`, and nothing in the module says why. Two of the three are
recoverable from what is present — the trail carries every `MODIFIED` event
with its `recordedAt`, which is what §6.2 derives `lastModifiedAt` from. The
third is not: **`detectedAt` appears nowhere in this export**, on the entry or
on the trail, so the instant a proposal was produced is not in the file.

**A trail row carries the same shape minus the free text.** `action` —
`CREATED` or `MODIFIED` — `recordedAt`, and then the day's identity and state:
`dayDate`, `portion`, `kind`, `provenance`, `detectedKind`, `clientClaimedAt`,
`clientMutationId`, each code with its word. It carries **no `note` and no
`absenceReason`**: the trail records what a day *was*, not what was written
beside it.

**It carries no `entryId` either.** A reader attaches an event to a day by
`(dayDate, portion)` — which §6.2 already names as the reconciliation key, and
which is the natural key of an entry. There is nothing else to join on: these
`entries` carry no `id`.

### 13.4 What is not in it, and how that stays true

| collection | fields | what is deliberately absent |
|---|---|---|
| `devices` | `platform`, `createdAt` | **the FCM token**, and the `id`, `appVersion` and `lastSeenAt` §10 returns on registration |
| `reminders` | `sentOn`, `sentAt` | anything about what the reminder said |
| `sessions` | `createdAt`, `lastUsedAt`, `revokedAt`, `revokedReason` | the token hashes |

**A push token is not a fact about the person.** It is how the server
*addresses* a device, and the same reasoning excludes the session token hashes:
a file somebody emails to their accountant should not carry credential-shaped
artefacts. The devices themselves are exported, so a person can still see every
phone that has been signed in.

**`sessions` is where §2's fourth revocation becomes visible to the person.** A
session ended by reuse detection carries `revokedReason: "TOKEN_REPLAYED"`,
beside `SIGNED_OUT`, `REVOKED_ALL` and `ACCOUNT_DELETED`. §1.5 keeps the
refresh route from telling an unauthenticated caller that a token was replayed,
because that caller may be the thief; here the reader has presented a valid
access token for the account, which is the point at which saying so costs an
attacker nothing.

| table | why it is not in the export |
|---|---|
| `SessionToken` | hashed credentials. They tell the person nothing and tell an interceptor something. The **sessions** they belong to are exported |
| `Account` | an Auth.js adapter table with no adapter behind it (R209). Always empty, and a permanently empty array would tell a reader this product stores something it does not |
| `Session` | the other adapter table, empty for the same reason. D14 withdrew the web session it would have held |
| `VerificationToken` | single-use sign-in tokens, keyed by address rather than by user and already spent by the time anybody exports |

**The partition is derived from the schema, not typed beside it.**
`tests/db/account-export.test.ts` reads `prisma/schema.prisma`, collects every
model carrying a `userId` column, and requires each one to be **either exported
or excluded with a stated reason** — a reason long enough that *"not useful"*
cannot be one. A table added two years from now lands in neither list and fails
there, which is R175 in its original form: two lists that between them must
cover everything, with the space between them named rather than left.

Its reach is written down rather than assumed: the census sees **direct**
ownership only. `SessionToken` belongs to a person through its session, is
invisible to that scan, and is in the excluded list by hand.

**Nothing in the export is bounded.** Every read is `where: { userId }` with no
year, no limit and no cursor, across all six tables. Measured at ten years:
1 237 600 bytes in one response, 130 ms. That is a known open item rather than
a contract decision — a client should not assume a size, and should not assume
this stays a single response forever.

### 13.5 `?format=csv` — the entries, through the dossier's serialiser

Not a second serialiser (R206): the same `toCsv` FW25 wrote for
`/api/v1/export/csv`. So this file carries **SPEC §12's eleven columns, exact
and in its order**, opens with a UTF-8 BOM, ends its rows with CRLF, and
neutralises a formula-shaped note exactly as §6.7 describes — the apostrophe
here, the note unaltered in the JSON, because only a spreadsheet executes one.

**Its rows are the entries, never the gaps.** The dossier's CSV prints every
working day *without* an entry, because SPEC §12 item 5 requires a year's
document to show what is missing. An account export is what the person
**wrote**, and an unlogged day is a fact about a year's document rather than
about this person's record.

**Two columns are constant in this file whatever the day is.**
`lastModifiedAt` is written empty on every row and `late` is written `false` on
every row. A day edited five times is indistinguishable here from one written
once: the trail in the JSON is the only place that history appears, and a
reader who needs it must take the JSON.

**The French words are not in the CSV.** Every cell carries the code —
`HOME`, `AM`, `DETECTED_CORRECTED` — because the columns are SPEC §12's and
those are frozen. The labels of §13.2 exist in the JSON alone.

**The filename is the only place this file names anybody**, and it takes three
shapes:

| the account's name | filename |
|---|---|
| absent, or blank | `mon-releve-donnees.csv` |
| present, slugifies to nothing | `donnees-<year>.csv` |
| present | `donnees-<year>-<slug>.csv` |

Same helper and same rule as §6.7: the slug folds accents and admits only ASCII
letters and digits, because the value is parsed as an HTTP header and the name
is user-controlled.

**The year in that filename is the year of the download, not a scope.** It is
the server's current UTC year at the moment of the request. The dossier's
`releve-<year>-<name-slug>.csv` names a tax year and means it; this one records
when the file was taken, while the file itself holds every year the person has.
A client that parses a year out of this filename is reading the wrong fact.

**A nameless account is exported anyway.** §8.3 refuses a dossier with
`titulaire_missing`, because a document nobody is named on cannot be
attributed. This is not the document of record, so the name is used where it
helps and its absence is not a refusal.

The JSON filename is `mon-releve-donnees.json`, always — no name, no year.

### 13.6 The order of the checks is part of the contract

| | |
|---|---|
| 1 | authenticate |
| 2 | scan the query string for coordinates, **before anything else about the parameters** |
| 3 | refuse unknown parameters |
| 4 | validate `format` |
| 5 | read |

Step 2 precedes step 3 for §6.6's reason: a `?lat=` is *both* a coordinate and
an unknown parameter, and answering *"unknown parameter"* would lose the one
interesting fact about that request — that a client is sending coordinates
(SPEC §13.1, D18). As everywhere else the scan reads **keys and never values**,
and the keys it found go to the server log rather than into the response.

| code | status | fires when |
|---|---|---|
| the auth codes of §1.4 | 401 | no bearer token, or one that does not resolve |
| `coordinates_refused` | 400 | any query key whose name contains a banned location word |
| `unknown_parameter` | 400 | any parameter other than `format`; `parameters[]` names them |
| `invalid_format` | 400 | `format` is present and is neither `json` nor `csv` |

**`format` is defaulted only when it is absent.** `?format=` — the key present
with an empty value — is `invalid_format`, not JSON.

**A repeated `format` is first-wins**: `?format=csv&format=json` serves the CSV.
§8 refuses a repeated `year` outright, and the difference is worth stating
because a client author who learned the strict behaviour there will expect it
here.

**`invalid_format` carries the write path's French message**, which says the
detail of the offending fields accompanies the response. On this route nothing
accompanies it: the body is `{ status, code, message }`, and the `code` is the
part a client acts on — §1.4's rule, which is why the French may be rewritten
freely.

**There is no `POST`, `PATCH` or `DELETE` here.** This route only reads;
erasure is its own route, and deleting the account removes every row this
export describes (D11).

---

## 14. `POST /api/v1/account/delete` — erasure, and what survives it

Added in FW26. D11, and SPEC §14.5's *suppression du compte* in Paramètres.

**It is a `POST` and not a `DELETE`, and the reason is the client.** SPEC §14.5
requires a confirmation naming what is destroyed, and a confirmed action that
carries a body is a `POST` everywhere else in this API — so a request that
reaches this route by accident does not erase anybody.

```
POST /api/v1/account/delete
Authorization: Bearer <access token>
Content-Type: application/json

{ "confirm": "SUPPRIMER" }
```

| field | required | notes |
|---|---|---|
| `confirm` | yes | The literal `SUPPRIMER`, compared exactly. It is **French because it is the word the app shows** — a client sending `DELETE` has not read SPEC §14.5's confirmation requirement, which is the point. |

**The confirmation is not security.** A caller holding a valid access token can
always send the word, and sending it changes nothing about what that token
authorises. It is there so a mis-wired client, a retried request or a curious
developer with a shell does not destroy an account by making the obvious call —
which is the realistic failure, and the one D11's *"the confirmation names what
is destroyed"* is written against.

**This route has no schema.** It reads one key and compares it; there is no Zod
parse, so **unknown fields are ignored rather than refused** and no coordinate
scan runs. That is the opposite of §6.1 and §10.3, and it is written down here
because a client author who read §6.6 would expect otherwise: a body carrying
`latitude` beside a valid `confirm` erases the account and is neither refused
nor recorded, and an oversized body is not `payload_too_large`.

### 14.1 The answer is a receipt, not `ok`

```json
{
  "status": "ok",
  "removed": {
    "User": 1,
    "Entry": 184,
    "EntryEvent": 197,
    "Device": 1,
    "DeviceSession": 3,
    "VerificationToken": 0
  },
  "alertSubscriptionRemains": false
}
```

**`ok` would tell somebody their account is gone; this tells them what went with
it** — which is what the confirmation promised, and the last chance to say it.

- **The counts are taken before the cascade**, inside the same transaction. A
  receipt of zeros would be indistinguishable from a deletion that did nothing.
- **`removed` is exactly those six keys, and it is not an inventory of every
  table.** `Account`, `Session`, `ReminderSent` and `SessionToken` are destroyed
  by the same cascade and are **not** counted; `User` is the literal `1`. The set
  is written out in the erasure path rather than derived from the schema, so a
  new user-owned table does not join it by itself.
- **The keys are PascalCase model names**, unlike every other field this
  document names. Parse the object as a map, never as a fixed record: a key
  may be added under §6's additive rule, and a client that fails on an unknown
  one fails on the response it can least afford to lose.

### 14.2 One transaction, and no narrower privilege

Everything below happens inside `$transaction` or not at all. **A partial
erasure that succeeds halfway is worse than a refusal, because the person
believes they are gone.**

The erasure **passes** §3's append-only trigger rather than standing it aside.
PostgreSQL removes the parent row before firing the referential action, so
during a cascade from `User` the person is already invisible to the transaction,
while a direct `DELETE FROM "EntryEvent"` still sees them — and the trigger asks
exactly that question. There is no transaction-local flag, no dedicated role and
no marker row, because each of those is a way of teaching a guard to stand aside
and every one of them is a door.

It follows that **the capability is the deletion**. Nothing on this path can tidy
one inconvenient event without destroying the entire account, which is the
loudest possible side effect; the failure worth guarding is therefore somebody
erasing an account they should not have, which is ordinary authentication.

**`VerificationToken` is deleted explicitly, because it does not cascade.** It is
keyed by address rather than by `userId`, so a pending sign-in link would
otherwise outlive the account it was issued for — a live credential still
resolving to an address this product has just promised to forget.

**Tokens are revoked by being destroyed (R193).** `SessionToken` cascades from
`DeviceSession`, which cascades from `User`, so every credential for the account
ceases to exist in the statement that removes the account. There is no window in
which a token outlives its owner.

### 14.3 The alert-list subscription survives, and is reported

`AlertSubscriber` is keyed by **email**, not by user. It is a separate consent
under a separate identity: most rows on that list belong to addresses that never
had an account at all, and one that does had it added by a different act on a
different day.

Deleting it would revoke a consent nobody withdrew. **Keeping it silently would
be worse — somebody who asked to be forgotten and then receives an email has
been told something untrue by the absence of a field.**

So it survives, and `alertSubscriptionRemains` reports it on every successful
answer. `true` means a row exists for the address and has not unsubscribed;
`false` covers both no row and an address that already left. The row keeps the
one-click unsubscribe token it was issued with, which is the mechanism that
already exists and the only way off that list this API offers. **A client that
erases an account must surface this field**, for the same reason §6.5 requires it
to surface a warning: the receipt alone looks complete without it.

### 14.4 What it refuses

| code | status | fires when |
|---|---|---|
| `missing_token` / `malformed_authorization` | 401 | no `Authorization: Bearer` header, or one that is not two parts |
| `unknown_token` / `expired_token` / `rotated_token` / `revoked_session` | 401 | the usual auth refusals of §1.4 |
| `malformed_body` | 400 | the body is not JSON |
| `confirmation_required` | 400 | `confirm` is absent, or is anything other than `SUPPRIMER` |
| `erasure_blocked` | 500 | the append-only guard refused the cascade |
| `write_failed` | 500 | ours. The transaction rolled back and nothing was erased |

**`erasure_blocked` reaching a client would be a design failure rather than a
runtime one**: it means the cascade of §3 was not recognised as a cascade. It is
named rather than folded into `write_failed` so the next reader is told which
rule refused instead of being handed *"delete failed"*, and it is logged
server-side with the trigger's own message. Like `conflict` in §7, a client
should not expect it and must still treat it as terminal (§6.5).

Only `POST` is exported, so any other method is the framework's answer rather
than one of these codes. **Every 401 carries `WWW-Authenticate: Bearer`**; the
200 carries `Cache-Control: no-store, private`, and the refusals carry no cache
header.

### 14.5 The order of checks is part of the contract

| | |
|---|---|
| 1 | authenticate |
| 2 | parse the body as JSON |
| 3 | compare `confirm` |
| 4 | erase, in one transaction |

A request that breaks two rules is told about the earlier one, so a call with no
bearer *and* no confirmation is a 401. **Nothing is destroyed before step 4**,
and that is asserted on the `confirmation_required` path — the account is counted
afterwards and must still be there — rather than trusted to the reading.

### 14.6 What a client must know before it calls this

These are obligations on the *client*, in the shape of §6.5, and the first is the
one that cannot be recovered by a later release.

- **It is not idempotent, and a lost answer cannot be resolved by retrying.** The
  retry's access token no longer resolves, because its row was destroyed with the
  account, so the second call is `401 unknown_token` — indistinguishable from an
  ordinary expiry. **A client that never received the 200 cannot learn from this
  API whether the erasure happened.** Render the receipt when it arrives; on a
  401 following a delete, sign the person out rather than offering to refresh.
- **What follows an erasure is `unknown_token`, not `revoked_session`.** §7 lists
  account deletion among the causes of `revoked_session`; that row describes a
  session that was *revoked*, and this route *destroys* the session rows, leaving
  nothing behind to report a reason.
- **Local data is the client's own obligation.** SPEC §14.5 names the Room
  database beside the server rows. This route reaches the server and no further.
- **The dossier cannot be regenerated afterwards**, and SPEC §14.5 requires the
  confirmation to say so before the call is made. No route in this API can
  rebuild it: the entries, the trail and the timestamps that the *Relevé annuel*
  rests on are gone in the same statement.
