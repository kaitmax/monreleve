-- CreateTable
CREATE TABLE "ReminderSent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sentOn" DATE NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReminderSent_userId_idx" ON "ReminderSent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderSent_userId_sentOn_key" ON "ReminderSent"("userId", "sentOn");

-- AddForeignKey
ALTER TABLE "ReminderSent" ADD CONSTRAINT "ReminderSent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
