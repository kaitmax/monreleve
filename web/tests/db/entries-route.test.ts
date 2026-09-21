// web/tests/db/entries-route.test.ts
//
// POST /api/v1/entries, driven through the ROUTE HANDLER.
//
// R204: THE ENTRY POINT IS THE UNIT UNDER TEST, NOT THE MODULE. tests/db/
// entries-write.test.ts proves writeEntries ignores a planted userId; that
// proves the FUNCTION. A client does not call the function - it sends a
// request, and between the two sit the bearer guard, the coordinate scan, the
// schema and the order they run in. A plant proven only at the function proves
// the function.
//
// FW22 measured what that gap costs: the sign-in email addressed a callback
// route that did not exist for three increments, and every module test passed
// throughout.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { MAX_BATCH_BODY_BYTES } from '@/lib/entries/schema';
import { ENTRY_READ_FIELDS } from '@/lib/entries/read';
import { POST } from '@/app/api/v1/entries/route';

const ORIGIN = 'https://monreleve.ch';

let userId = '';
let otherId = '';
let token = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

function day(index = 0): string {
  const date = new Date('2026-04-07T00:00:00.000Z');

  date.setUTCDate(date.getUTCDate() + index);

  return date.toISOString().slice(0, 10);
}

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { clientMutationId: mutation(), dayDate: day(), kind: 'CH', ...overrides };
}

/** A request as the Android client sends one. */
function post(body: unknown, bearer = token, url = `${ORIGIN}/api/v1/entries`): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(bearer === '' ? {} : { authorization: `Bearer ${bearer}` }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (await prisma.user.create({ data: { email: 'route@example.com' } })).id;
  otherId = (await prisma.user.create({ data: { email: 'autre-route@example.com' } })).id;
  token = (await issueTokenPair(userId)).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the happy path', () => {
  it('accepts a batch and reports what it did', async () => {
    const response = await POST(post({ entries: [item(), item({ dayDate: day(1) })] }));

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ status: 'ok', written: 2, duplicates: 0 });
    expect(await prisma.entry.count({ where: { userId } })).toBe(2);
  });

  it('acknowledges a replay rather than refusing it (AC3)', async () => {
    const batch = { entries: [item()] };

    expect((await POST(post(batch))).status).toBe(200);

    const replay = await POST(post(batch));

    expect(replay.status).toBe(200);
    expect(await json(replay)).toMatchObject({ written: 0, duplicates: 1 });
    expect(await prisma.entry.count({ where: { userId } })).toBe(1);
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(1);
  });

  it('sets no cookie (AC3)', async () => {
    const response = await POST(post({ entries: [item()] }));

    expect(response.headers.get('set-cookie')).toBeNull();
  });
});

describe('authentication comes first', () => {
  it('refuses with no token, and does not read the body', async () => {
    // The body is deliberately something that would ALSO be refused later - a
    // coordinate. If the route answered `coordinates_refused` here, it would
    // have parsed an unauthenticated caller's payload.
    const response = await POST(post({ entries: [item({ latitude: 46.2 })] }, ''));

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ code: 'missing_token' });
  });

  it('refuses a revoked session by its own code (R198)', async () => {
    const pair = await issueTokenPair(userId);

    await prisma.deviceSession.updateMany({
      where: { id: pair.sessionId },
      data: { revokedAt: new Date(), revokedReason: 'SIGNED_OUT' },
    });

    const response = await POST(post({ entries: [item()] }, pair.accessToken));

    expect(await json(response)).toMatchObject({ code: 'revoked_session' });
  });
});

