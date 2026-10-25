// web/tests/db/name-change.test.ts
//
// Name changes are kept BY DATE, and shown by date only. FW-VERIFY (R331).
//
// ============================================================================
// WHAT R331 ASKS, AND WHAT THIS PROVES
// ============================================================================
//
// The server records WHEN a name changed, never the old value. Each issued
// releve already holds the name it was printed with, so the history of names
// lives there; a separate list of former names would be a tax document carrying
// somebody's maiden or pre-transition name, which is a real harm.
//
// So this file proves two things against a real database:
//   1. PATCH /api/v1/me records a NameChange when the name actually changes -
//      and does NOT when it is set for the first time or re-sent unchanged;
//   2. a dossier for a tax year in which the name changed carries the change
//      DATE and the current name, and the former name appears NOWHERE in it.

import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { issueTokenPair } from '@/lib/auth/tokens';
import { PATCH } from '@/app/api/v1/me/route';
import { buildDossierFor } from '@/lib/dossier/load';
import { currentTaxYear } from '@/lib/content/tax-year';
import { parisDayOf } from '@/lib/entries/day';

const ORIGIN = 'https://monreleve.ch';

function patch(payload: unknown, bearer: string): Request {
  return new Request(`${ORIGIN}/api/v1/me`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
    body: JSON.stringify(payload),
  });
}

async function user(name: string | null): Promise<{ id: string; token: string }> {
  const row = await prisma.user.create({
    data: { email: `nc-${Math.random().toString(36).slice(2)}@example.com`, name, canton: 'GE', employmentRate: 100 },
  });

  return { id: row.id, token: (await issueTokenPair(row.id)).accessToken };
}

beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('recording the change (R331): the date, never the former value', () => {
  it('records ONE NameChange when the name actually changes', async () => {
    const { id, token } = await user('Camille Rey');

    const response = await PATCH(patch({ name: 'Camille Martin' }, token));

    expect(response.status).toBe(200);

    const changes = await prisma.nameChange.findMany({ where: { userId: id } });

    expect(changes).toHaveLength(1);
    // IT DOES NOT STORE THE FORMER VALUE. The row is a date and a user, and the
    // schema has no column that could hold "Camille Rey".
    expect(JSON.stringify(changes)).not.toContain('Camille Rey');

    // The current name is the new one.
    const after = await prisma.user.findUnique({ where: { id } });

    expect(after?.name).toBe('Camille Martin');
  });

  it('records NOTHING when the name is set for the FIRST time', async () => {
    // Establishing a name is not changing one - there was no prior name to
    // have changed from. Onboarding's first step must not look like a change.
    const { id, token } = await user(null);

    await PATCH(patch({ name: 'Camille Rey' }, token));

    expect(await prisma.nameChange.count({ where: { userId: id } })).toBe(0);
  });

  it('records NOTHING when the same name is re-sent', async () => {
    const { id, token } = await user('Camille Rey');

    await PATCH(patch({ name: 'Camille Rey' }, token));

    expect(await prisma.nameChange.count({ where: { userId: id } })).toBe(0);
  });

  it('records a SECOND change as a second row', async () => {
    const { id, token } = await user('Camille Rey');

    await PATCH(patch({ name: 'Camille Martin' }, token));
    await PATCH(patch({ name: 'Camille Durand' }, token));

    expect(await prisma.nameChange.count({ where: { userId: id } })).toBe(2);
  });
});

describe('the document line (R331): shown by date, and a former name appears nowhere', () => {
  // R171 and R582: "the year of the change" is the Paris year - the window
  // buildDossierFor applies. A UTC year here would be the wrong one for the
  // hour a year the two clocks disagree.
  const YEAR = currentTaxYear();

  it('a dossier for the year of the change carries the date and the current name only', async () => {
    const { id, token } = await user('Camille Rey');

    await PATCH(patch({ name: 'Camille Martin' }, token));

    const dossier = await buildDossierFor(id, YEAR);

    // THE LINE'S TRIGGER: a change exists within this tax year.
    expect(dossier.nameChangedAt).not.toBeNull();
    expect(dossier.titulaire).toBe('Camille Martin');

    // THE WHOLE POINT: the former name is in the payload NOWHERE, so it cannot
    // reach the document or the verification page (R331).
    expect(JSON.stringify(dossier)).not.toContain('Camille Rey');
  });

  it('a dossier for a year with no change in it carries no date', async () => {
    const { id, token } = await user('Camille Rey');

    await PATCH(patch({ name: 'Camille Martin' }, token));

    // The change happened this year, so a PRIOR year's releve must not show it.
    const dossier = await buildDossierFor(id, YEAR - 1);

    expect(dossier.nameChangedAt).toBeNull();
  });
});

// ============================================================================
// FW-DOSSIER-EMPTY R582: THE CHANGE BELONGS TO ITS PARIS YEAR, AND ITS PARIS DAY
// ============================================================================
//
// R582's audit: buildDossierFor decides which tax year's document carries the
// "Nom modifie le <date>" line, and prints its date. Both were read in UTC, so
// a change at 00:30 on 1 January in Paris (23:30 UTC on 31 December) was put on
// the PREVIOUS year's releve, dated the 31st. Tested at that same hour, in both
// directions: the instant an hour later in UTC terms stays where it was.
describe('R582: a name change is placed by the Paris clock', () => {
  async function changedAt(instant: string): Promise<string> {
    const { id } = await user('Camille Martin');

    await prisma.nameChange.create({ data: { userId: id, changedAt: new Date(instant) } });

    return id;
  }

  it('a change at 00:30 on 1 January in Paris is on the NEW year, dated 1 January', async () => {
    const instant = '2026-12-31T23:30:00.000Z';
    // R171: the Paris day is derived, never typed - and it IS the disagreeing
    // hour, or this test proves nothing.
    const parisDay = parisDayOf(new Date(instant));
    const parisYear = Number(parisDay.slice(0, 4));

    expect(parisYear).toBe(new Date(instant).getUTCFullYear() + 1);

    const id = await changedAt(instant);

    expect((await buildDossierFor(id, parisYear)).nameChangedAt).toBe(parisDay);
    expect((await buildDossierFor(id, parisYear - 1)).nameChangedAt).toBeNull();
  });

  it('a change at 23:30 on 31 December in Paris stays on the OLD year, dated the 31st', async () => {
    // The other direction (R196): a window that moved every change forward a
    // year would pass the test above.
    const instant = '2026-12-31T22:30:00.000Z';
    const parisDay = parisDayOf(new Date(instant));
    const parisYear = Number(parisDay.slice(0, 4));

    expect(parisYear).toBe(new Date(instant).getUTCFullYear());

    const id = await changedAt(instant);

    expect((await buildDossierFor(id, parisYear)).nameChangedAt).toBe(parisDay);
    expect((await buildDossierFor(id, parisYear + 1)).nameChangedAt).toBeNull();
  });
});
