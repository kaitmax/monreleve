-- CreateTable
CREATE TABLE "CodeAttempt" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CodeAttempt_emailHash_attemptedAt_idx" ON "CodeAttempt"("emailHash", "attemptedAt");

-- CreateIndex
CREATE INDEX "CodeAttempt_attemptedAt_idx" ON "CodeAttempt"("attemptedAt");
