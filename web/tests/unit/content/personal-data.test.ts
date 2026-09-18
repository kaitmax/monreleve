// web/tests/unit/content/personal-data.test.ts
//
// The privacy notice's enumeration is DERIVED from the schema, not remembered.
//
// « pour votre compte et pour lui seul » closes the list, so an addition does
// not make the notice incomplete - it makes it FALSE. FW22 proved the hand
// maintained version does not hold: sign-in stored sessions and hashed
// credentials, the list still ended before them, and nothing failed.
//
// THE DRIFT HAS A DIRECTION. Every task that adds a column adds something
// stored before it adds a sentence, so the notice drifts towards claiming
// LESS is held than is held - the failure a privacy notice cannot afford.
// FW23, FW26, FW27 and AN5 all add columns. This file is what makes each of
// them a failing test instead of a silent falsehood.
//
// IT READS THE SCHEMA FILE, not the generated client. The schema is the thing
// a person edits, so it is the thing a person can forget to disclose; and a
// test that read the client would pass for a column added but not migrated,
// which is exactly the window in which somebody moves on.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIDENTIALITE_COPY, DISCLOSED_RECORDS } from '@/lib/fr/confidentialite';
import { NOT_PERSONAL, PERSONAL_DATA } from '@/lib/content/personal-data';

const SCHEMA = join(process.cwd(), 'prisma', 'schema.prisma');

/**
 * Every stored column in the schema, as `Model.column`.
 *
 * WHAT IT SKIPS, AND WHY EACH IS SAFE:
 *   - `model` blocks only. enums declare no columns.
 *   - lines starting `@@` are indexes and constraints, not columns.
 *   - a field whose TYPE is another model is a relation, which Prisma does
 *     not store as a column; its scalar `xId` sibling IS listed and is what
 *     actually holds data.
 *   - comments and blank lines.
 */
