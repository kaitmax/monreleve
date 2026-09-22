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
| `portion` | `FULL`, `AM` or `PM`. Defaults to `FULL`. The row's identity is `(dayDate, portion)`, so `AM` and `PM` are two rows and either may sit beside a `FULL` one. |
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
- **`annex` contains unlogged days.** A row with `recorded: false` carries a
  `dayDate` and nothing else — no portion, no kind, no timestamp. SPEC §12
  item 5 requires them printed rather than skipped.
- **`zone.warnings` must be surfaced, never only the figures** — see §6.5,
  which is the same obligation stated where a client meets it first.
- **`result` is not on the wire.** The engine's own output duplicates four of
  `zone`'s figures, and two sources for one figure inside a frozen contract is
  the drift this document exists to prevent. Its unique fields may be added
  later as named fields (§6.3's additive rule permits it).

### 8.3 Refusals

| code | status | fires when |
|---|---|---|
| `missing_token` / `invalid_token` | 401 | no bearer, or one that does not resolve |
| `coordinates_refused` | 400 | a location key in the query — checked **first** |
| `unknown_parameter` | 400 | any parameter other than `year`, including a planted `userId` |
| `invalid_year` | 400 | not four digits |
| `future_year` | 400 | a year that has not happened |
| `titulaire_missing` | 422 | the account has no name, so no document can be attributed |

**`future_year` is its own code and not `invalid_year`.** The engine would
answer for 2031 — a full basis, nothing logged, 0 % declared — and that answer
is not so much wrong as *meaningless*, which is worse, because it looks like a
compliant year. `invalid_year` would send a client author to check their
parser.