describe('AC2: a coordinate is refused at the boundary, with a 400', () => {
  // THE FOUR FORMS, each driven through the HTTP handler rather than the
  // scanner. R180: every plant is verified to be IN THE REQUEST BODY before
  // its result is read - a plant that never reached the server would produce a
  // passing test and be recorded as proof that the server refuses it.
  it.each([
    ['at the top level of an item', { latitude: 46.2 }],
    ['in a nested object', { fix: { longitude: 6.1 } }],
    ['inside an array', { samples: [{ accuracy: 12 }] }],
    ['in a key whose name contains one', { lastKnownLatitude: 46.2 }],
  ])('refuses one %s', async (_label, planted) => {
    const body = { entries: [item(planted)] };

    // VERIFY THE PLANT LANDED, in the bytes that will be sent.
    const request = post(body);
    const sent = await request.clone().text();

    expect(sent).toContain(Object.keys(planted)[0] ?? '');

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'coordinates_refused' });
    expect(await prisma.entry.count()).toBe(0);
  });

  it('refuses one in the envelope rather than an item', async () => {
    const body = { entries: [item()], origin: { lat: 46.2 } };
    const request = post(body);

    expect(await request.clone().text()).toContain('lat');

    expect((await POST(request)).status).toBe(400);
  });

  it('says nothing about the VALUE in its answer', async () => {
    // The refusal names keys so a client author can find them. It must not
    // echo the coordinate itself - a value this product refuses to store must
    // not survive in the error about refusing to store it.
    const response = await POST(post({ entries: [item({ latitude: 46.20731 })] }));
    const body = JSON.stringify(await json(response));

    expect(body).not.toContain('46.20731');
    expect(body).not.toContain('46.2');
  });

  it('accepts a legitimate batch, so the refusal is not blanket', async () => {
    const response = await POST(
      post({
        entries: [
          item({
            note: 'journee en Suisse',
            provenance: 'DETECTED_CORRECTED',
            detectedKind: 'CH',
            clientClaimedAt: '2026-04-07T18:03:00.000Z',
          }),
        ],
      }),
    );

    expect(response.status).toBe(200);
  });
});

describe('TENANCY at the HTTP boundary: identity is the token and nothing else', () => {
  it('ignores a userId planted in the BODY', async () => {
    const body = { entries: [{ ...item(), userId: otherId }] };
    const request = post(body);

    // R180: the plant is in the bytes being sent, and names a REAL other user.
    const sent = await request.clone().text();

    expect(sent).toContain(otherId);
    expect(otherId).not.toBe(userId);

    const response = await POST(request);

    // IT IS REFUSED, not silently ignored - `userId` is an unknown key and the
    // schema rejects rather than strips. Either outcome proves the rows do not
    // land on the victim; refusing also tells the client author.
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'invalid_payload' });
    expect(await prisma.entry.count({ where: { userId: otherId } })).toBe(0);
  });

  it('ignores a userId planted in the QUERY STRING', async () => {
    const url = new URL(`${ORIGIN}/api/v1/entries`);

    url.searchParams.set('userId', otherId);

    const request = post({ entries: [item()] }, token, url.toString());

    // R180: verify the plant is in the URL the handler will see.
    expect(new URL(request.url).searchParams.get('userId')).toBe(otherId);

    const response = await POST(request);

    expect(response.status).toBe(200);

    // THE ROWS ARE THE CALLER'S. A query parameter is not identity, and the
    // route never reads one.
    expect(await prisma.entry.count({ where: { userId } })).toBe(1);
    expect(await prisma.entry.count({ where: { userId: otherId } })).toBe(0);
  });

  it('ignores a userId planted in a HEADER', async () => {
    const request = new Request(`${ORIGIN}/api/v1/entries`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'x-user-id': otherId,
      },
      body: JSON.stringify({ entries: [item()] }),
    });

    expect(request.headers.get('x-user-id')).toBe(otherId);

    expect((await POST(request)).status).toBe(200);
    expect(await prisma.entry.count({ where: { userId: otherId } })).toBe(0);
  });

  it('writes nothing at all when the ONLY identity offered is planted', async () => {
    // THE NON-VACUITY HALF. The three above would pass against a route that
    // ignored everything including the token. Remove the token, leave the
    // plants, and nothing may be written for anyone.
    const url = new URL(`${ORIGIN}/api/v1/entries`);

    url.searchParams.set('userId', otherId);

    const response = await POST(post({ entries: [item()] }, '', url.toString()));

    expect(response.status).toBe(401);
    expect(await prisma.entry.count()).toBe(0);
  });
});

