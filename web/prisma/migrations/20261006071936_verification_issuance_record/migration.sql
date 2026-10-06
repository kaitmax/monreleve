-- CreateTable
CREATE TABLE "IssuanceRecord" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "supersededAt" TIMESTAMP(3),
    "name" TEXT NOT NULL,
    "declarableRate" DOUBLE PRECISION NOT NULL,
    "teleworkDays" DOUBLE PRECISION NOT NULL,
    "missionDaysFrance" DOUBLE PRECISION NOT NULL,
    "missionDaysThirdState" DOUBLE PRECISION NOT NULL,
    "periodFraction" DOUBLE PRECISION NOT NULL,
    "periodStartDate" TEXT,
    "sha256" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssuanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssuanceRecord_code_key" ON "IssuanceRecord"("code");

-- CreateIndex
CREATE INDEX "IssuanceRecord_userId_idx" ON "IssuanceRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IssuanceRecord_userId_taxYear_version_key" ON "IssuanceRecord"("userId", "taxYear", "version");

-- AddForeignKey
ALTER TABLE "IssuanceRecord" ADD CONSTRAINT "IssuanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- R196: at most ONE current (non-superseded) issuance per (account, year).
-- Prisma cannot express a partial unique index, so it is raw SQL here. It is
-- what makes "a regeneration supersedes the previous one" an invariant the
-- database holds, not merely a convention recordIssuance follows: a second
-- current row for one year is refused, so the rule survives any future writer.
CREATE UNIQUE INDEX "IssuanceRecord_one_current_per_year"
  ON "IssuanceRecord" ("userId", "taxYear")
  WHERE "supersededAt" IS NULL;
