-- CreateEnum
CREATE TYPE "EntryAction" AS ENUM ('CREATED', 'MODIFIED');

-- CreateTable
CREATE TABLE "EntryEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "action" "EntryAction" NOT NULL,
    "kind" "EntryKind" NOT NULL,
    "provenance" "Provenance" NOT NULL,
    "detectedKind" "EntryKind",
    "dayDate" DATE NOT NULL,
    "portion" "EntryPortion" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientClaimedAt" TIMESTAMP(3),

    CONSTRAINT "EntryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EntryEvent_userId_entryId_idx" ON "EntryEvent"("userId", "entryId");

-- CreateIndex
CREATE INDEX "EntryEvent_entryId_recordedAt_idx" ON "EntryEvent"("entryId", "recordedAt");

-- AddForeignKey
ALTER TABLE "EntryEvent" ADD CONSTRAINT "EntryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- AC2: THE EVIDENCE LAYER, ENFORCED BY THE DATABASE.
--
-- Everything below this line is hand-written. The prompt is explicit that a
-- convention in a service file is not enforcement, and these two properties
-- are what every claim the product makes about its records rests on:
--
--   1. EntryEvent is append-only.
--   2. Entry.firstRecordedAt never changes after the row is created.
--
-- NO USING ERRCODE, AND THAT IS A DELIBERATE REVERSAL. These three RAISEs
-- first carried USING ERRCODE = 'restrict_violation', the semantically
-- correct SQLSTATE (23001) - which Prisma maps to P2003, "Foreign key
-- constraint violated on the (not available)". The text naming the actual
-- rule was buried in err.meta.driverAdapterError.cause.
--
-- So the rejection a caller saw pointed at relations, in a breach that has
-- nothing to do with relations, and FW23's error handling would have been
-- written against that. Left at plpgsql's default P0001, Prisma surfaces
--   Database error. Code: P0001. Message: EntryEvent is append-only ...
-- so the rule names itself in the error, which is worth more than a tidy
-- SQLSTATE nobody reads.
--
-- A GUARD THAT REJECTS CORRECTLY AND EXPLAINS ITSELF WRONGLY sends the next
-- person to the wrong place, and does it at the moment they are least able
-- to argue with it.

-- WHY A TRIGGER RATHER THAN A REVOKE OR A RULE.
--
--   REVOKE binds a role. It would hold against the application user and not
--   against the superuser a migration runs as, and it is invisible in the
--   schema - a reader of this file would not know the rule exists.
--
--   A RULE (CREATE RULE ... DO INSTEAD NOTHING) silently discards the write.
--   Silence is the wrong failure here: a service that believes it corrected
--   an audit row and did not is worse off than one that got an error, and an
--   audit trail that quietly ignores writes cannot be told apart from one
--   that accepts them.
--
--   A TRIGGER RAISES. The write fails loudly, naming the rule, which is what
--   somebody debugging at 02:00 actually needs.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. EntryEvent is never updated.
--
-- NO EXCEPTION, INCLUDING A NO-OP. The rule is about the statement rather
-- than about whether the bytes moved: a trigger that let harmless updates
-- through would have to decide what harmless means, inside the one table that
-- must not be argued with.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION entry_event_no_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'EntryEvent is append-only (SPEC 8): UPDATE rejected. An event records '
    'what was true at the time it was written. Correcting one in place makes '
    'every dossier it backs unverifiable - append a new event instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entry_event_no_update
  BEFORE UPDATE ON "EntryEvent"
  FOR EACH ROW EXECUTE FUNCTION entry_event_no_update();

-- ---------------------------------------------------------------------------
-- 2. An EntryEvent is never deleted ON ITS OWN - but it goes when the person
--    does.
--
-- THE DISTINCTION IS BETWEEN TWO PUBLISHED PROMISES, not a loophole.
-- Append-only exists so that a record cannot be tidied: removing one
-- inconvenient event is exactly the act it forbids. Erasing a person is a
-- different act with its own promise behind it - D11, "suppression du compte
-- ... removes user, entries, events, devices", which /confidentialite
-- publishes. It destroys the whole record at the reader's request and leaves
-- nothing behind to be misread.
--
-- A trigger that refused every DELETE would enforce the audit rule by
-- breaking the privacy one.
--
-- HOW THE TWO ARE TOLD APART: during a cascade from User, PostgreSQL deletes
-- the parent row first and then fires the referential action on the children,
-- so the User is already invisible to this transaction by the time this
-- trigger runs. A direct delete still sees it. Verified empirically on
-- throwaway tables before this was written - both directions are asserted in
-- tests/db/append-only.test.ts, so a future PostgreSQL that reordered this
-- would fail the suite rather than silently make events undeletable.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION entry_event_no_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE "id" = OLD."userId") THEN
    RAISE EXCEPTION
      'EntryEvent is append-only (SPEC 8): DELETE rejected while the user '
      'still exists. An event may only disappear together with the person it '
      'belongs to (D11, account deletion) - never on its own.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entry_event_no_delete
  BEFORE DELETE ON "EntryEvent"
  FOR EACH ROW EXECUTE FUNCTION entry_event_no_delete();

-- ---------------------------------------------------------------------------
-- 3. Entry.firstRecordedAt is immutable.
--
-- NOT THE WHOLE ROW, and that matters. An Entry is editable by design - SPEC
-- 8: "Edits update Entry.kind (latest wins for calculation) but append an
-- EntryEvent". Correcting a day is the product's main interaction. What must
-- not move is the server's record of when it FIRST heard about that day,
-- because the late flag is derived from it (firstRecordedAt - dayDate > 7
-- days) and an editable firstRecordedAt is an editable "saisie tardive" - the
-- one label on the document that exists to be uncomfortable.
--
-- IT COMPARES VALUES RATHER THAN INSPECTING THE STATEMENT. An ORM is entitled
-- to write every column; a full-row UPDATE that rewrites firstRecordedAt with
-- the value it just read has changed nothing and is allowed.
--
-- IS DISTINCT FROM rather than <>, so a change to or from NULL is caught too.
-- The column is NOT NULL today; writing the comparison the careful way costs
-- nothing and survives a column that becomes nullable.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION entry_first_recorded_at_is_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."firstRecordedAt" IS DISTINCT FROM OLD."firstRecordedAt" THEN
    RAISE EXCEPTION
      'Entry.firstRecordedAt is immutable (SPEC 8): attempted to change % to '
      '%. It is the server clock at first receipt, and the late flag and the '
      'dossier both rest on it.', OLD."firstRecordedAt", NEW."firstRecordedAt";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entry_first_recorded_at_immutable
  BEFORE UPDATE ON "Entry"
  FOR EACH ROW EXECUTE FUNCTION entry_first_recorded_at_is_immutable();
