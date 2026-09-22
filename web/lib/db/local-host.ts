// web/lib/db/local-host.ts
//
// Is this connection string pointed at a database on this machine?
//
// ============================================================================
// ONE PREDICATE, TWO CALLERS THAT REFUSE FOR DIFFERENT REASONS (R206)
// ============================================================================
//
// `prisma/seed.ts` has refused a non-local database since FW21: a seed is a
// data-writing command with a friendly name, and running it against the wrong
// database puts invented rows beside real people's addresses.
//
// FW27's scheduler refuses for a sharper reason (R243): it is the first code
// in this product that ACTS WITHOUT A REQUEST. A test that accidentally
// delivers is not a failing test - it is an email or a push in somebody's
// hand, and there is no undo.
//
// The two refusals say different things and mean different things. What they
// must not do is disagree about what "local" IS - two lists of hostnames, one
// of which learns about `::1` and the other of which does not, is the drift
// R206 exists to prevent on a guard where being wrong is expensive.
//
// ============================================================================
// THE SEED DOES NOT YET IMPORT THIS, AND THE REASON IS A TOOLCHAIN CONFLICT
// ============================================================================
//
// It was wired up and reverted inside FW27. `prisma/seed.ts` runs under
// `node --experimental-strip-types`, which resolves no `@/` aliases and
// REQUIRES the `.ts` extension on a relative import. `tsc` rejects that
// extension unless `allowImportingTsExtensions` is set, and the main
// tsconfig compiles `**/*.ts`, so enabling it is a project-wide compiler
// change to remove one duplicated three-element list.
//
// The seed therefore keeps its own inline check for now, and this file has
// ONE caller. That is a declared duplication rather than an unnoticed one -
// PARKED in REPORT-FW27.txt with the two ways out.
//
// IT STILL IMPORTS NOTHING, so the day that conflict is resolved the seed can
// reach it without anything else moving.

/** The hosts that mean "this machine". */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/**
 * The hostname of a connection string, or null when it cannot be read.
 *
 * A string that will not parse is NOT local. Returning null rather than
 * throwing lets each caller phrase its own refusal, which is the half R198
 * cares about.
 */
export function databaseHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/**
 * Whether a connection string points at this machine.
 *
 * UNPARSEABLE IS NOT LOCAL. The alternative - treating a malformed URL as
 * local because no remote host could be read from it - is a guard that opens
 * when its input is broken, which is the wrong direction for a guard whose
 * failure mode is sending to real people.
 */
export function isLocalDatabase(url: string | undefined): boolean {
  if (url === undefined || url === '') return false;

  const host = databaseHost(url);

  return host !== null && LOCAL_HOSTS.has(host);
}
