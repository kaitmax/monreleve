-- AlterTable
ALTER TABLE "EntryEvent" ADD COLUMN     "clientMutationId" TEXT;

-- CreateIndex
CREATE INDEX "EntryEvent_userId_clientMutationId_idx" ON "EntryEvent"("userId", "clientMutationId");
