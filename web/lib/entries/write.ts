// web/lib/entries/write.ts
//
// What a batch does to the database. FW23 increment 3.
//
// ============================================================================
// THE WHOLE BATCH, OR NONE OF IT
// ============================================================================
//
// One batch is one user action - the offline queue flushing - and a
// half-applied batch leaves the client unable to say what happened: some days
// stored, some not, no way to tell which without reading them back. So it runs
// in a transaction.
//
// THE RETRY IS WHAT MAKES THAT SAFE. A client that gets an error re-sends the
// whole batch, and clientMutationId deduplication means the items that did
// land the first time are acknowledged rather than duplicated (D30). Without
// dedup, all-or-nothing would turn every failure into a fork in the road;
// with it, the recovery is "send it again".
//
// ============================================================================
// TENANCY IS THE ARGUMENT, NOT THE PAYLOAD
// ============================================================================
//
// `userId` is a parameter to this function and comes from the bearer token
// (FW22's guard). No field of an item is ever consulted for identity - the
// schema rejects a `userId` key outright, and this file would ignore one if it
// arrived. A rule enforced by NEVER READING THE VALUE cannot be got wrong by a
// later edit that forgets it.

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/client';
import { toStoredDay } from '@/lib/entries/day';
import type { EntryItem } from '@/lib/entries/schema';

export interface WriteResult {
  readonly ok: boolean;
  /** Items that produced a row. */
  readonly written: number;
  /** Items whose clientMutationId had been seen before (D30). */
  readonly duplicates: number;
  /** Set when ok is false. A stable code, never prose (R198). */
  readonly code?: 'conflict' | 'write_failed';
}

/**
 * Apply a batch.
 *
 * THE SERVER CLOCK IS TAKEN ONCE, at the top, and used for every row and every
 * event in the batch. Two rows written by one request share a receipt time,
 * which is true - they arrived together - and it makes the trail readable: an
 * event and the entry it records carry the same instant rather than differing
 * by however long the loop took.
 */
export async function writeEntries(userId: string, items: EntryItem[]): Promise<WriteResult> {
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      // D30, AND IT IS ONE QUERY RATHER THAN ONE PER ITEM. The ids are the
      // client's own, so the set of already-seen ones is a single lookup.
      const seen = new Set(
        (
          await tx.entry.findMany({
            where: {
              userId,
              clientMutationId: { in: items.map((item) => item.clientMutationId) },
            },
            select: { clientMutationId: true },
          })
        ).map((row) => row.clientMutationId),
      );

      let written = 0;

      for (const item of items) {
        if (seen.has(item.clientMutationId)) {
          // ACKNOWLEDGED AND IGNORED (SPEC 8). No row, no event. An error here
          // would make the queue retry forever, and the retry is what produced
          // the replay in the first place.
          continue;
        }

        const dayDate = toStoredDay(item.dayDate);

        const existing = await tx.entry.findUnique({
          where: {
            userId_dayDate_portion: { userId, dayDate, portion: item.portion },
          },
        });

        // SPEC 8's provenance rule: the overridden proposal stays on the
        // record. An edit that says nothing about detection must not erase
        // what detection proposed - deleting it to tidy the record is a review
        // rejection. An edit that SUPPLIES one is correcting the record, and
        // replaces it.
        const detectedKind = item.detectedKind ?? existing?.detectedKind ?? null;
        const detectedAt = item.detectedAt ?? existing?.detectedAt?.toISOString() ?? null;

        const shape = {
          kind: item.kind,
          absenceReason: item.absenceReason ?? null,
          note: item.note ?? null,
          provenance: item.provenance,
          detectedKind,
          detectedAt: detectedAt === null ? null : new Date(detectedAt),
          clientClaimedAt: item.clientClaimedAt === undefined ? null : new Date(item.clientClaimedAt),
        } satisfies Partial<Prisma.EntryUncheckedCreateInput>;

        const entry = await tx.entry.upsert({
          where: {
            userId_dayDate_portion: { userId, dayDate, portion: item.portion },
          },
          // firstRecordedAt IS ABSENT FROM THE UPDATE ON PURPOSE. The database
          // would refuse to move it anyway - FW21's
          // entry_first_recorded_at_immutable trigger - and leaving it out
          // means the refusal never has to fire. The trigger is the guarantee;
          // this is not relying on it to be correct.
          update: { ...shape, clientMutationId: item.clientMutationId },
          create: {
            ...shape,
            userId,
            dayDate,
            portion: item.portion,
            clientMutationId: item.clientMutationId,
            firstRecordedAt: now,
          },
        });

        await tx.entryEvent.create({
          data: {
            userId,
            entryId: entry.id,
            action: existing === null ? 'CREATED' : 'MODIFIED',
            kind: item.kind,
            provenance: item.provenance,
            detectedKind,
            dayDate,
            portion: item.portion,
            recordedAt: existing === null ? now : new Date(),
            clientClaimedAt: shape.clientClaimedAt,
          },
        });

        written += 1;
      }

      return { ok: true, written, duplicates: items.length - written };
    });
  } catch (cause) {
    // R198: the boundary preserves WHICH rule fired. A unique-constraint
    // violation is the client sending two items for one day-and-portion, which
    // it can fix; anything else is ours and must not be reported as theirs.
    const code =
      typeof cause === 'object' &&
      cause !== null &&
      'code' in cause &&
      (cause as { code?: unknown }).code === 'P2002'
        ? 'conflict'
        : 'write_failed';

    // THE PAYLOAD STAYS OUT OF THE LOG AND THE CAUSE DOES NOT.
    // /confidentialite says technical reports are stripped of addresses and
    // entry payloads - it does not say they are stripped of the reason the
    // server failed, and the first draft logged only the code. That is useless
    // to whoever is on call: `write_failed` names the category and nothing
    // about what went wrong, which is the same defect as a guard that rejects
    // correctly and explains itself wrongly.
    //
    // A `conflict` is the CLIENT's and it is already named. Anything else is
    // OURS, and ours is the one that needs a message.
    console.error(
      `[entries] batch of ${items.length} refused: ${code}`,
      code === 'write_failed' ? (cause instanceof Error ? cause.message : String(cause)) : '',
    );

    return { ok: false, written: 0, duplicates: 0, code };
  }
}
