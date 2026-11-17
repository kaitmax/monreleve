// web/lib/verification/database-unreachable.ts
//
// Which errors mean "the database could not be reached". FW-VERIFIER-OUTAGE
// (R1022 as amended by Web Ruling 20, item 4).
//
// ============================================================================
// AN ALLOW-LIST BY CONNECTION-LEVEL CAUSE, NOT A CATCH-ALL
// ============================================================================
//
// /verifier/[code] answers "verification is temporarily unavailable" when its
// lookup cannot reach the database. That sentence is only true for an outage,
// so ONLY a listed cause takes that path: every other error is thrown on, as
// before, and the framework answers its 500. A missing table, a bad argument
// or a defect of ours is never dressed up as an outage.
//
// THE LIST IS WHAT WAS MEASURED, with the lookup's own query through a client
// built as lib/db/client.ts builds it (REPORT-FW-VERIFIER-OUTAGE.txt):
//   P1001  DatabaseNotReachable  a refused port; an unresolvable host
//   P1008  SocketTimeout         an address that accepts and never answers
// and NOT, as controls: P2010 (TableDoesNotExist, a missing table) and
// PrismaClientValidationError (a bad argument). A code joins the list when a
// measurement shows it is connection-level, never because it looks likely.
//
// KEYED ON THE CODE, NOT ON THE ADAPTER'S CAUSE KIND. The code is Prisma's
// published error reference; the cause kind sits inside `meta`, a detail of the
// pg adapter. They were measured one-to-one, and the page LOGS both, so a
// shape that ever disagrees is visible in the server log.
//
// IT LIVES BESIDE THE LOOKUP, NOT IN lib/db/, because this page is its only
// caller. A second caller (the bearer routes' outage envelope is the likely
// one) moves it to lib/db/ rather than copying it (R206).

import { Prisma } from '@prisma/client';

/** The connection-level Prisma codes that mean the database could not be reached. */
export const UNREACHABLE_CODES: readonly string[] = Object.freeze(['P1001', 'P1008']);

/** True only for a Prisma request error whose code is on the list above. */
export function isDatabaseUnreachable(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && UNREACHABLE_CODES.includes(error.code);
}

/**
 * The pg adapter's own name for the cause, when the error carries one:
 * `meta.driverAdapterError.cause.kind` (DatabaseNotReachable, SocketTimeout).
 */
function adapterCauseKind(error: Prisma.PrismaClientKnownRequestError): string | undefined {
  const adapter: unknown = error.meta?.['driverAdapterError'];

  if (typeof adapter !== 'object' || adapter === null || !('cause' in adapter)) return undefined;

  const cause: unknown = adapter.cause;

  if (typeof cause !== 'object' || cause === null || !('kind' in cause)) return undefined;

  return typeof cause.kind === 'string' ? cause.kind : undefined;
}

/** "P1001, DatabaseNotReachable": what the page logs, so the shape is on record. */
export function describeUnreachable(error: Prisma.PrismaClientKnownRequestError): string {
  const kind = adapterCauseKind(error);

  return kind === undefined ? error.code : `${error.code}, ${kind}`;
}
