// web/tests/unit/entries/no-coordinates.test.ts
//
// ===========================================================================
// NO COORDINATE EVER REACHES THIS SERVER, AND THIS IS THE FILE THAT SAYS SO
// ===========================================================================
//
// SPEC 13.1 / D18: "coordinates never leave the sampling function. There is no
// movement history in the database, no reverse-geocoding call, no Maps SDK,
// and NOTHING TO HAND OVER IF THE APP OR THE USER IS EVER COMPELLED TO PRODUCE
// RECORDS."
//
// That last clause is the product. A cross-border worker's tax position and a
// year of their movements are the same dataset if one server holds both, and
// the promise on /confidentialite - "Aucune coordonnee geographique. Ni
// latitude, ni longitude, ni altitude, ni vitesse" - is only as true as the
// route that refuses them.
//
// THE FILE IS NAMED SO THAT DELETING IT MEANS DELETING A SENTENCE. A test
// called "validation.test.ts" can be removed by somebody tidying up; this one
// cannot be removed without a person reading what it is for and deciding to
// remove that instead. AC2 asks for the test to be named for exactly this
// reason.
//
// WHY THE SERVER REFUSES SOMETHING THE CLIENT SHOULD NEVER SEND. The Android
// app discards the fix in the sampling function - that is D18's real
// enforcement, on-device. This route is the SECOND line, and it exists because
// the first is a client we will not always control: a future SDK, a debug
// build, a crash reporter attaching context, a well-meaning contributor adding
// `accuracy` to help with a bug. The server refusing is what makes the promise
// survive all of them.
//
// AND IT REJECTS RATHER THAN STRIPS. Silently dropping a coordinate would let
// the app believe it sent one and be told everything was fine - which is the
// same lie as stripping an unknown key, on the field where it matters most.

import { describe, expect, it } from 'vitest';
import { BANNED_LOCATION_KEYS, findLocationKeys } from '@/lib/entries/no-coordinates';
import { entriesBatchSchema } from '@/lib/entries/schema';

/** A payload that is otherwise perfectly valid. */
function batch(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entries: [
      {
        clientMutationId: '9f8a7b6c-5d4e-4f3a-2b1c-0d9e8f7a6b5c',
        dayDate: '2026-04-07',
        portion: 'FULL',
        kind: 'CH',
        ...extra,
      },
    ],
  };
}

describe('the banned set is the one SPEC 13.1 names', () => {
  it.each([
    'latitude',
    'longitude',
    'accuracy',
    'altitude',
    'speed',
    'heading',
    'provider',
  ])('bans %s', (key) => {
    expect(BANNED_LOCATION_KEYS).toContain(key);
  });

  it('bans the abbreviations a client library actually uses', () => {
    // SPEC names the words; a real payload says `lat`, `lon`, `lng`, `coords`.
    // Banning only the spelled-out forms would refuse the payload nobody sends
    // and accept the one they do.
    for (const key of ['lat', 'lon', 'lng', 'coord', 'coords', 'geo', 'location']) {
      expect(BANNED_LOCATION_KEYS).toContain(key);
    }
  });
});

describe('a coordinate is found wherever it hides', () => {
  // FOUR FORMS, because a check that only looks at the top level is a check
  // somebody walks around by nesting one object.

  it('finds it at the top level of an item', () => {
    expect(findLocationKeys(batch({ latitude: 46.2 }))).toContain('latitude');
  });

  it('finds it inside a nested object', () => {
    expect(findLocationKeys(batch({ fix: { latitude: 46.2, longitude: 6.1 } }))).toEqual(
      expect.arrayContaining(['latitude', 'longitude']),
    );
  });

  it('finds it inside an array', () => {
    expect(findLocationKeys(batch({ samples: [{ accuracy: 12 }] }))).toContain('accuracy');
  });

  it('finds it in a key whose NAME CONTAINS a banned word', () => {
    // `lastKnownLatitude`, `gpsAccuracy`, `deviceLocationProvider` - the shapes
    // a field acquires when somebody adds it without meaning to break a rule.
    const found = findLocationKeys(
      batch({ lastKnownLatitude: 46.2, gpsAccuracy: 5, deviceLocationProvider: 'fused' }),
    );

    expect(found.length).toBeGreaterThanOrEqual(3);
  });

  it('is case-insensitive', () => {
    expect(findLocationKeys(batch({ Latitude: 46.2 }))).not.toEqual([]);
    expect(findLocationKeys(batch({ GPS_LONGITUDE: 6.1 }))).not.toEqual([]);
  });

  it('finds it several levels down', () => {
    expect(
      findLocationKeys(batch({ debug: { device: { sensors: [{ speed: 0 }] } } })),
    ).toContain('speed');
  });

  it('finds it in the batch envelope, not only in an item', () => {
    // A client attaching context to the whole request rather than to a day.
    expect(findLocationKeys({ ...batch(), origin: { latitude: 46.2 } })).toContain('latitude');
  });
});

describe('a clean payload is not flagged, which is what makes the check mean anything', () => {
  // NON-VACUITY. A detector that returned every key would pass every test
  // above. These are the fields a real sync sends, and none of them may trip
  // it.
  it('passes the full legitimate item', () => {
    expect(
      findLocationKeys(
        batch({
          note: 'journee en Suisse',
          provenance: 'DETECTED_CORRECTED',
          detectedKind: 'CH',
          detectedAt: '2026-04-07T17:48:00.000Z',
          clientClaimedAt: '2026-04-07T18:03:00.000Z',
        }),
      ),
    ).toEqual([]);
  });

  it('does not trip on the word inside an ordinary VALUE', () => {
    // The rule is about KEYS. A note saying "reunion a Geneve, latitude
    // inconnue" is a person writing prose, not a client sending a fix - and
    // refusing it would teach people that the note field is booby-trapped.
    expect(findLocationKeys(batch({ note: 'latitude inconnue, longitude aussi' }))).toEqual([]);
  });

  it('does not trip on `provider` inside a value either', () => {
    expect(findLocationKeys(batch({ note: 'change de provider telephonique' }))).toEqual([]);
  });
});

describe('the schema refuses them too, by a different mechanism', () => {
  // TWO INDEPENDENT REFUSALS, and that is deliberate rather than redundant.
  //
  // The schema's `.strict()` refuses any unknown key, so `latitude` at the top
  // level of an item never reaches the scanner. The scanner exists for what
  // strict() cannot see: a banned key nested inside a value of a field we DO
  // accept, and the batch envelope.
  //
  // Neither alone covers AC2. Together, a coordinate has nowhere to be.

  it('strict() alone stops a top-level coordinate', () => {
    expect(entriesBatchSchema.safeParse(batch({ latitude: 46.2 })).success).toBe(false);
  });

  it('and the scanner is what stops one nested in an accepted field', () => {
    // `note` is a string, so an object cannot hide inside it - but this proves
    // the scanner runs over the WHOLE payload rather than over the parsed
    // result, which is the ordering AC2 needs: scan before parse, or a
    // rejected payload is never scanned and the log never records the attempt.
    const payload = { ...batch(), telemetry: { lat: 46.2 } };

    expect(entriesBatchSchema.safeParse(payload).success).toBe(false);
    expect(findLocationKeys(payload)).toContain('lat');
  });
});
