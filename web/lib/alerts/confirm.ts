// web/lib/alerts/confirm.ts
//
// The other end of the double opt-in, and the way off the list. FW14
// increment 4.
//
// ONE PRINCIPLE RUNS THROUGH ALL OF IT: a link that no longer works says so
// honestly, and does not say WHY in a way that answers a question the person
// holding it should not be able to ask.
//
// A token that was never issued and a token that has already been used get
// the SAME answer. Distinguishing them would make this endpoint an oracle -
// feed it tokens, learn which were once real - and there is no honest reason
// a reader needs the difference: either way, the thing to do is subscribe
// again. EXPIRY is the one distinction drawn, because it is safe (it tells
// somebody holding a real token something they could work out from the date
// they received it) and because the fix differs: waiting longer will not
// help, so the page says to start again.

import { prisma } from '@/lib/db/client';
import { hashToken, mintToken } from '@/lib/alerts/token';

export type ConfirmOutcome =
  /** The address is on the list as of now. */
  | 'confirmed'
  /** A real token, past its seven days. */
  | 'expired'
  /** Never issued, or already used. One answer for both, on purpose. */
  | 'unknown';

export type UnsubscribeOutcome =
  /** Off the list. Also the answer for a second click on the same link. */
  | 'unsubscribed'
  /** Never issued. */
  | 'unknown';

/** 32 bytes, hex: the same shape as the confirmation token (lib/alerts/token.ts). */
const mint = mintToken;

/**
 * Confirm, if that token still means anything.
 *
 * READ THEN WRITE, and the write is conditioned on the hash it read. Two
 * simultaneous clicks - a prefetching mail client and a human, which is a
 * real pair - would both find the row; the second update matches nothing
 * because the first cleared the hash, so it reports 'unknown' rather than
 * confirming twice.
 */
export async function confirmByToken(token: string): Promise<ConfirmOutcome> {
  if (token === '') return 'unknown';

  const hash = hashToken(token);
  const row = await prisma.alertSubscriber.findUnique({
    where: { confirmationTokenHash: hash },
  });

  if (row === null) return 'unknown';

  const expiry = row.confirmationExpiresAt;

  if (expiry !== null && expiry.getTime() <= Date.now()) {
    // The dead token is cleared so it cannot be presented again, and the row
    // is left unconfirmed - it will be purged at thirty days like any other
    // unconfirmed row unless the reader subscribes again.
    await prisma.alertSubscriber.update({
      where: { id: row.id },
      data: { confirmationTokenHash: null, confirmationExpiresAt: null },
    });

    return 'expired';
  }

  const updated = await prisma.alertSubscriber.updateMany({
    // The hash in the WHERE is what makes this safe against a double click:
    // whoever gets there second matches no rows.
    where: { id: row.id, confirmationTokenHash: hash },
    data: {
      confirmedAt: new Date(),
      confirmationTokenHash: null,
      confirmationExpiresAt: null,
      unsubscribedAt: null,
      // Issued at the moment there is something to unsubscribe FROM. Every
      // send carries this link, and it has to keep working long after the
      // confirmation token is gone.
      unsubscribeTokenHash: row.unsubscribeTokenHash ?? hashToken(mint()),
    },
  });

  return updated.count === 1 ? 'confirmed' : 'unknown';
}

/**
 * Mint a fresh unsubscribe token for an address, and return the plaintext.
 *
 * Called by the mailer when a message is about to go out, because the
 * plaintext exists only in transit: the row keeps a hash, so nothing can read
 * an existing token back out. Minting a new one per send is therefore the
 * only way to have one at all, and it means an old message's link stops
 * working once a newer message has been sent - which is the correct
 * direction, since the newest message is the one in front of the reader.
 */
export async function issueUnsubscribeToken(email: string): Promise<string> {
  const token = mint();

  await prisma.alertSubscriber.update({
    where: { email },
    data: { unsubscribeTokenHash: hashToken(token) },
  });

  return token;
}

/**
 * Take the address off the list.
 *
 * IDEMPOTENT BY CONSTRUCTION. A row that is already unsubscribed reports
 * 'unsubscribed' again rather than an error: mail clients prefetch links,
 * people click twice, and a second click landing on "lien invalide" reads as
 * a failed unsubscribe - the one thing this path must never look like.
 *
 * The token is NOT cleared. It is the reader's way off a list they may still
 * have mail from, and taking it away the first time it works would break
 * every older message they still hold.
 */
export async function unsubscribeByToken(token: string): Promise<UnsubscribeOutcome> {
  if (token === '') return 'unknown';

  const row = await prisma.alertSubscriber.findUnique({
    where: { unsubscribeTokenHash: hashToken(token) },
  });

  if (row === null) return 'unknown';

  if (row.unsubscribedAt === null) {
    await prisma.alertSubscriber.update({
      where: { id: row.id },
      data: { unsubscribedAt: new Date() },
    });
  }

  return 'unsubscribed';
}
