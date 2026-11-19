-- CreateTable
CREATE TABLE "WebSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedReason" "SessionRevocation",

    CONSTRAINT "WebSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebSession_tokenHash_key" ON "WebSession"("tokenHash");

-- CreateIndex
CREATE INDEX "WebSession_userId_idx" ON "WebSession"("userId");

-- CreateIndex
CREATE INDEX "WebSession_expiresAt_idx" ON "WebSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "WebSession" ADD CONSTRAINT "WebSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- R196 (FW-WEB-ACCOUNT, R899): an invariant the model states in prose is
-- enforced where the database can express it. Hand-written below Prisma's
-- output, as with every CHECK in this schema. ADDITIVE ONLY: one new table,
-- its indexes, its foreign key and these constraints - nothing existing is
-- altered or dropped. tests/db/web-session.test.ts asserts each one in BOTH
-- directions, by constraint name.
-- ---------------------------------------------------------------------------

-- A revoked session says WHY, and a live one claims no reason - the same
-- pair rule as DeviceSession_revoked_pair, for the same reason: a support
-- question ("why was I signed out?") has a fact for an answer.
ALTER TABLE "WebSession" ADD CONSTRAINT "WebSession_revoked_pair"
  CHECK (
    ("revokedAt" IS NULL AND "revokedReason" IS NULL)
    OR
    ("revokedAt" IS NOT NULL AND "revokedReason" IS NOT NULL)
  );

-- THE LIFE IS SHORT, AND THE DATABASE KNOWS HOW SHORT. A web session ends
-- after its creation and no later than thirty minutes after it - the value
-- lib/auth/web-session.ts states as WEB_SESSION_TTL_MS and the cookie states
-- as Max-Age. A writer that forgot the rule (a seed, a script, a later route)
-- cannot mint a long-lived browser credential: the row is refused here.
-- tests/db/web-session.test.ts reads the interval back from the catalogue and
-- compares it with the constant, so the two cannot drift (R345).
ALTER TABLE "WebSession" ADD CONSTRAINT "WebSession_short_life"
  CHECK (
    "expiresAt" > "createdAt"
    AND "expiresAt" <= "createdAt" + interval '30 minutes'
  );

-- A session cannot end before it began.
ALTER TABLE "WebSession" ADD CONSTRAINT "WebSession_revoked_after_created"
  CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

-- THE COLUMN HOLDS A HASH, NEVER A TOKEN. SHA-256 in lowercase hex is exactly
-- 64 characters of [0-9a-f]; the cookie's value is 43 base64url characters
-- and cannot pass this, so a writer that stored the credential itself is
-- refused rather than trusted.
ALTER TABLE "WebSession" ADD CONSTRAINT "WebSession_token_hash_shape"
  CHECK ("tokenHash" ~ '^[0-9a-f]{64}$');
