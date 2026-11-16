-- FW-DELAI-RAPPEL (R914): one reminder before the droit d'option deadline.
--
-- ADDITIVE ONLY: one new table, its indexes and its constraints. Nothing that
-- exists is altered or dropped, so the previous image runs unchanged on the
-- migrated schema (it never names this table).
--
-- The record is minimal: the address, the date the comparator computed, what
-- the confirm flow needs (token HASHES, never tokens), and the server's
-- timestamps. See prisma/schema.prisma's DeadlineReminder for why each column
-- exists, and /confidentialite (DISCLOSED_RECORDS.deadlineReminder) for the
-- sentence that discloses all of them.

-- CreateTable
CREATE TABLE "DeadlineReminder" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "deadline" DATE NOT NULL,
    "confirmationTokenHash" TEXT,
    "confirmationExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "deleteTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeadlineReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeadlineReminder_email_key" ON "DeadlineReminder"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DeadlineReminder_confirmationTokenHash_key" ON "DeadlineReminder"("confirmationTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "DeadlineReminder_deleteTokenHash_key" ON "DeadlineReminder"("deleteTokenHash");

-- CreateIndex
CREATE INDEX "DeadlineReminder_confirmedAt_createdAt_idx" ON "DeadlineReminder"("confirmedAt", "createdAt");

-- CreateIndex
CREATE INDEX "DeadlineReminder_deadline_idx" ON "DeadlineReminder"("deadline");

-- ---------------------------------------------------------------------------
-- R196: the invariants the database can express, in the database. Prisma
-- cannot write CHECK constraints, so they are here; tests/db/rappel-delai-
-- schema.test.ts proves each one both ways, by name.
-- ---------------------------------------------------------------------------

-- Awaiting confirmation (a live token) OR confirmed (a date): never both, and
-- never neither. "Both" would be a confirmed reminder whose confirmation link
-- still works; "neither" is a request nobody can confirm and nothing will
-- send - the expired path deletes such a row rather than keeping it.
ALTER TABLE "DeadlineReminder" ADD CONSTRAINT "DeadlineReminder_pending_xor_confirmed"
  CHECK (("confirmedAt" IS NULL) <> ("confirmationTokenHash" IS NULL));

-- A confirmation token has an expiry, and an expiry belongs to a token. A
-- token with no expiry is a link that never lapses; an expiry with no token
-- is a date describing nothing.
ALTER TABLE "DeadlineReminder" ADD CONSTRAINT "DeadlineReminder_token_expiry_pair"
  CHECK (("confirmationTokenHash" IS NULL) = ("confirmationExpiresAt" IS NULL));

-- The address is stored as the unique index must see it: trimmed, lowercased,
-- with something on either side of an at-sign, and no longer than RFC 5321
-- allows. Without this, " A@b.c" and "a@b.c" are two rows and two reminders -
-- the outcome R915 forbids - for any writer that skips the normaliser.
ALTER TABLE "DeadlineReminder" ADD CONSTRAINT "DeadlineReminder_email_normalised"
  CHECK (
    "email" = lower(btrim("email"))
    AND char_length("email") BETWEEN 3 AND 254
    AND position('@' in "email") > 1
    AND position('@' in "email") < char_length("email")
  );
