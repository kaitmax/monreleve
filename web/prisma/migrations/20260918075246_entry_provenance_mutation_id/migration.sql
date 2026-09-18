-- CreateEnum
CREATE TYPE "EntryPortion" AS ENUM ('FULL', 'AM', 'PM');

-- CreateEnum
CREATE TYPE "EntryKind" AS ENUM ('CH', 'HOME', 'MISSION_FR', 'MISSION_THIRD', 'ABSENT');

-- CreateEnum
CREATE TYPE "AbsenceReason" AS ENUM ('CONGE', 'MALADIE', 'FERIE', 'AUTRE');

-- CreateEnum
CREATE TYPE "Provenance" AS ENUM ('MANUAL', 'DETECTED_CONFIRMED', 'DETECTED_CORRECTED');

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayDate" DATE NOT NULL,
    "portion" "EntryPortion" NOT NULL DEFAULT 'FULL',
    "kind" "EntryKind" NOT NULL,
    "absenceReason" "AbsenceReason",
    "clientMutationId" TEXT NOT NULL,
    "note" TEXT,
    "provenance" "Provenance" NOT NULL DEFAULT 'MANUAL',
    "detectedKind" "EntryKind",
    "detectedAt" TIMESTAMP(3),
    "clientClaimedAt" TIMESTAMP(3),
    "firstRecordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Entry_clientMutationId_key" ON "Entry"("clientMutationId");

-- CreateIndex
CREATE INDEX "Entry_userId_dayDate_idx" ON "Entry"("userId", "dayDate");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_userId_dayDate_portion_key" ON "Entry"("userId", "dayDate", "portion");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- R196: AN INVARIANT SPEC STATES ABOUT THE DATA IS ENFORCED IN THE DATABASE
-- WHERE THE DATABASE CAN EXPRESS IT.
--
-- Everything below this line is hand-written. Prisma's schema language has no
-- way to say "required iff", so a rule SPEC states as one sentence would
-- otherwise live only in a Zod schema - which is to say, in ONE of the
-- writers. The seed is a second writer, a migration is a third, and a support
-- query at 02:00 is a fourth.
-- ---------------------------------------------------------------------------

-- SPEC 8: absenceReason is "required iff kind = ABSENT". The prompt: "enforce
-- it, do not merely document it ... so an ABSENT row without a reason, or a
-- non-ABSENT row with one, cannot exist".
--
-- BOTH DIRECTIONS, and the reverse is the one that bites. ABSENT never reaches
-- the engine - absences are filtered out before counting - so a CH row
-- carrying an absence reason is a day that READS as absent in the dossier and
-- COUNTS as worked in the calculation. The record and the figure disagreeing,
-- with nothing saying which wins, is the FW12 tile defect in a column.
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_absenceReason_iff_absent"
  CHECK (
    ("kind" = 'ABSENT' AND "absenceReason" IS NOT NULL)
    OR
    ("kind" <> 'ABSENT' AND "absenceReason" IS NULL)
  );

-- SPEC 8, provenance rules: "Whenever a proposal existed, detectedKind is
-- stored EVEN WHEN THE USER OVERRODE IT. Deleting the overridden detection to
-- make the record look tidier is a review rejection."
--
-- A DETECTED_CORRECTED row with no detectedKind is exactly that tidied-up
-- record: it says the reader changed a proposal, while the proposal it says
-- they changed is gone. The correction then has nothing to be a correction OF,
-- and the audit trail the product sells is the thing that went missing.
--
-- FORWARD DIRECTION ONLY, DELIBERATELY. The reverse - MANUAL must carry no
-- detectedKind - follows from the definitions ("MANUAL when the user chose it
-- outright") but SPEC does not state it, and a constraint that is merely
-- implied can block a write SPEC permits. Enforcing only what is stated cannot
-- refuse a legal row. See REPORT-FW21.txt QUESTIONS.
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_detectedKind_when_detected"
  CHECK (
    "provenance" = 'MANUAL' OR "detectedKind" IS NOT NULL
  );
