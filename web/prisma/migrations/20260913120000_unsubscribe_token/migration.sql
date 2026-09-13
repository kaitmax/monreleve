-- AlterTable
ALTER TABLE "AlertSubscriber" ADD COLUMN     "unsubscribeTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AlertSubscriber_unsubscribeTokenHash_key" ON "AlertSubscriber"("unsubscribeTokenHash");

