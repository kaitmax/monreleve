-- Q70 / R209 / R187: the seven OAuth columns go.
--
-- They were transcribed from the Auth.js Prisma adapter's published schema in
-- FW21, because the adapter required them. R209 removes the adapter
-- permanently: the magic-link flow is this product's own, and Auth.js would
-- have added a second identity mechanism to manage a web session D14 deleted.
--
-- R187 - AN UNUSED COLUMN IS A PROMISE TO A CLIENT THAT WILL EVENTUALLY READ
-- IT. "Never OAuth" is not the standard and was never the question. The
-- standard is cost: adding these back later is a migration against tables that
-- will still be nearly empty, whereas carrying them now means every future
-- reader of this schema wonders which provider we support. If OAuth ever
-- arrives it brings its own schema.
--
-- AND THE PRIVACY NOTICE BECOMES TRUE. lib/content/personal-data.ts mapped
-- all seven to the "credentials" disclosure, whose sentence promises
-- « sous forme d'empreinte et jamais en clair ». THAT WAS NEVER TRUE OF THESE
-- SEVEN: an OAuth access_token or id_token is stored as issued, in clear. The
-- notice was describing a property the columns did not have, and dropping them
-- is what makes the sentence accurate rather than aspirational.
--
-- SAFE TODAY, and checked rather than assumed: nothing in web/lib, web/app,
-- web/scripts or the seed touches prisma.account at all - Account and Session
-- are the only two tables in this schema with no writer anywhere. The single
-- insert in the repository was tests/db/auth-adapter.test.ts, removed in this
-- same commit with the adapter whose shape it existed to verify.

/*
  Warnings:

  - You are about to drop the column `access_token` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `expires_at` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `id_token` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `refresh_token` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `scope` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `session_state` on the `Account` table. All the data in the column will be lost.
  - You are about to drop the column `token_type` on the `Account` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Account" DROP COLUMN "access_token",
DROP COLUMN "expires_at",
DROP COLUMN "id_token",
DROP COLUMN "refresh_token",
DROP COLUMN "scope",
DROP COLUMN "session_state",
DROP COLUMN "token_type";