function columnsInSchema(): string[] {
  const source = readFileSync(SCHEMA, 'utf8');
  const models = new Set<string>();

  for (const match of source.matchAll(/^model\s+(\w+)\s*\{/gmu)) {
    models.add(match[1] ?? '');
  }

  const columns: string[] = [];
  let current: string | null = null;

  for (const raw of source.split('\n')) {
    const line = raw.trim();

    const opening = /^model\s+(\w+)\s*\{/u.exec(line);

    if (opening !== null) {
      current = opening[1] ?? null;
      continue;
    }

    if (line === '}') {
      current = null;
      continue;
    }

    if (current === null || line === '' || line.startsWith('//') || line.startsWith('///')) {
      continue;
    }

    if (line.startsWith('@@')) {
      continue;
    }

    const field = /^(\w+)\s+(\w+)/u.exec(line);

    if (field === null) {
      continue;
    }

    const [, name, type] = field;

    // A relation field: its type is another model. Not a stored column.
    if (type !== undefined && models.has(type)) {
      continue;
    }

    columns.push(`${current}.${name ?? ''}`);
  }

  return columns;
}

/** Every French string the notice ships, flattened. */
function noticeText(): string {
  const parts: string[] = [];

  const walk = (value: unknown): void => {
    if (typeof value === 'string') {
      parts.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(walk);
    } else if (value !== null && typeof value === 'object') {
      Object.values(value).forEach(walk);
    }
  };

  walk(CONFIDENTIALITE_COPY);

  return parts.join('\n');
}

describe('the schema is read at all', () => {
  it('finds a plausible number of columns', () => {
    // NON-VACUITY FIRST. Every assertion below is of the form "every column
    // is accounted for", and that is satisfied by finding no columns - a
    // changed schema path, a parser that stopped matching, a file that moved.
    // R169's corollary: an absence assertion means nothing until presence is
    // established.
    const columns = columnsInSchema();

    expect(columns.length).toBeGreaterThan(50);
    expect(columns).toContain('User.email');
    expect(columns).toContain('Entry.dayDate');
    expect(columns).toContain('SessionToken.tokenHash');
  });

  it('does not mistake a relation for a column', () => {
    const columns = columnsInSchema();

    // `user User @relation(...)` is not stored; `userId String` is.
    expect(columns).not.toContain('Entry.user');
    expect(columns).toContain('Entry.userId');
  });
});

describe('every stored column is accounted for', () => {
  it('has a disclosure or a stated reason it is not personal data', () => {
    const unaccounted = columnsInSchema().filter(
      (column) => !(column in PERSONAL_DATA) && !(column in NOT_PERSONAL),
    );

    expect(
      unaccounted,
      unaccounted.length === 0
        ? ''
        : 'These columns are stored and the privacy notice does not account for them.\n' +
          'The enumeration under « pour votre compte et pour lui seul » is CLOSED, so a\n' +
          'column missing here is not an omission - it is a published falsehood.\n' +
          'Add each to PERSONAL_DATA with the disclosure that covers it, or to\n' +
          'NOT_PERSONAL with the reason it is not personal data:\n  ' +
          unaccounted.join('\n  '),
    ).toEqual([]);
  });

  it('maps nothing that is not in the schema', () => {
    // The other direction: a column removed from the schema leaves a stale
    // entry claiming something is stored that is not. Over-disclosure is the
    // safe direction and is still wrong.
    const columns = new Set(columnsInSchema());
    const stale = Object.keys(PERSONAL_DATA).filter((column) => !columns.has(column));

    expect(stale).toEqual([]);
  });
});

describe('every disclosure actually appears on the page', () => {
  it.each(Object.entries(DISCLOSED_RECORDS))('%s is in the notice', (_key, fragment) => {
    // R181: the mapping is a derivation, not a convention. Rename a
    // disclosure here without changing the copy and this fails; delete the
    // sentence from the page and this fails.
    expect(noticeText()).toContain(fragment);
  });

  it('uses every disclosure it declares', () => {
    // A disclosure nobody maps is a sentence on the page describing something
    // the schema does not hold - the over-disclosure direction, and a sign
    // the list and the page have drifted apart in the other direction too.
    const used = new Set(Object.values(PERSONAL_DATA));
    const unused = Object.keys(DISCLOSED_RECORDS).filter((key) => !used.has(key as never));

    expect(unused).toEqual([]);
  });
});

describe('the FW22 columns that broke the closed list', () => {
  // NAMED EXPLICITLY, not left to the general rule. These are the ones that
  // were stored while the notice said the list ended before them, and a
  // regression here is the exact defect this file was written for.
  it.each([
    'DeviceSession.createdAt',
    'DeviceSession.revokedReason',
    'SessionToken.tokenHash',
    'SessionToken.expiresAt',
    'VerificationToken.identifier',
  ])('%s is disclosed', (column) => {
    expect(PERSONAL_DATA[column]).toBeDefined();
  });

  it('discloses sessions and credentials in words a reader can check', () => {
    const text = noticeText();

    expect(text).toContain('vos connexions');
    expect(text).toContain('les identifiants de connexion eux-mêmes');
    // The hashing is the part that makes the disclosure bearable, so the page
    // has to say it rather than leaving "credentials are stored" standing.
    expect(text).toContain('empreinte');
    expect(text).toContain('jamais en clair');
  });
});

describe('the NOT_PERSONAL escape hatch', () => {
  it('gives a reason for every exemption', () => {
    for (const [column, reason] of Object.entries(NOT_PERSONAL)) {
      expect(reason.length, `${column} is exempted with no reason`).toBeGreaterThan(20);
    }
  });

  it('is empty today, which is the audit result rather than an oversight', () => {
    // FW22 classified all sixty-odd columns and adversarially challenged every
    // not-personal verdict. None survived: every table here is keyed to a
    // person, so a column on one is about that person even when its value
    // looks like plumbing. If this ever stops being empty, the entry needs to
    // survive the same challenge.
    expect(Object.keys(NOT_PERSONAL)).toEqual([]);
  });
});
