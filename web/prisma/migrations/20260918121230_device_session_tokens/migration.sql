-- CreateEnum
CREATE TYPE "SessionTokenKind" AS ENUM ('ACCESS', 'REFRESH');

-- CreateEnum
CREATE TYPE "SessionRevocation" AS ENUM ('SIGNED_OUT', 'REVOKED_ALL', 'ACCOUNT_DELETED', 'TOKEN_REPLAYED');

-- CreateTable
CREATE TABLE "DeviceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" "SessionRevocation",

    CONSTRAINT "DeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionToken" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" "SessionTokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "SessionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeviceSession_userId_idx" ON "DeviceSession"("userId");

-- CreateIndex
CREATE INDEX "DeviceSession_deviceId_idx" ON "DeviceSession"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionToken_tokenHash_key" ON "SessionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "SessionToken_sessionId_kind_idx" ON "SessionToken"("sessionId", "kind");

-- CreateIndex
CREATE INDEX "SessionToken_expiresAt_idx" ON "SessionToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionToken" ADD CONSTRAINT "SessionToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DeviceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- R196: an invariant the model states in prose is enforced where the database
-- can express it. Hand-written below Prisma's output, as with FW21's four.
-- ---------------------------------------------------------------------------

-- A revoked session says WHY, and a live one claims no reason.
--
-- BOTH DIRECTIONS. A revokedAt with no reason is a session that ended and
-- cannot say what ended it - which is the question a support conversation
-- opens with ("why was I signed out?"), and the one this column exists to
-- answer. A reason with no revokedAt is worse: it reads as revoked to anyone
-- scanning the column and is live to the code, so the record and the
-- behaviour disagree with nothing saying which wins. That is FW12's tile
-- defect, in the table that decides who is signed in.
ALTER TABLE "DeviceSession" ADD CONSTRAINT "DeviceSession_revoked_pair"
  CHECK (
    ("revokedAt" IS NULL AND "revokedReason" IS NULL)
    OR
    ("revokedAt" IS NOT NULL AND "revokedReason" IS NOT NULL)
  );

-- A consumed token was consumed after it was created.
--
-- Not a paranoid check: consumedAt is written by the rotation path, and a
-- clock or an ordering mistake there would produce a token whose successor
-- predates it. The reuse detector reads consumedAt to decide that a captured
-- token is being replayed, so a nonsensical value there is a wrong security
-- decision rather than untidy data.
ALTER TABLE "SessionToken" ADD CONSTRAINT "SessionToken_consumed_after_created"
  CHECK ("consumedAt" IS NULL OR "consumedAt" >= "createdAt");
