// web/tests/db/issuance-record.test.ts
//
// The issuance record, written whenever a releve is produced. FW-VERIFY inc. 1.
//
// ============================================================================
// WHAT R329 ASKS, AND WHAT THIS PROVES
// ============================================================================
//
// R329: every issued releve is recorded - an unguessable identifier (>= 128
// random bits), the account, the tax year, a version, the name AS PRINTED, the
// printed figures, the SHA-256 of the produced file, and when. Regenerating
// creates a NEW VERSION and marks the previous one superseded.
//
// This file proves the WRITER - recordIssuance - directly, with a real database
// and no browser: the fields land, a second issuance supersedes the first, at
// most one current version exists per (account, year), and the code carries
// 128 bits. The PDF route's wiring (hash of the real file, the code reaching
// the document) is proven where a browser is available; here the subject is the
// record, so the file is a fixture buffer and the figures are fixtures.

import { createHash } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  type IssuanceFigures,
  newVerificationCode,
  recordIssuance,
  sha256Hex,
} from '@/lib/issuance/record';

let userId = '';

const FIGURES: IssuanceFigures = {
  name: 'Camille Rey',
  declarableRate: 39.16,
  teleworkDays: 94,
  missionDaysFrance: 6,
  missionDaysThirdState: 2,
  periodFraction: 1,
  periodStartDate: null,
};

