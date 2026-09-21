-- R220: a client-generated key is unique within the account that issued it.
--
-- It was `@unique` globally, which made a CLIENT-GENERATED id a shared
-- namespace across every account. Two devices generating UUIDs independently
-- could collide, and the second account's legitimate write was refused 409
-- because a stranger had used that id first. That is not a conflict to report,
-- it is a bug to remove.
--
-- SAFE ON EXISTING DATA. The constraint being created is strictly WEAKER than
-- the one being dropped: anything unique globally is unique within an account,
-- so no existing row can violate it. The order matters all the same - the new
-- index is created before the old one is dropped would be safer still, but
-- Postgres holds both briefly either way and the table is small.

-- DropIndex
DROP INDEX "Entry_clientMutationId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Entry_userId_clientMutationId_key" ON "Entry"("userId", "clientMutationId");
