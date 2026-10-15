// web/tests/db/account-delete.test.ts
//
// POST /api/v1/account/delete, and the negative sweep. FW26 increments 4 and 5.
//
// ============================================================================
// THE APPEND-ONLY GUARD MUST STILL REFUSE, AND THAT IS ASSERTED HERE
// ============================================================================
//
// Erasure passes a guard built to refuse it, and the whole question is whether
// the guard still refuses everything else. So this file proves BOTH: a direct
// DELETE on `EntryEvent` is rejected by name, and the cascade from `User`
// succeeds - the two sides of the property FW21 built and D11 requires.
//
// A file that only proved the erasure works would be satisfied by a disabled
// trigger, which is the one answer the prompt rules out.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { authenticate } from '@/lib/auth/bearer';
import { claimCodeAttempt } from '@/lib/auth/magic-link';
import { POST } from '@/app/api/v1/account/delete/route';

const ORIGIN = 'https://monreleve.ch';
const SCHEMA = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

let userId = '';
let token = '';
let entryId = '';
let counter = 0;

function mutation(): string {
  counter += 1;

  return `00000000-0000-4000-e000-${String(counter).padStart(12, '0')}`;
}

function post(body: unknown, bearer = token): Request {
  return new Request(`${ORIGIN}/api/v1/account/delete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(bearer === '' ? {} : { authorization: `Bearer ${bearer}` }),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  await prisma.user.deleteMany();
  // VerificationToken is keyed by ADDRESS and has no foreign key to User, so
  // deleting every user leaves them behind. They accumulated across runs until
  // this line existed, and the receipt counted six where the fixture made one -
  // the same non-cascading fact the erasure path has to handle, showing up
  // first in the test that forgot it.
  await prisma.verificationToken.deleteMany();
  // FW-CODE-CAP: CodeAttempt is keyed by a HASH of the address and does not
  // cascade either, so it accumulates across runs exactly as the rows above
  // did - the same non-cascading fact, one table over.
  await prisma.codeAttempt.deleteMany();

  userId = (
    await prisma.user.create({
      data: { email: 'erase@example.com', name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
    })
  ).id;

  token = (await issueTokenPair(userId)).accessToken;

  const entry = await prisma.entry.create({
    data: {
      userId,
      dayDate: new Date('2026-03-02T00:00:00.000Z'),
      portion: 'FULL',
      kind: 'HOME',
      clientMutationId: mutation(),
    },
  });

  entryId = entry.id;

  await prisma.entryEvent.create({
    data: {
      userId,
      entryId,
      action: 'CREATED',
      kind: 'HOME',
      provenance: 'MANUAL',
      dayDate: entry.dayDate,
      portion: 'FULL',
      clientMutationId: entry.clientMutationId,
    },
  });

  await prisma.verificationToken.create({
    data: {
      identifier: 'erase@example.com',
      token: `verification-${counter}`,
      expires: new Date(Date.now() + 900_000),
    },
  });

  // FW-CODE-CAP: an attempt fingerprint for this address, for the same reason
  // the issuance record below is seeded - an erasure assertion with nothing to
  // find is satisfied by absence (R169's corollary).
  await claimCodeAttempt('erase@example.com');

  // FW-VERIFY: an issued-releve record for this account, so the erasure sweep
  // covers it with something to find rather than vacuously (R329: "erased with
  // the account, like every other row ... which must now cover it").
  await prisma.issuanceRecord.create({
    data: {
      code: `issuance-${counter}`,
      userId,
      taxYear: 2026,
      version: 1,
      name: 'Camille Rey',
      declarableRate: 39.16,
      teleworkDays: 94,
      missionDaysFrance: 6,
      missionDaysThirdState: 2,
      periodFraction: 1,
      sha256: 'f'.repeat(64),
      generatedAt: new Date('2026-04-01T09:00:00.000Z'),
    },
  });

  // FW-VERIFY (R331): a name-change date, so the sweep covers it too.
  await prisma.nameChange.create({ data: { userId } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('the append-only guard still refuses everything else', () => {
  it('REJECTS a direct DELETE on EntryEvent, by the trigger own message', async () => {
    // The guard erasure has to pass. If this ever stops failing, the erasure
    // path has been implemented by disabling the rule rather than by being
    // recognised as a cascade.
    await expect(prisma.entryEvent.deleteMany({ where: { userId } })).rejects.toThrow(
      /append-only/u,
    );
  });

  it('REJECTS an UPDATE too, which erasure never needs', async () => {
    await expect(
      prisma.entryEvent.updateMany({ where: { userId }, data: { kind: 'CH' } }),
    ).rejects.toThrow(/append-only/u);
  });

  it('still refuses AFTER a successful erasure of a different account', async () => {
    // R196's shape: a trigger that had been quietly dropped would pass every
    // erasure test and fail nothing until an audit.
    const otherId = (
      await prisma.user.create({
        data: { email: 'other-erase@example.com', name: 'Autre', canton: 'GE' },
      })
    ).id;

    const otherToken = (await issueTokenPair(otherId)).accessToken;

    await POST(post({ confirm: 'SUPPRIMER' }, otherToken));

    await expect(prisma.entryEvent.deleteMany({ where: { userId } })).rejects.toThrow(
      /append-only/u,
    );
  });
});

describe('AC3: the erasure', () => {
  it('refuses an unauthenticated caller', async () => {
    expect((await POST(post({ confirm: 'SUPPRIMER' }, ''))).status).toBe(401);
  });

  it('refuses without the confirmation, by name', async () => {
    const response = await POST(post({}));

    expect(response.status).toBe(400);
    expect(((await response.json()) as { code: string }).code).toBe('confirmation_required');

    // AND NOTHING WAS DESTROYED. A refusal that had already deleted half the
    // account would be the worst outcome in this file.
    expect(await prisma.user.count({ where: { id: userId } })).toBe(1);
  });

  it('removes the account and reports what went with it', async () => {
    const response = await POST(post({ confirm: 'SUPPRIMER' }));

    expect(response.status).toBe(200);

    const body = (await response.json()) as { removed: Record<string, number> };

    // THE RECEIPT IS COUNTED BEFORE THE CASCADE. A receipt of zeros would be
    // indistinguishable from a deletion that did nothing.
    expect(body.removed.Entry).toBe(1);
    expect(body.removed.EntryEvent).toBe(1);
    expect(body.removed.VerificationToken).toBe(1);
    // FW-CODE-CAP: the attempt fingerprints are keyed by a hash of the address
    // and do not cascade, so they are deleted explicitly or not at all.
    expect(body.removed.CodeAttempt).toBe(1);
    // FW-VERIFY: the issued-releve record goes with the account (R329).
    expect(body.removed.IssuanceRecord).toBe(1);
    // FW-VERIFY: the name-change date goes too (R331).
    expect(body.removed.NameChange).toBe(1);
  });

  it('revokes the tokens in the same transaction (R193)', async () => {
    // PRESENCE FIRST (R169): the token must work before, or "it is refused
    // afterwards" is satisfied by a token that never worked.
    const before = await authenticate(
      new Request(`${ORIGIN}/api/v1/dossier`, { headers: { authorization: `Bearer ${token}` } }),
    );

    expect(before.ok).toBe(true);

    await POST(post({ confirm: 'SUPPRIMER' }));

    const after = await authenticate(
      new Request(`${ORIGIN}/api/v1/dossier`, { headers: { authorization: `Bearer ${token}` } }),
    );

    expect(after.ok).toBe(false);
  });
});

describe('AC3: the negative sweep, written from the schema', () => {
  /** Every model carrying a `userId`, read from the schema rather than typed. */
  function userOwnedModels(): string[] {
    const models: string[] = [];
    let current = '';

    for (const line of SCHEMA.split('\n')) {
      const header = /^model\s+(\w+)\s*\{/u.exec(line);

      if (header !== null) current = header[1]!;

      if (/^\s*userId\s+String/u.test(line) && current !== '') models.push(current);
    }

    return [...new Set(models)];
  }

  /** The Prisma delegate for a model name, so the sweep can query it. */
  function delegate(model: string): { count: (args: unknown) => Promise<number> } {
    const key = (model.charAt(0).toLowerCase() + model.slice(1)) as keyof typeof prisma;

    return prisma[key] as unknown as { count: (args: unknown) => Promise<number> };
  }

  it('sweeps EVERY user-owned table and finds each one empty', async () => {
    const models = userOwnedModels();

    // R133: a sweep over no tables passes perfectly.
    expect(models.length).toBeGreaterThan(3);

    // PRESENCE FIRST: at least one table must have held something, or the
    // sweep is asserting that nothing became nothing.
    const before = await delegate('Entry').count({ where: { userId } });

    expect(before).toBeGreaterThan(0);

    await POST(post({ confirm: 'SUPPRIMER' }));

    for (const model of models) {
      const remaining = await delegate(model).count({ where: { userId } });

      expect(remaining, `${model} still holds rows for the deleted account`).toBe(0);
    }
  });

  it('leaves the User row itself gone', async () => {
    await POST(post({ confirm: 'SUPPRIMER' }));

    expect(await prisma.user.count({ where: { id: userId } })).toBe(0);
  });

  it('removes the pending sign-in tokens, which do NOT cascade', async () => {
    // VerificationToken is keyed by ADDRESS rather than by userId, so no
    // foreign key reaches it. Without the explicit delete, a live sign-in link
    // would outlive the account it was issued for - a credential resolving to
    // an address this product has just promised to forget.
    await POST(post({ confirm: 'SUPPRIMER' }));

    expect(
      await prisma.verificationToken.count({ where: { identifier: 'erase@example.com' } }),
    ).toBe(0);
  });

  it('leaves ANOTHER account untouched, proven non-empty', async () => {
    const otherId = (
      await prisma.user.create({
        data: { email: 'survivor@example.com', name: 'Autre', canton: 'GE' },
      })
    ).id;

    await prisma.entry.create({
      data: {
        userId: otherId,
        dayDate: new Date('2026-06-11T00:00:00.000Z'),
        portion: 'FULL',
        kind: 'CH',
        clientMutationId: mutation(),
      },
    });

    await POST(post({ confirm: 'SUPPRIMER' }));

    expect(await prisma.entry.count({ where: { userId: otherId } })).toBe(1);
    expect(await prisma.user.count({ where: { id: otherId } })).toBe(1);
  });
});

describe('increment 5: what SURVIVES, deliberately, and is reported rather than silent', () => {
  // ==========================================================================
  // THE ONE PLACE "DELETE EVERYTHING" AND "HONOUR THE CONSENT THEY GAVE" PULL
  // APART
  // ==========================================================================
  //
  // AlertSubscriber is keyed by EMAIL, not by user. Most rows on that list
  // belong to addresses that never had an account; one that does had it added
  // by a different act on a different day.
  //
  // Deleting it would revoke a consent nobody withdrew. Keeping it SILENTLY
  // would be worse: somebody who asked to be forgotten and then receives an
  // email has been told something untrue by the absence of a sentence.

  beforeEach(async () => {
    await prisma.alertSubscriber.deleteMany();
  });

  it('keeps a confirmed subscription, because nobody withdrew that consent', async () => {
    await prisma.alertSubscriber.create({
      data: { email: 'erase@example.com', source: 'calculateur', confirmedAt: new Date() },
    });

    await POST(post({ confirm: 'SUPPRIMER' }));

    const remaining = await prisma.alertSubscriber.findUnique({
      where: { email: 'erase@example.com' },
    });

    expect(remaining).not.toBeNull();
    expect(remaining?.unsubscribedAt).toBeNull();
  });

  it('SAYS SO in the response, which is what stops it being silent', async () => {
    await prisma.alertSubscriber.create({
      data: { email: 'erase@example.com', source: 'calculateur', confirmedAt: new Date() },
    });

    const body = (await (await POST(post({ confirm: 'SUPPRIMER' }))).json()) as {
      alertSubscriptionRemains: boolean;
    };

    expect(body.alertSubscriptionRemains).toBe(true);
  });

  it('reports FALSE when there is nothing on the list, so the flag means something', async () => {
    // R196's shape: a field hardcoded to true would pass the test above.
    const body = (await (await POST(post({ confirm: 'SUPPRIMER' }))).json()) as {
      alertSubscriptionRemains: boolean;
    };

    expect(body.alertSubscriptionRemains).toBe(false);
  });

  it('reports FALSE for an address that already unsubscribed', async () => {
    await prisma.alertSubscriber.create({
      data: {
        email: 'erase@example.com',
        source: 'calculateur',
        confirmedAt: new Date(),
        unsubscribedAt: new Date(),
      },
    });

    const body = (await (await POST(post({ confirm: 'SUPPRIMER' }))).json()) as {
      alertSubscriptionRemains: boolean;
    };

    expect(body.alertSubscriptionRemains).toBe(false);
  });

  it('leaves the unsubscribe token intact, so the one-click route still works', async () => {
    // The mechanism already exists - GET /api/alertes/desinscription?token= -
    // and the token was emailed at confirmation. Destroying it here would
    // strand somebody on a list they can no longer leave.
    await prisma.alertSubscriber.create({
      data: {
        email: 'erase@example.com',
        source: 'calculateur',
        confirmedAt: new Date(),
        unsubscribeTokenHash: 'a-hash-that-must-survive',
      },
    });

    await POST(post({ confirm: 'SUPPRIMER' }));

    const remaining = await prisma.alertSubscriber.findUnique({
      where: { email: 'erase@example.com' },
    });

    expect(remaining?.unsubscribeTokenHash).toBe('a-hash-that-must-survive');
  });
});
