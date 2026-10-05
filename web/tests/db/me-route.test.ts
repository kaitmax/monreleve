// web/tests/db/me-route.test.ts
//
// GET and PATCH /api/v1/me, through the route handlers. FW26 increment 2.
//
// ============================================================================
// CONSENT IS THE PART THAT MATTERS
// ============================================================================
//
// SPEC §13 forbids detection without consent, and D19 makes revocation
// immediate. The failure mode is not a missing column - it is a setting that
// says one thing while the system does another: consent revoked, `loggingMode`
// left on AUTO_DETECT, and an app that goes on sampling because nobody told it
// to stop.
//
// So revocation is asserted to do BOTH, server-side, in one write.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { GET, PATCH } from '@/app/api/v1/me/route';
import { ME_FIELDS } from '@/lib/me/read';

const ORIGIN = 'https://monreleve.ch';

let userId = '';
let token = '';

function get(bearer = token): Request {
  return new Request(`${ORIGIN}/api/v1/me`, {
    headers: bearer === '' ? {} : { authorization: `Bearer ${bearer}` },
  });
}

function patch(payload: unknown, bearer = token): Request {
  return new Request(`${ORIGIN}/api/v1/me`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(bearer === '' ? {} : { authorization: `Bearer ${bearer}` }),
    },
    body: JSON.stringify(payload),
  });
}

async function body(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      data: { email: 'me@example.com', name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
    })
  ).id;

  token = (await issueTokenPair(userId)).accessToken;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/v1/me', () => {
  it('refuses an unauthenticated caller', async () => {
    expect((await GET(get(''))).status).toBe(401);
  });

  it('returns exactly the frozen field set', async () => {
    const payload = await body(await GET(get()));

    expect(Object.keys(payload).sort()).toEqual([...ME_FIELDS].sort());
  });

  it('returns the name, but never the email', async () => {
    // AN-ONBOARD: the name is settable through /me and returned, so a re-sign-in
    // on a new phone can SKIP the name step (R297). It is the owner's own data,
    // behind their own bearer token. The EMAIL stays absent - it is the fact
    // §1.5 goes to some length to keep a sign-in form from confirming, and a
    // settings endpoint handing it back would be the same leak through a
    // quieter door.
    const payload = await body(await GET(get()));

    expect(payload.name).toBe('Camille Rey');
    expect(payload.email).toBeUndefined();
  });
});

describe('PATCH /api/v1/me — the holder name (AN-ONBOARD)', () => {
  it('sets the name and returns it', async () => {
    const response = await PATCH(patch({ name: 'Alex Dupont' }));

    expect(response.status).toBe(200);
    expect((await body(response)).name).toBe('Alex Dupont');

    // And it persists to the next GET.
    expect((await body(await GET(get()))).name).toBe('Alex Dupont');
  });

  it('trims surrounding whitespace', async () => {
    await PATCH(patch({ name: '  Sam Bernard  ' }));

    expect((await body(await GET(get()))).name).toBe('Sam Bernard');
  });

  it('refuses a blank name rather than storing one that fails the PDF', async () => {
    // R205: the dossier/PDF refuse to generate without a titulaire, so a name
    // that trims to nothing is refused at the door rather than stored to surface
    // as a 422 later.
    const response = await PATCH(patch({ name: '   ' }));

    expect(response.status).toBe(400);
  });

  it('leaves the other settings alone when only the name changes', async () => {
    await PATCH(patch({ name: 'Camille Martin' }));

    const payload = await body(await GET(get()));

    expect(payload.name).toBe('Camille Martin');
    expect(payload.canton).toBe('GE');
    expect(payload.employmentRate).toBe(100);
  });
});

describe('PATCH /api/v1/me', () => {
  it('refuses an unauthenticated caller', async () => {
    expect((await PATCH(patch({ reminderEnabled: true }, ''))).status).toBe(401);
  });

  it('updates one field and leaves the rest alone', async () => {
    await PATCH(patch({ reminderTime: '08:15' }));

    const payload = await body(await GET(get()));

    expect(payload.reminderTime).toBe('08:15');
    expect(payload.canton).toBe('GE');
    expect(payload.employmentRate).toBe(100);
  });

  it('refuses an unknown field rather than silently ignoring it', async () => {
    // A client that misspells a setting and receives 200 has been told its
    // change was saved.
    const response = await PATCH(patch({ remindreTime: '08:15' }));

    expect(response.status).toBe(400);
    expect((await body(response)).code).toBe('invalid_body');
  });

  it('refuses an empty body', async () => {
    expect((await PATCH(patch({}))).status).toBe(400);
  });

  it('refuses a bad time of day', async () => {
    expect((await PATCH(patch({ reminderTime: '25:00' }))).status).toBe(400);
  });

  it('refuses an unknown canton', async () => {
    expect((await PATCH(patch({ canton: 'XX' }))).status).toBe(400);
  });
});

