-- CreateTable
CREATE TABLE "NameChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NameChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NameChange_userId_idx" ON "NameChange"("userId");

-- AddForeignKey
ALTER TABLE "NameChange" ADD CONSTRAINT "NameChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
