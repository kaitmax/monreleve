// web/tests/unit/fr/errors.test.ts
//
// FW9 AC1: "every ValidationError code maps to French copy in lib/fr; adding
// a code without copy fails CI".
//
// SPEC 8 states the requirement as a property of the pair: "ValidationError
// codes map ONE-TO-ONE onto input error messages in lib/fr - a test
// enumerates the union and fails on any gap." One-to-one in both directions,
// so a message for a code that no longer exists is as much a failure as a
// code with no message: the first is dead copy nobody will delete, and the
// second is a form that renders an empty error and blocks the user with no
// explanation.
//
// THE ENUMERATION IS A TYPE, NOT A LIST. A runtime array of code strings
// would be a second copy of the union, maintained by hand, and it would go
// stale in exactly the case this test exists to catch. Instead ERROR_COPY is
// declared `Record<Code, string>` where Code is ValidationError['code'], and
// TypeScript enforces both directions for free: a missing key is an error,
// and so is an extra one. Object.keys of that record is then a runtime list
// the type has already proved correct.
//
// So the FIRST line of defence is tsc, and this file is the second: it checks
// the things a type cannot - that no message is empty, that none is a
// duplicate of another, and that the two field-bearing codes actually
// interpolate the field rather than mentioning it in the abstract.
//
// The RED for AC1 is recorded in REPORT-FW9.txt: a seventh code planted in
// the engine's union fails `pnpm typecheck` before any test runs.

import { describe, expect, it } from 'vitest';
import type { TeleworkInput, ValidationError } from '@/lib/calc-engine';
import { ERROR_COPY, FIELD_NAMES, errorMessage } from '@/lib/fr/errors';

type Code = ValidationError['code'];

// Every code, written out. This is NOT the enumeration the test relies on -
// ERROR_COPY's own type is.
//
// WHAT THIS ARRAY DOES AND DOES NOT GUARD, stated precisely because the
// obvious claim about it is false. `readonly Code[]` accepts a SUBSET, so a
// newly added code does not make this line fail to compile; only a removed or
// renamed one does. What catches an addition here is the first test below, at
// RUNTIME: ERROR_COPY's keys are the union by construction, so comparing them
// against this array fails the moment the two disagree.
//
// Measured, not assumed. Planting a seventh code in the engine's union failed
// `pnpm typecheck` twice - the Record's missing key and errorMessage's
// `never` - while this suite stayed green at 11 passed. tsc is the first line
// of defence for AC1 and these tests are the second, and it is worth knowing
// which is which.
const CODES: readonly Code[] = [
  'RATE_OUT_OF_RANGE',
  'PERIOD_OUT_OF_RANGE',
  'NEGATIVE_DAYS',
  'GRANULARITY_MISMATCH',
  'DAYS_EXCEED_TOTAL',
  'TOTAL_WORK_DAYS_NOT_POSITIVE',
];

const FIELDS: readonly (keyof TeleworkInput)[] = [
  'taxYear',
  'canton',
  'employmentRate',
  'periodFraction',
  'denominator',
  'granularity',
  'teleworkDays',
  'missionDaysFrance',
  'missionDaysThirdState',
];

describe('every ValidationError code has French copy (AC1)', () => {
  it('covers the union exactly, in both directions', () => {
    // Object.keys is safe as an enumeration here precisely because the record
    // is typed against the union: tsc has already refused a missing or an
    // extra key by the time this runs.
    expect([...Object.keys(ERROR_COPY)].sort()).toEqual([...CODES].sort());
  });

  it('gives each code a non-empty message', () => {
    for (const code of CODES) {
      expect(ERROR_COPY[code].trim().length, `${code} has no message`).toBeGreaterThan(0);
    }
  });

  it('gives each code a DISTINCT message', () => {
    // A copy-paste that leaves two codes sharing a sentence passes every
    // check above while telling the user the wrong thing about one of them.
    const messages = CODES.map((code) => ERROR_COPY[code]);

    expect(new Set(messages).size).toBe(CODES.length);
  });

  it('names every field of TeleworkInput', () => {
    // keyof TeleworkInput, not just the fields that happen to appear in an
    // error today: NEGATIVE_DAYS carries `field: keyof TeleworkInput`, so any
    // of the nine can reach the copy layer the moment validate.ts pushes one.
    expect([...Object.keys(FIELD_NAMES)].sort()).toEqual([...FIELDS].sort());

    for (const field of FIELDS) {
      expect(FIELD_NAMES[field].trim().length, `${field} has no French name`).toBeGreaterThan(0);
    }
  });
});

describe('the two field-bearing codes interpolate the field', () => {
  const bearing: readonly Code[] = ['NEGATIVE_DAYS', 'GRANULARITY_MISMATCH'];

  for (const code of bearing) {
    it(`${code} names the field it is about`, () => {
      for (const field of FIELDS) {
        const message = errorMessage({ code, field } as ValidationError);

        expect(message, `${code} / ${field}`).toContain(FIELD_NAMES[field]);
      }
    });

    it(`${code} says something DIFFERENT for two different fields`, () => {
      // The failure a "contains the field name" check alone would miss: a
      // message built by concatenating a constant with the wrong field, or
      // with the same field every time.
      const a = errorMessage({ code, field: 'teleworkDays' } as ValidationError);
      const b = errorMessage({ code, field: 'missionDaysFrance' } as ValidationError);

      expect(a).not.toBe(b);
    });
  }

  it('leaves the other four codes free of any field name', () => {
    // They carry no field, so a message mentioning one would be describing a
    // problem the error does not identify.
    const fieldless = CODES.filter((code) => !bearing.includes(code));

    for (const code of fieldless) {
      const message = errorMessage({ code } as ValidationError);

      for (const field of FIELDS) {
        expect(message, `${code} mentions ${field}`).not.toContain(FIELD_NAMES[field]);
      }
    }
  });
});

describe('the copy obeys the vocabulary constraint (SPEC 20)', () => {
  it('uses none of certifie, atteste, conforme', () => {
    // These are input errors, so the temptation is milder than in the legal
    // note - but "non conforme" is exactly how one would be tempted to phrase
    // a validation failure, and it is the forbidden word.
    for (const code of CODES) {
      const lowered = ERROR_COPY[code].toLowerCase();

      for (const forbidden of ['certifi', 'attest', 'conform']) {
        expect(lowered, `${code} uses "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });

  it('names no threshold figure', () => {
    // The rule statuses.ts and rates.ts already carry: a threshold belongs to
    // the year's RuleSet (SPEC 7.7), never to copy, where it goes stale in
    // silence after a rule change with nothing failing.
    for (const code of CODES) {
      expect(ERROR_COPY[code], `${code} hardcodes a threshold`).not.toMatch(/\b(40|49[.,]9|10)\s*(%|jours)/);
    }
  });
});