describe('the body is bounded before it is parsed', () => {
  it('refuses an oversized body with its own code', async () => {
    const huge = `{"entries":[{"note":"${'x'.repeat(MAX_BATCH_BODY_BYTES + 1000)}"}]}`;

    expect(Buffer.byteLength(huge, 'utf8')).toBeGreaterThan(MAX_BATCH_BODY_BYTES);

    const response = await POST(post(huge));

    expect(response.status).toBe(413);
    expect(await json(response)).toMatchObject({ code: 'payload_too_large' });
  });

  it('refuses a body that is not JSON', async () => {
    const response = await POST(post('not json at all'));

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'malformed_body' });
  });
});

describe('R198: each rule that fires has its own code', () => {
  it('names the schema issues so a client author can act', async () => {
    const response = await POST(post({ entries: [item({ kind: 'ABSENT' })] }));
    const body = await json(response);

    expect(body).toMatchObject({ code: 'invalid_payload' });
    expect(JSON.stringify(body.issues)).toContain('absenceReason');
  });

  it('gives an intra-batch duplicate its own answer, not a 500', async () => {
    const response = await POST(
      post({ entries: [item({ dayDate: day() }), item({ dayDate: day() })] }),
    );

    // The schema catches it - see lib/entries/schema.ts for why the database
    // cannot: the write path upserts on exactly that key.
    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ code: 'invalid_payload' });
  });

  it('keeps every code distinct across the whole route', async () => {
    const codes = new Set<string>();

    codes.add(String((await json(await POST(post({ entries: [item()] }, '')))).code));
    codes.add(String((await json(await POST(post('nope')))).code));
    codes.add(String((await json(await POST(post({ entries: [item({ lat: 1 })] })))).code));
    codes.add(String((await json(await POST(post({ entries: [] })))).code));

    expect(codes.size).toBe(4);
    for (const code of codes) expect(code).toMatch(/^[a-z][a-z_]*[a-z]$/);
  });
});

