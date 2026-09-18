-- CreateEnum
CREATE TYPE "DenominatorKind" AS ENUM ('SIMPLIFIED240', 'EXACT');

-- CreateEnum
CREATE TYPE "LogGranularity" AS ENUM ('DAY', 'HALF_DAY');

-- CreateEnum
CREATE TYPE "LoggingMode" AS ENUM ('MANUAL', 'AUTO_DETECT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "canton" TEXT,
    "employmentRate" INTEGER NOT NULL DEFAULT 100,
    "denominatorKind" "DenominatorKind" NOT NULL DEFAULT 'SIMPLIFIED240',
    "exactTotalWorkDays" INTEGER,
    "granularity" "LogGranularity" NOT NULL DEFAULT 'DAY',
    "loggingMode" "LoggingMode" NOT NULL DEFAULT 'MANUAL',
    "detectionConsentAt" TIMESTAMP(3),
    "activityStartDate" TIMESTAMP(3),
    "reminderTime" TEXT NOT NULL DEFAULT '17:30',
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fcmToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "appVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Device_fcmToken_key" ON "Device"("fcmToken");

-- CreateIndex
CREATE INDEX "Device_userId_idx" ON "Device"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- FW21: the two rules on User that Prisma cannot express, written by hand.
--
-- A RULE THAT LIVES ONLY IN APPLICATION CODE IS A RULE THE NEXT WRITER CAN
-- BYPASS - a seed, a migration, a support query, a second service. SPEC 8
-- states both of these as properties of the data, so they are enforced where
-- the data is.
-- ---------------------------------------------------------------------------

-- SPEC 8: employmentRate is 1-100. A rate of 0 is not a part-timer, it is a
-- person who does not work here, and a rate above 100 makes every derived
-- figure meaningless rather than merely wrong.
ALTER TABLE "User"
  ADD CONSTRAINT "User_employmentRate_range"
  CHECK ("employmentRate" >= 1 AND "employmentRate" <= 100);

-- SPEC 8: exactTotalWorkDays is "required iff EXACT". BOTH directions, because
-- a total sitting on a SIMPLIFIED240 row is a number some later reader will
-- use - the engine takes the denominator from the KIND, so a stale total is a
-- figure that disagrees with the calculation and nothing would say which won.
ALTER TABLE "User"
  ADD CONSTRAINT "User_exactTotalWorkDays_iff_exact"
  CHECK (
    ("denominatorKind" = 'EXACT' AND "exactTotalWorkDays" IS NOT NULL)
    OR
    ("denominatorKind" <> 'EXACT' AND "exactTotalWorkDays" IS NULL)
  );
