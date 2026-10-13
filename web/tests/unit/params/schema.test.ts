// web/tests/unit/params/schema.test.ts
//
// FW13 increment 1: the nine names are a PUBLIC CONTRACT.
//
// SPEC 9.4: "names are frozen once published - links live in Facebook threads
// for years and a renamed param breaks them silently." That is the whole
// reason this file exists before the codec does. A rename is not a
// refactor here; it is a promise broken for every link already in the wild,
// and the person who pasted it will never know - they will see a calculator
// with default values and assume they mis-copied something.
//
// SPEC 20 lists "adding or renaming a URL param" as ask-first, and this test
// is what makes that stop-and-ask unavoidable rather than optional: the list
// is asserted element by element, in order, so any edit to it fails here with
// the ruling attached.
//
// AND NO PERSONAL DATA IS REPRESENTABLE. SPEC 20, never: "put personal data in
// a URL param". That is asserted over the KEY SET rather than by reading the
// values, because the values are the user's and the keys are ours - a schema
// with no field for a name cannot carry one whatever anybody types.

import { describe, expect, it } from 'vitest';
import { PARAM_NAMES, PARAM_SCHEMA } from '@/lib/params/schema';

describe('the ten param names are frozen (SPEC 9.4, R343)', () => {
  it('is exactly the ten, in the order the URL contract tabulates them', () => {
    // ORDER IS PART OF IT, because encode walks this list to build the query
    // string: a shared URL reads canton first and debut last, the way the
    // table does. A reordering would produce different URLs for identical
    // inputs, which makes two links to the same scenario look different.
    expect([...PARAM_NAMES]).toEqual([
      'canton',
      'taux',
      'tt',
      'mfr',
      'mtiers',
      'methode',
      'total',
      'decompte',
      'debut',

      // R343, AND THIS LINE IS THE RENAME TEST THE RULING ASKS FOR.
      //
      // "Document them in the calculator's URL contract as FROZEN from the
      // first deploy, and add a test that fails if any of them is renamed."
      // Editing the string below breaks every link that has ever carried a
      // rhythm, and the break is silent for the reader: they see a
      // calculator full of defaults and assume they mis-copied it. A
      // rename therefore has to be a deliberate act with this failure in
      // front of it.
      //
      // IT ARRIVED LAST, AFTER debut, and that is part of the contract too:
      // encode walks this list, so appending rather than inserting means
      // every URL shared before R343 still encodes byte-for-byte the same.
      'rythme',
    ]);
  });

  it('has a schema entry for every name and no others', () => {
    expect(Object.keys(PARAM_SCHEMA).sort()).toEqual([...PARAM_NAMES].sort());
  });

  it('gives every param a documented meaning', () => {
    // A param whose purpose nobody wrote down is one nobody can decide to
    // remove, which is how a public contract acquires entries that mean
    // whatever the last edit made them mean.
    for (const name of PARAM_NAMES) {
      expect(PARAM_SCHEMA[name]?.field.length, name).toBeGreaterThan(0);
    }
  });
});

describe('no personal data is representable (SPEC 20, AC3)', () => {
  it('carries no field that could hold an identity', () => {
    // THE KEY SET IS THE PROOF, not a scan of values. A user can type their
    // name into the telework-days field and it will be rejected as a number;
    // what matters is that the schema has nowhere for a name to GO. Asserted
    // against the words a leak would most plausibly arrive under - in both
    // languages, because the params are French and the codebase is English.
    const FORBIDDEN = [
      'nom',
      'name',
      'prenom',
      'email',
      'mail',
      'tel',
      'phone',
      'adresse',
      'address',
      'employeur',
      'employer',
      'salaire',
      'salary',
      'revenu',
      'income',
      'iban',
      'avs',
      'ahv',
      'naissance',
      'birth',
      'id',
    ];

    for (const name of PARAM_NAMES) {
      for (const forbidden of FORBIDDEN) {
        expect(name.toLowerCase(), `${name} looks like personal data`).not.toContain(
          forbidden,
        );
      }
    }
  });

  it('maps every param into the engine input or the closed forecast set', () => {
    // R343 ADDED THE FIRST PARAM THAT DOES NOT MAP INTO TeleworkInput, and
    // the argument below is extended rather than dropped. `rythme` is an
    // input to the PROJECTION, not to the engine, so TeleworkInput has no
    // field for it - and widening that type to make this test pass would
    // have been the wrong repair twice over, since it is the engine public
    // API and SPEC 20 makes changing it an ask-first item.
    //
    // WHAT REPLACES IT IS NARROWER, NOT LOOSER. A forecast field value space
    // is closed and enumerable: the rhythm is three symbols in five
    // positions, 243 legal strings, and rhythm.test.ts walks every one of
    // them. A format with 243 legal values cannot hold a name, an address or
    // a salary whatever anybody types - a stronger guarantee than "it maps
    // to a numeric field", not a weaker one.
    // The stronger statement, and the one that survives a param being added
    // with an innocuous name: every key maps into the engine's input, which
    // holds days, rates and a canton. There is no field on it that could
    // carry an identity, so a param that maps onto it cannot either.
    const ENGINE_FIELDS = [
      'canton',
      'employmentRate',
      'teleworkDays',
      'missionDaysFrance',
      'missionDaysThirdState',
      'denominator.kind',
      'denominator.totalWorkDays',
      'granularity',
      'periodFraction',
    ];

    // ASSERTED EMPTY OF EVERYTHING ELSE (R206 corollary). The forecast set is
    // spelled out here rather than imported as a list to iterate, so a second
    // forecast field is a deliberate act that must survive this line rather
    // than the second entry in an established habit.
    const FORECAST_FIELDS = ['rhythm'];

    for (const name of PARAM_NAMES) {
      expect(
        [...ENGINE_FIELDS, ...FORECAST_FIELDS],
        `${name} maps to ${PARAM_SCHEMA[name]?.field}`,
      ).toContain(PARAM_SCHEMA[name]?.field);
    }

    // AND ONLY ONE PARAM TAKES THE NEW ROUTE. Without this, widening the
    // accepted set above would let any param claim to be a forecast field and
    // escape the engine-input argument entirely.
    const forecastParams = PARAM_NAMES.filter((name) =>
      FORECAST_FIELDS.includes(PARAM_SCHEMA[name]?.field ?? ''),
    );

    expect(forecastParams).toEqual(['rythme']);
  });

  it('covers every field of TeleworkInput except the tax year', () => {
    // NON-VACUITY IN THE OTHER DIRECTION. The assertion above passes if the
    // schema shrinks; this one says the nine still reach everything the
    // engine needs. taxYear is deliberately absent - it comes from the
    // server's clock (R55), and a param for it would let a link pin the
    // product to a year whose rules it is not showing.
    const mapped = PARAM_NAMES.map((name) => PARAM_SCHEMA[name]?.field);

    expect(mapped).toContain('canton');
    expect(mapped).toContain('periodFraction');
    expect(mapped).toContain('denominator.totalWorkDays');
    expect(mapped).not.toContain('taxYear');
    expect(new Set(mapped).size).toBe(PARAM_NAMES.length);
  });
});