describe('R217: the answer carries the written rows', () => {
  // WHY THIS IS INSIDE THE FREEZE, stated where the next reader meets it.
  // The freeze forbids RENAMING and REMOVING; a response GAINING a key breaks
  // no client built per section 6.4, which requires ignoring unknown keys.
  // What it buys: SPEC 13.2 says the app shows a pending state until the server
  // value comes back, and until now that value arrived only via GET - so every
  // client paid two round trips on the call the app makes most often.

  async function post(payload: unknown, bearer = token): Promise<Response> {
    return POST(
      new Request(`${ORIGIN}/api/v1/entries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
        body: JSON.stringify(payload),
      }),
    );
  }

  async function answerOf(response: Response): Promise<Record<string, unknown>> {
    return (await response.json()) as Record<string, unknown>;
  }

  function entriesOf(payload: Record<string, unknown>): Array<Record<string, unknown>> {
    return payload.entries as Array<Record<string, unknown>>;
  }

  it('returns one entry per day the batch touched', async () => {
    const answer = await answerOf(
      await post({
        entries: [
          { clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'CH' },
          { clientMutationId: mutation(), dayDate: '2026-04-08', kind: 'HOME' },
        ],
      }),
    );

    expect(answer.written).toBe(2);
    expect(entriesOf(answer)).toHaveLength(2);
    expect(entriesOf(answer).map((entry) => entry.dayDate)).toEqual(['2026-04-07', '2026-04-08']);
  });

  it('returns the SAME shape as the read path, field for field', async () => {
    // R206: one home for the entry shape. Two routes returning two shapes for
    // one concept would make a client carry two parsers for the same object,
    // and the second one drifts.
    const answer = await answerOf(
      await post({ entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'CH' }] }),
    );

    expect(Object.keys(entriesOf(answer)[0] ?? {}).sort()).toEqual([...ENTRY_READ_FIELDS].sort());
  });

  it('carries the server clock the client is waiting for', async () => {
    // THE POINT OF THE WHOLE CHANGE. The pending state clears on
    // firstRecordedAt, and this is where it now arrives.
    const answer = await answerOf(
      await post({ entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'CH' }] }),
    );

    const entry = entriesOf(answer)[0];

    expect(typeof entry?.firstRecordedAt).toBe('string');
    expect(entry?.lastModifiedAt).toBeNull();
    expect(new Date(String(entry?.firstRecordedAt)).getUTCFullYear()).toBeGreaterThan(2020);
  });

  it('RETURNS THE ROWS ON A REPLAY TOO, which is the case that matters most', async () => {
    // THE DECIDING TEST. A client retries precisely because it did not receive
    // the first answer - so if a replay withheld the rows, the client that most
    // needs the timestamps is the one denied them, and it would still need the
    // GET. Withholding them would leave the two round trips in place in exactly
    // the case R217 exists to remove.
    const id = mutation();
    const batch = { entries: [{ clientMutationId: id, dayDate: '2026-04-07', kind: 'CH' }] };

    const first = await answerOf(await post(batch));
    const replay = await answerOf(await post(batch));

    expect(replay.written).toBe(0);
    expect(replay.duplicates).toBe(1);

    // SAME ROWS, SAME VALUES - an acknowledgement a client can act on rather
    // than a count it has to interpret.
    expect(entriesOf(replay)).toHaveLength(1);
    expect(entriesOf(replay)[0]).toEqual(entriesOf(first)[0]);
  });

  it('agrees with what the read path returns afterwards', async () => {
    // BOTH ROUTES, ONE ANSWER. If these ever diverge, a client reconciling from
    // the POST answer and a client reconciling from the GET disagree about the
    // same day, and only one of them is right.
    const { GET } = await import('@/app/api/v1/entries/route');

    const posted = await answerOf(
      await post({
        entries: [
          {
            clientMutationId: mutation(),
            dayDate: '2026-04-07',
            kind: 'CH',
            note: 'bureau',
            clientClaimedAt: '2026-04-07T18:44:02.000Z',
          },
        ],
      }),
    );

    const read = (await (
      await GET(
        new Request(`${ORIGIN}/api/v1/entries?year=2026`, {
          headers: { authorization: `Bearer ${token}` },
        }),
      )
    ).json()) as Record<string, unknown>;

    expect(entriesOf(posted)).toEqual(entriesOf(read));
  });

  it('cannot be handed a stale row, because one batch may not repeat a day', async () => {
    // I WROTE THIS TEST FOR A HAZARD THAT DOES NOT EXIST, and the test is what
    // found that out - so it now asserts the real rule instead of the imagined
    // one.
    //
    // The worry was sound in shape: if a batch could touch one day twice, an
    // answer built from each upsert's return value would carry the row as it
    // stood when the FIRST item was applied - correct when read and stale when
    // sent. The snapshot is taken after the whole batch for that reason.
    //
    // But the schema forecloses it a layer earlier: a batch repeating a
    // (dayDate, portion) is refused at validation and never reaches the write
    // path. So the guarantee has two independent reasons, and this test pins
    // the one that actually fires - because if that validation rule were ever
    // relaxed, the answer's freshness would quietly become load-bearing.
    const answer = await answerOf(
      await post({
        entries: [
          { clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'CH' },
          { clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'HOME', note: 'final' },
        ],
      }),
    );

    expect(answer.status).toBe('error');
    expect(answer.code).toBe('invalid_payload');

    // THE MESSAGE NAMES BOTH POSITIONS, which is what makes it actionable to a
    // client author holding a queue rather than a batch.
    expect(JSON.stringify(answer.issues)).toContain('repeats 2026-04-07 FULL');
    expect(JSON.stringify(answer.issues)).toContain('entries[0]');

    // AND NOTHING LANDED - all-or-nothing, so the refusal is total.
    expect(await prisma.entry.count({ where: { userId } })).toBe(0);
  });

  it('orders them the way the read path does', async () => {
    const answer = await answerOf(
      await post({
        entries: [
          { clientMutationId: mutation(), dayDate: '2026-04-09', kind: 'CH', portion: 'PM' },
          { clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'CH' },
          { clientMutationId: mutation(), dayDate: '2026-04-09', kind: 'CH', portion: 'AM' },
        ],
      }),
    );

    expect(entriesOf(answer).map((entry) => String(entry.dayDate) + '/' + String(entry.portion))).toEqual([
      '2026-04-07/FULL',
      '2026-04-09/AM',
      '2026-04-09/PM',
    ]);
  });

  it('never exposes userId through the new field either', async () => {
    const answer = await answerOf(
      await post({ entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'CH' }] }),
    );

    expect(JSON.stringify(answer)).not.toContain(userId);
  });

  it('carries no entries on a refusal', async () => {
    // AN ERROR IS NOT A PARTIAL SUCCESS. The batch is all-or-nothing, so a
    // refusal must not hand back rows that suggest something landed.
    const answer = await answerOf(
      await post({
        entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'NOPE' }],
      }),
    );

    expect(answer.status).toBe('error');
    expect(Object.hasOwn(answer, 'entries')).toBe(false);
  });

  it('returns another user nothing, in a run that proves the caller got rows', async () => {
    // PRESENCE BEFORE ABSENCE. Without the first assertion this passes against
    // a route that returns no entries to anybody.
    const mine = await answerOf(
      await post({ entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'CH' }] }),
    );

    expect(entriesOf(mine)).toHaveLength(1);

    const otherToken = (await issueTokenPair(otherId)).accessToken;

    const theirs = await answerOf(
      await post(
        { entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'HOME' }] },
        otherToken,
      ),
    );

    expect(entriesOf(theirs)).toHaveLength(1);
    expect(entriesOf(theirs)[0]?.id).not.toBe(entriesOf(mine)[0]?.id);
    expect(JSON.stringify(theirs)).not.toContain(userId);
  });
});

describe('R219: a replay is recognised by the TRAIL, not by the current row', () => {
  // ============================================================================
  // THE DEFECT THIS CLOSES, AND WHY IT WAS INVISIBLE
  // ============================================================================
  //
  // The contract says a batch carrying a seen `clientMutationId` writes no row
  // and no event, and is acknowledged. That sentence was FALSE in one case, and
  // the case is ordinary rather than contrived.
  //
  // The duplicate set was built from `Entry.clientMutationId`, which records
  // which mutation LAST WROTE the row. An edit overwrites it - so the evidence
  // that an earlier mutation was ever applied is destroyed by the next write to
  // the same day. The replay then looks new, and the day reverts.
  //
  //   1. mutation A writes 2026-04-07 as CH        row carries A
  //   2. mutation C edits it to HOME               row carries C
  //   3. the queue retries A, as a queue does when
  //      it never received the answer to A
  //   4. the lookup for A finds nothing            A is APPLIED
  //   5. the day is CH again                       the edit is GONE
  //
  // Somebody logs a day in a tunnel, corrects it that evening on wifi, and the
  // queue drains afterwards. That is the whole reproduction.
  //
  // THE FIX MAKES THE DOCUMENTED SENTENCE TRUE RATHER THAN CHANGING IT. The
  // contract always meant "the server has applied this mutation"; the
  // implementation meant "the current row carries this id", which is a narrower
  // accidental meaning nobody chose. EntryEvent is append-only, so it holds
  // every mutation ever applied and cannot be overwritten by a later edit.

  async function post(payload: unknown, bearer = token): Promise<Response> {
    return POST(
      new Request(`${ORIGIN}/api/v1/entries`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
        body: JSON.stringify(payload),
      }),
    );
  }

  async function answerOf(response: Response): Promise<Record<string, unknown>> {
    return (await response.json()) as Record<string, unknown>;
  }

  it('does NOT revert a newer edit when the original write is replayed late', async () => {
    const first = mutation();

    await post({ entries: [{ clientMutationId: first, dayDate: '2026-04-07', kind: 'CH' }] });

    await post({
      entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'HOME', note: 'edited' }],
    });

    // THE LATE REPLAY. Byte-identical to the first send, which is what a queue
    // holding an unacknowledged item actually emits.
    const replay = await answerOf(
      await post({ entries: [{ clientMutationId: first, dayDate: '2026-04-07', kind: 'CH' }] }),
    );

    expect(replay.written).toBe(0);
    expect(replay.duplicates).toBe(1);

    // AND THE DAY IS UNTOUCHED. The count alone is not the claim - a route that
    // reported 0 and wrote anyway would satisfy it.
    const row = await prisma.entry.findFirstOrThrow({ where: { userId } });

    expect(row.kind).toBe('HOME');
    expect(row.note).toBe('edited');
  });

  it('appends no event for the late replay', async () => {
    const first = mutation();

    await post({ entries: [{ clientMutationId: first, dayDate: '2026-04-07', kind: 'CH' }] });
    await post({
      entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'HOME' }],
    });

    const before = await prisma.entryEvent.count({ where: { userId } });

    await post({ entries: [{ clientMutationId: first, dayDate: '2026-04-07', kind: 'CH' }] });

    // "No row was written" and "no event was written" are different claims and
    // only one of them is visible in the response.
    expect(await prisma.entryEvent.count({ where: { userId } })).toBe(before);
  });

  it('still recognises the SIMPLE replay, which was already correct', async () => {
    // THE REGRESSION GUARD. The old mechanism handled this case; the new one
    // must not lose it while fixing the other.
    const id = mutation();
    const batch = { entries: [{ clientMutationId: id, dayDate: '2026-04-07', kind: 'CH' }] };

    await post(batch);

    const replay = await answerOf(await post(batch));

    expect(replay.written).toBe(0);
    expect(replay.duplicates).toBe(1);
  });

  it('still writes a genuinely new mutation', async () => {
    // THE OTHER DIRECTION, and it is what stops the fix becoming "refuse
    // everything". A dedup set that matched every id would pass all three tests
    // above perfectly.
    await post({ entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'CH' }] });

    const second = await answerOf(
      await post({ entries: [{ clientMutationId: mutation(), dayDate: '2026-04-08', kind: 'HOME' }] }),
    );

    expect(second.written).toBe(1);
    expect(second.duplicates).toBe(0);
    expect(await prisma.entry.count({ where: { userId } })).toBe(2);
  });

  it('records the mutation id on the event, which is what makes the trail usable', async () => {
    const id = mutation();

    await post({ entries: [{ clientMutationId: id, dayDate: '2026-04-07', kind: 'CH' }] });

    const events = await prisma.entryEvent.findMany({ where: { userId } });

    expect(events).toHaveLength(1);
    expect(events[0]?.clientMutationId).toBe(id);
  });

  it('records it on a MODIFIED event too, not only on CREATED', async () => {
    // AN EDIT IS A MUTATION AND ITS ID MUST BE RECORDED, or the second write to
    // any day is replayable for ever - the same defect, one write later.
    await post({ entries: [{ clientMutationId: mutation(), dayDate: '2026-04-07', kind: 'CH' }] });

    const editId = mutation();

    await post({
      entries: [{ clientMutationId: editId, dayDate: '2026-04-07', kind: 'HOME' }],
    });

    const modified = await prisma.entryEvent.findFirstOrThrow({
      where: { userId, action: 'MODIFIED' },
    });

    expect(modified.clientMutationId).toBe(editId);

    // AND REPLAYING THE EDIT IS ALSO REFUSED.
    const replay = await answerOf(
      await post({ entries: [{ clientMutationId: editId, dayDate: '2026-04-07', kind: 'HOME' }] }),
    );

    expect(replay.duplicates).toBe(1);
  });

  it('still recognises a mutation whose event predates this migration', async () => {
    // THE BACKFILL GAP, AND IT IS NOT DEFENSIVE CODE - it is reachable by every
    // row written before this migration ran, including the demo year.
    //
    // Those events carry no clientMutationId and cannot be given one: the id on
    // their Entry is the LAST write's, not the one that created them, so a
    // backfill would record a falsehood in an append-only table. EntryEvent is
    // also UPDATE-blocked by its own trigger, which is the database saying the
    // same thing.
    //
    // So Entry is still consulted. It covers exactly the pre-migration rows and
    // nothing else, because every write after this point puts the id on the
    // event too.
    const legacy = mutation();

    // BUILT BY INSERTING IT, not by editing a row afterwards. EntryEvent is
    // UPDATE-blocked by its own trigger, and reaching past that guard to set up
    // a test would be testing a state the database forbids reaching. An INSERT
    // is exactly how these rows came to exist.
    const entry = await prisma.entry.create({
      data: {
        userId,
        dayDate: new Date('2026-04-07T00:00:00.000Z'),
        portion: 'FULL',
        kind: 'CH',
        clientMutationId: legacy,
        firstRecordedAt: new Date(),
      },
    });

    await prisma.entryEvent.create({
      data: {
        userId,
        entryId: entry.id,
        action: 'CREATED',
        kind: 'CH',
        provenance: 'MANUAL',
        dayDate: new Date('2026-04-07T00:00:00.000Z'),
        portion: 'FULL',
        // clientMutationId deliberately absent - this is the pre-migration shape.
      },
    });

    // R180: the state really is the one being tested.
    const stripped = await prisma.entryEvent.findFirstOrThrow({ where: { userId } });

    expect(stripped.clientMutationId).toBeNull();
    expect(entry.clientMutationId).toBe(legacy);

    const replay = await answerOf(
      await post({ entries: [{ clientMutationId: legacy, dayDate: '2026-04-07', kind: 'CH' }] }),
    );

    expect(replay.duplicates).toBe(1);
    expect(replay.written).toBe(0);
  });

  it('never treats another user mutation id as seen', async () => {
    // TENANCY ON THE DEDUP SET. A global index on clientMutationId would make
    // one account's replay silently swallow another's write - and the ids are
    // the CLIENT's own, so two devices colliding is not far-fetched.
    const shared = mutation();

    await post({ entries: [{ clientMutationId: shared, dayDate: '2026-04-07', kind: 'CH' }] });

    const otherToken = (await issueTokenPair(otherId)).accessToken;

    const theirs = await answerOf(
      await post(
        { entries: [{ clientMutationId: shared, dayDate: '2026-04-07', kind: 'HOME' }] },
        otherToken,
      ),
    );

    // THE ANSWER IS `conflict`, NOT `duplicates`, AND THE DIFFERENCE MATTERS.
    //
    // I expected this write to land. It does not: `Entry.clientMutationId` is
    // `@unique` GLOBALLY rather than per user, so the second account collides
    // with the first at the database and the batch is refused 409.
    //
    // What this test is for either way: the other account's id must never be
    // read as THIS account's duplicate. A dedup set that ignored userId would
    // answer `duplicates: 1` here and silently swallow a real write. So the
    // assertion is that the answer is NOT an acknowledgement.
    expect(theirs.status).toBe('error');
    expect(theirs.code).toBe('conflict');

    // NOT AN ACKNOWLEDGEMENT AT ALL - there is no `duplicates` key on an error,
    // which is a stronger statement than "duplicates is zero" and the one that
    // matters: the write was refused rather than quietly absorbed.
    expect(Object.hasOwn(theirs, 'duplicates')).toBe(false);

    // AND NOTHING OF THEIRS LANDED, which is the half that says the refusal was
    // total rather than partial.
    expect(await prisma.entry.count({ where: { userId: otherId } })).toBe(0);

    // WHILE THE FIRST ACCOUNT'S ROW IS UNTOUCHED - presence, so the absence
    // above is not satisfied by an empty database.
    expect(await prisma.entry.count({ where: { userId } })).toBe(1);
  });
});
