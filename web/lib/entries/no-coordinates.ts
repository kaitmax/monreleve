// web/lib/entries/no-coordinates.ts
//
// ===========================================================================
// NO COORDINATE EVER REACHES THIS SERVER
// ===========================================================================
//
// SPEC 13.1 / D18: "coordinates never leave the sampling function. There is no
// movement history in the database, no reverse-geocoding call, no Maps SDK,
// and NOTHING TO HAND OVER IF THE APP OR THE USER IS EVER COMPELLED TO PRODUCE
// RECORDS."
//
// The last clause is the product. A cross-border worker's tax position and a
// year of their movements are the same dataset once one server holds both, and
// /confidentialite's promise - "Aucune coordonnee geographique. Ni latitude,
// ni longitude, ni altitude, ni vitesse : jamais enregistree, jamais
// transmise, jamais journalisee" - is exactly as true as the route that
// refuses them.
//
// WHY THE SERVER REFUSES WHAT THE CLIENT SHOULD NEVER SEND. The Android app
// discards the fix inside the sampling function; that is D18's real
// enforcement and it is on-device. THIS IS THE SECOND LINE, and it exists
// because the first is a client we will not always control: a future SDK, a
// debug build, a crash reporter attaching context, a contributor adding
// `accuracy` to help diagnose something. The server refusing is what makes the
// promise survive all of them.
//
// REJECT, NEVER STRIP. Dropping a coordinate silently would let the app
// believe it sent one and be told everything was fine - the same lie as
// stripping an unknown key, on the field where it matters most. It would also
// destroy the only evidence that a client is misbehaving, which is the thing
// somebody needs in order to fix it.
//
// IT SCANS THE RAW BODY, BEFORE VALIDATION. If the schema parsed first, a
// payload rejected for some other reason would never be scanned - and the one
// interesting fact about it, that a client is sending coordinates, would go
// unrecorded. Scan first, and the refusal names which rule fired (R198).

/**
 * The keys a payload may not carry, at any depth.
 *
 * SPEC 13.1 NAMES THE FIRST SEVEN. The rest are the shapes a real client
 * library actually uses: a payload says `lat`, `lng`, `coords`, not
 * `latitude`. Banning only the spelled-out forms would refuse the payload
 * nobody sends and accept the one they do.
 *
 * MATCHED AS A SUBSTRING, case-insensitively, so `lastKnownLatitude`,
 * `gpsAccuracy` and `deviceLocationProvider` are caught too - those are the
 * shapes a field takes when somebody adds it without meaning to break a rule.
 */
export const BANNED_LOCATION_KEYS = [
  // SPEC 13.1 / D18, verbatim.
  'latitude',
  'longitude',
  'accuracy',
  'altitude',
  'speed',
  'heading',
  'provider',
  // What clients actually write.
  'lat',
  'lon',
  'lng',
  'coord',
  'coords',
  'geo',
  'location',
  'gps',
  'bearing',
  'position',
] as const;

/**
 * How deep to look.
 *
 * A BOUND RATHER THAN A RECURSION LIMIT NOBODY STATES: the scan runs on every
 * request before validation, so an adversarial payload nested ten thousand
 * deep must not be able to spend the server's stack. Sixteen is far beyond any
 * legitimate body - the real one is three - and anything deeper is refused for
 * being deeper rather than searched.
 */
const MAX_DEPTH = 16;

function isBanned(key: string): boolean {
  const lowered = key.toLowerCase();

  return BANNED_LOCATION_KEYS.some((banned) => lowered.includes(banned));
}

/**
 * Every banned key in a payload, wherever it is.
 *
 * KEYS ONLY, NEVER VALUES. A note reading "reunion a Geneve, latitude
 * inconnue" is a person writing prose, not a client sending a fix. Scanning
 * values would refuse it and teach people that the note field is
 * booby-trapped - and would catch nothing a key scan misses, because a
 * coordinate a client sends arrives under a name.
 *
 * Returns the banned key NAMES, so the refusal can say which ones without
 * echoing their values - the values being the thing this product must not
 * record, including in an error message or a log line.
 */
export function findLocationKeys(payload: unknown, depth = 0): string[] {
  if (depth > MAX_DEPTH || payload === null || typeof payload !== 'object') {
    return [];
  }

  const found: string[] = [];

  if (Array.isArray(payload)) {
    for (const element of payload) {
      found.push(...findLocationKeys(element, depth + 1));
    }

    return [...new Set(found)];
  }

  for (const [key, value] of Object.entries(payload)) {
    if (isBanned(key)) {
      found.push(key);
    }

    found.push(...findLocationKeys(value, depth + 1));
  }

  return [...new Set(found)];
}
