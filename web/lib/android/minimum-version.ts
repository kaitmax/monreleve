// web/lib/android/minimum-version.ts
//
// The minimum supported Android versionCode, from ONE server setting. AN-FORCE-UPDATE (R1110).
//
// ============================================================================
// UNSET, EMPTY OR MALFORMED MEANS NO MINIMUM - AND THE PARSE IS STRICT
// ============================================================================
//
// SPEC 18.1: "the API can flag a minimum supported version, and the app shows
// a plain update screen". The flag is this setting. It ships UNSET, so the
// mechanism is inert until the operator sets a value in Coolify.
//
// A wrong number here is the expensive error. A minimum above the version in
// people's hands replaces the whole app with an update screen whose button
// leads to a listing that may hold nothing newer. So anything that is not
// unmistakably a versionCode reads as NO minimum, never as a guess: the value
// must be decimal digits with no sign, no leading zero, no exponent and no
// trailing text (Number('') is 0, Number('1e3') is 1000 and parseInt('12abc')
// is 12 - each pinned by a test), between 1 and Play's versionCode ceiling.
// Surrounding whitespace is the one leniency: a value pasted into a settings
// form with a trailing newline still means what it says.
//
// READ AT REQUEST TIME. The route is dynamic and calls this per request, so a
// value set in Coolify takes effect on a restart, never on a rebuild. That is
// also why it is not in DEPLOYMENT_VARIABLES: absent is the designed default,
// not a degraded state, and nothing should report or refuse on it.

/** The name of the one setting (docs/deploy.md section 2, docs/api-v1.md section 15). */
export const ANDROID_MINIMUM_VERSION_ENV = 'ANDROID_MINIMUM_VERSION_CODE';

/**
 * The largest versionCode Google Play accepts (android/app/build.gradle.kts,
 * AN14a increment 5). A minimum above it could never be met by any build.
 */
export const PLAY_VERSION_CODE_CEILING = 2_100_000_000;

const DECIMAL_VERSION_CODE = /^[1-9][0-9]*$/u;

/** The minimum supported versionCode, or null when there is none to believe. */
export function minimumVersionCode(
  value: string | undefined = process.env[ANDROID_MINIMUM_VERSION_ENV],
): number | null {
  if (value === undefined) return null;

  const trimmed = value.trim();

  if (!DECIMAL_VERSION_CODE.test(trimmed)) return null;

  const code = Number(trimmed);

  if (!Number.isSafeInteger(code) || code > PLAY_VERSION_CODE_CEILING) return null;

  return code;
}
