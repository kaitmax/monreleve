// web/lib/account/delete.ts
//
// Account erasure. FW26 increment 4.
//
// ============================================================================
// THE ERASURE PATH, AND WHY IT NEEDED NO NEW MECHANISM
// ============================================================================
//
// FW21 made `EntryEvent` append-only with a database trigger that refuses
// UPDATE and DELETE. D11 requires account deletion to remove those same rows.
// The obvious readings - a transaction-local setting the trigger checks, a
// dedicated role, a marker row - are all ways of teaching a guard to stand
// aside, and every one of them is a door.
//
// FW21 had already chosen the door-less answer, and proved it empirically
// before writing the trigger: PostgreSQL deletes a parent row BEFORE firing
// the referential action, so during a cascade from `User` the person is
// already invisible to the transaction, while a direct `DELETE FROM
// "EntryEvent"` still sees them. The trigger asks exactly that question.
//
//   direct delete   -> the user is still visible -> REFUSED, by name
//   cascade         -> the user is already gone  -> permitted
//
// So the erasure path is one statement: delete the person. There is no
// narrower privilege to abuse, because the capability IS the deletion - an
// attacker or a bug cannot use it to tidy one inconvenient event without
// destroying the entire account, which is the loudest possible side effect.
//
// WHAT IT WOULD TAKE TO ABUSE IT, stated plainly because the prompt asks:
// a caller would need a valid access token for the account, and the result
// would be the total destruction of that account's record. There is no
// partial form. The failure mode worth guarding is therefore not "somebody
// erases one event" but "somebody erases an account they should not have" -
// which is ordinary authentication, and is why this is a POST behind a bearer
// token rather than anything cleverer.
//
// ============================================================================
// ONE TRANSACTION
// ============================================================================
//
// A partial erasure that succeeds halfway is worse than a refusal, because the
// person believes they are gone. Everything below happens inside
// `$transaction` or not at all.

import { prisma } from '@/lib/db/client';
import { codeAttemptKey } from '@/lib/auth/magic-link';

export interface ErasureReceipt {
  /** Rows destroyed, by table, so a caller can report what happened. */
  readonly removed: Readonly<Record<string, number>>;
  /**
   * Whether an alert-list subscription for this address SURVIVES the erasure.
   *
   * ==========================================================================
   * THE ONE PLACE "DELETE EVERYTHING" AND "HONOUR THE CONSENT THEY GAVE" PULL
   * APART
   * ==========================================================================
   *
   * `AlertSubscriber` is keyed by EMAIL, not by user. It is a separate consent
   * under a separate identity: most rows on that list belong to addresses that
   * never had an account at all, and one that does had it added by a different
   * act on a different day.
   *
   * DELETING IT WOULD REVOKE A CONSENT NOBODY WITHDREW. Keeping it SILENTLY
   * would be worse - somebody who asked to be forgotten and then receives an
   * email has been told something untrue by the absence of a sentence.
   *
   * So it survives, and the erasure REPORTS it. The row keeps the one-click
   * unsubscribe token it was issued with, which is the mechanism that already
   * exists and the one the confirmation email carries.
   */
  readonly alertSubscriptionRemains: boolean;
}

/**
 * Remove a person and everything belonging to them.
 *
 * TOKENS ARE REVOKED BY BEING DESTROYED (R193). `SessionToken` cascades from
 * `DeviceSession`, which cascades from `User`, so every credential for this
 * account ceases to exist in the same statement that removes the account -
 * there is no window in which a token outlives its owner.
 */
export async function deleteAccount(userId: string): Promise<ErasureReceipt> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });

    if (user === null) {
      throw new Error(`no such account: ${userId}`);
    }

    // COUNTED BEFORE, because after the cascade there is nothing left to count
    // and a receipt of zeros would be indistinguishable from a deletion that
    // did nothing.
    const [entries, events, devices, sessions, issuances, nameChanges] = await Promise.all([
      tx.entry.count({ where: { userId } }),
      tx.entryEvent.count({ where: { userId } }),
      tx.device.count({ where: { userId } }),
      tx.deviceSession.count({ where: { userId } }),
      // FW-VERIFY (R329): the issued-releve records go with the account, like
      // every other row. They cascade from User, so this is the count for the
      // receipt rather than a separate delete.
      tx.issuanceRecord.count({ where: { userId } }),
      // FW-VERIFY (R331): the name-change dates go too.
      tx.nameChange.count({ where: { userId } }),
    ]);

    // VerificationToken is keyed by ADDRESS, not by userId, so it does NOT
    // cascade. A pending sign-in link would otherwise outlive the account it
    // was issued for - and it is a credential that still resolves to an email
    // this product has promised to forget.
    const verifications = await tx.verificationToken.deleteMany({
      where: { identifier: user.email },
    });

    // CodeAttempt is keyed by a HASH of the address, not by userId, so it
    // does not cascade either - and it is personal data this product has
    // disclosed on /confidentialite, which means an erasure that left it
    // behind would contradict the page. Deleted by the same key the budget
    // claims with (R206: one home for the fingerprint, not a second sha256
    // computed here).
    //
    // IT COSTS NOTHING IN SECURITY. Clearing a budget this way requires
    // already holding a valid token for the account and destroying that
    // account to do it - and the budget protects the code entry for an
    // address, which a person who holds the account does not need to attack.
    const attempts = await tx.codeAttempt.deleteMany({
      where: { emailHash: codeAttemptKey(user.email) },
    });

    // READ, NOT DELETED. A subscription to the alert list is a separate
    // consent under a separate identity - see the receipt's own note - and it
    // is reported rather than silently kept.
    const subscription = await tx.alertSubscriber.findUnique({
      where: { email: user.email },
      select: { unsubscribedAt: true },
    });

    // THE CASCADE. One statement; the trigger permits what follows because the
    // person is already gone by the time it fires.
    await tx.user.delete({ where: { id: userId } });

    return {
      alertSubscriptionRemains: subscription !== null && subscription.unsubscribedAt === null,
      removed: {
        User: 1,
        Entry: entries,
        EntryEvent: events,
        Device: devices,
        DeviceSession: sessions,
        IssuanceRecord: issuances,
        NameChange: nameChanges,
        VerificationToken: verifications.count,
        CodeAttempt: attempts.count,
      },
    };
  });
}

/**
 * The word a client must send to confirm an erasure.
 *
 * FRENCH, because it is the word the app shows. A client sending "DELETE" has
 * not read SPEC 11.5's confirmation requirement, which is the point.
 *
 * IT IS NOT SECURITY. A caller holding a valid token can always send it. It is
 * here so a mis-wired client, a retried request or a curious developer with a
 * shell does not destroy an account by making the obvious call - which is the
 * realistic failure, and the one D11's "the confirmation names what is
 * destroyed" is written against.
 *
 * IT LIVES HERE RATHER THAN IN THE ROUTE because a Next.js route module may
 * export only its handlers and a fixed set of config keys. Any other export
 * fails the BUILD - and passes `tsc --noEmit`, which is one of the few things
 * only `pnpm build` catches.
 */
export const DELETE_CONFIRMATION = 'SUPPRIMER';