function fixtureBytes(marker: string): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.4 fixture ${marker}`);
}

beforeEach(async () => {
  await prisma.user.deleteMany();

  userId = (
    await prisma.user.create({
      data: { email: 'issue@example.com', name: 'Camille Rey', canton: 'GE', employmentRate: 100 },
    })
  ).id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('newVerificationCode: at least 128 unguessable bits', () => {
  it('is 32 hex characters, which is exactly 128 bits', () => {
    const code = newVerificationCode();

    expect(code).toMatch(/^[0-9a-f]{32}$/u);
  });

  it('does not repeat across many draws', () => {
    const codes = new Set(Array.from({ length: 1000 }, () => newVerificationCode()));

    // A collision in a thousand draws of 128 random bits would mean the source
    // is not random, not that we were unlucky.
    expect(codes.size).toBe(1000);
  });
});

describe('sha256Hex: the fingerprint of the produced file', () => {
  it('matches node crypto over the same bytes', () => {
    const bytes = fixtureBytes('a');

    expect(sha256Hex(bytes)).toBe(createHash('sha256').update(bytes).digest('hex'));
  });

  it('differs when one byte differs', () => {
    expect(sha256Hex(fixtureBytes('a'))).not.toBe(sha256Hex(fixtureBytes('b')));
  });
});

describe('recordIssuance: R329, every issued releve is recorded', () => {
  it('writes version 1, current, with the printed figures and the file hash', async () => {
    const code = newVerificationCode();
    const generatedAt = new Date('2026-04-01T09:00:00.000Z');
    const bytes = fixtureBytes('v1');

    const receipt = await recordIssuance({
      userId,
      taxYear: 2026,
      code,
      sha256: sha256Hex(bytes),
      generatedAt,
      figures: FIGURES,
    });

    expect(receipt.version).toBe(1);
    expect(receipt.code).toBe(code);

    const row = await prisma.issuanceRecord.findUnique({ where: { code } });

    expect(row).not.toBeNull();
    expect(row?.version).toBe(1);
    expect(row?.supersededAt).toBeNull();
    expect(row?.taxYear).toBe(2026);
    expect(row?.name).toBe('Camille Rey');
    expect(row?.declarableRate).toBe(39.16);
    expect(row?.teleworkDays).toBe(94);
    expect(row?.missionDaysFrance).toBe(6);
    expect(row?.missionDaysThirdState).toBe(2);
    expect(row?.periodFraction).toBe(1);
    expect(row?.periodStartDate).toBeNull();
    expect(row?.sha256).toBe(sha256Hex(bytes));
    expect(row?.generatedAt.toISOString()).toBe(generatedAt.toISOString());
  });

  it('regenerating creates version 2 and SUPERSEDES version 1', async () => {
    const first = newVerificationCode();
    const second = newVerificationCode();
    const firstAt = new Date('2026-04-01T09:00:00.000Z');
    const secondAt = new Date('2026-05-02T10:30:00.000Z');

    await recordIssuance({
      userId,
      taxYear: 2026,
      code: first,
      sha256: sha256Hex(fixtureBytes('v1')),
      generatedAt: firstAt,
      figures: FIGURES,
    });

    const receipt = await recordIssuance({
      userId,
      taxYear: 2026,
      code: second,
      sha256: sha256Hex(fixtureBytes('v2')),
      generatedAt: secondAt,
      figures: { ...FIGURES, teleworkDays: 97 },
    });

    expect(receipt.version).toBe(2);

    const old = await prisma.issuanceRecord.findUnique({ where: { code: first } });
    const current = await prisma.issuanceRecord.findUnique({ where: { code: second } });

    // THE OLD ROW IS SUPERSEDED, AND ITS supersededAt IS WHEN THE NEWER ONE WAS
    // ISSUED. The verification page reads exactly that to say "a newer version
    // was issued on <date>" without a second query and without naming a version.
    expect(old?.supersededAt?.toISOString()).toBe(secondAt.toISOString());
    expect(current?.supersededAt).toBeNull();
    expect(current?.version).toBe(2);
    expect(current?.teleworkDays).toBe(97);
  });

  it('keeps at most ONE current version per (account, year)', async () => {
    for (let i = 0; i < 3; i += 1) {
      await recordIssuance({
        userId,
        taxYear: 2026,
        code: newVerificationCode(),
        sha256: sha256Hex(fixtureBytes(`v${i}`)),
        generatedAt: new Date(2026, 3, i + 1),
        figures: FIGURES,
      });
    }

    const current = await prisma.issuanceRecord.count({
      where: { userId, taxYear: 2026, supersededAt: null },
    });

    expect(current).toBe(1);

    // AND THE HISTORY IS KEPT IN FULL - corrections are never limited (R329).
    const all = await prisma.issuanceRecord.count({ where: { userId, taxYear: 2026 } });

    expect(all).toBe(3);
  });

  it('tracks years independently - a 2027 releve does not supersede a 2026 one', async () => {
    await recordIssuance({
      userId,
      taxYear: 2026,
      code: newVerificationCode(),
      sha256: sha256Hex(fixtureBytes('2026')),
      generatedAt: new Date('2026-04-01T09:00:00.000Z'),
      figures: FIGURES,
    });

    await recordIssuance({
      userId,
      taxYear: 2027,
      code: newVerificationCode(),
      sha256: sha256Hex(fixtureBytes('2027')),
      generatedAt: new Date('2027-04-01T09:00:00.000Z'),
      figures: FIGURES,
    });

    const current2026 = await prisma.issuanceRecord.count({
      where: { userId, taxYear: 2026, supersededAt: null },
    });

    expect(current2026).toBe(1);
  });

  it('the database refuses two CURRENT rows for one year (partial unique index, R196)', async () => {
    await recordIssuance({
      userId,
      taxYear: 2026,
      code: newVerificationCode(),
      sha256: sha256Hex(fixtureBytes('v1')),
      generatedAt: new Date('2026-04-01T09:00:00.000Z'),
      figures: FIGURES,
    });

    // A direct insert of a SECOND current row - the state the transaction in
    // recordIssuance avoids by superseding first - is refused by the database,
    // so the invariant survives a writer that does not know the rule (R196).
    await expect(
      prisma.issuanceRecord.create({
        data: {
          code: newVerificationCode(),
          userId,
          taxYear: 2026,
          version: 99,
          supersededAt: null,
          name: 'Camille Rey',
          declarableRate: 39.16,
          teleworkDays: 94,
          missionDaysFrance: 6,
          missionDaysThirdState: 2,
          periodFraction: 1,
          periodStartDate: null,
          sha256: sha256Hex(fixtureBytes('clash')),
          generatedAt: new Date('2026-06-01T09:00:00.000Z'),
        },
      }),
    ).rejects.toThrow();
  });
});