describe('the invariants live in the DATABASE, and the route names its refusal', () => {
  // R196 put both of these in the schema so they survive a writer that does
  // not know they exist. This route is such a writer, and what it owes the
  // client is a NAMED refusal rather than a 500 (R198).

  it('refuses an employmentRate outside 1-100, by name', async () => {
    const response = await PATCH(patch({ employmentRate: 0 }));

    expect(response.status).toBe(400);
    expect((await body(response)).code).toBe('employment_rate_out_of_range');
  });

  it('accepts a legal rate, so the guard is not refusing everything', async () => {
    // R196's own rule: rejection alone proves a constraint is strict, never
    // that it is right.
    const response = await PATCH(patch({ employmentRate: 80 }));

    expect(response.status).toBe(200);
    expect((await body(response)).employmentRate).toBe(80);
  });

  it('refuses EXACT without a total, by name', async () => {
    const response = await PATCH(patch({ denominatorKind: 'EXACT' }));

    expect(response.status).toBe(400);
    expect((await body(response)).code).toBe('exact_total_required');
  });

  it('accepts EXACT WITH a total, both fields in one request', async () => {
    const response = await PATCH(
      patch({ denominatorKind: 'EXACT', exactTotalWorkDays: 228 }),
    );

    expect(response.status).toBe(200);
    expect((await body(response)).exactTotalWorkDays).toBe(228);
  });

  it('refuses a total left standing on a SIMPLIFIED240 row', async () => {
    // BOTH DIRECTIONS. The constraint's own comment says why: a stale total on
    // a simplified row is a number a later reader would use, disagreeing with
    // the denominator the engine actually took.
    await PATCH(patch({ denominatorKind: 'EXACT', exactTotalWorkDays: 228 }));

    const response = await PATCH(patch({ denominatorKind: 'SIMPLIFIED240' }));

    expect(response.status).toBe(400);
    expect((await body(response)).code).toBe('exact_total_required');
  });
});

describe('D19: consent is timestamped in both directions, and revocation stops detection', () => {
  it('stamps detectionConsentAt when consent is granted', async () => {
    const before = Date.now();

    const payload = await body(await PATCH(patch({ detectionConsent: true })));

    expect(typeof payload.detectionConsentAt).toBe('string');
    expect(new Date(payload.detectionConsentAt as string).getTime()).toBeGreaterThanOrEqual(
      before - 1000,
    );
  });

  it('never accepts a client-supplied timestamp', async () => {
    // Timestamps are server-assigned everywhere in this product. A client that
    // could name the moment it consented could name one it did not.
    const response = await PATCH(patch({ detectionConsentAt: '2020-01-01T00:00:00.000Z' }));

    expect(response.status).toBe(400);
  });

  it('CLEARS the stamp on revocation and forces loggingMode to MANUAL', async () => {
    // THE ASSERTION THIS BLOCK EXISTS FOR. Revoking consent while leaving
    // AUTO_DETECT standing is a setting that says one thing and a system that
    // does another - and the person who revoked it is the one who finds out.
    await PATCH(patch({ detectionConsent: true, loggingMode: 'AUTO_DETECT' }));

    const granted = await body(await GET(get()));

    // PRESENCE FIRST (R169): detection must actually be on, or "it is off
    // afterwards" is satisfied by a state it was already in.
    expect(granted.detectionConsentAt).not.toBeNull();
    expect(granted.loggingMode).toBe('AUTO_DETECT');

    const revoked = await body(await PATCH(patch({ detectionConsent: false })));

    expect(revoked.detectionConsentAt).toBeNull();
    expect(revoked.loggingMode).toBe('MANUAL');
  });

  it('refuses AUTO_DETECT without consent, rather than storing an impossible pair', async () => {
    // The other direction of the same rule. SPEC 13 forbids detection without
    // consent; a row carrying AUTO_DETECT and a null stamp is that forbidden
    // state written down.
    const response = await PATCH(patch({ loggingMode: 'AUTO_DETECT' }));

    expect(response.status).toBe(400);
    expect((await body(response)).code).toBe('consent_required');
  });

  it('allows AUTO_DETECT and consent together in ONE request', async () => {
    // Otherwise a client would have to make two calls and the first would be
    // refused - which is the shape that makes people disable the guard.
    const response = await PATCH(patch({ loggingMode: 'AUTO_DETECT', detectionConsent: true }));

    expect(response.status).toBe(200);
    expect((await body(response)).loggingMode).toBe('AUTO_DETECT');
  });
});
