-- CreateTable
CREATE TABLE "AlertSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confirmationTokenHash" TEXT,
    "confirmationExpiresAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertSubscriber_email_key" ON "AlertSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AlertSubscriber_confirmationTokenHash_key" ON "AlertSubscriber"("confirmationTokenHash");

-- CreateIndex
CREATE INDEX "AlertSubscriber_confirmedAt_createdAt_idx" ON "AlertSubscriber"("confirmedAt", "createdAt");
