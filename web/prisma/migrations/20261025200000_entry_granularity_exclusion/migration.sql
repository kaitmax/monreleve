-- R490 / R499: A DAY KEEPS THE GRANULARITY IT WAS RECORDED IN - ENFORCED BY THE DATABASE.
--
-- For one user and one day, a FULL row may not coexist with an AM or PM row. The
-- unique key (userId, dayDate, portion) cannot say it: FULL, AM and PM are three
-- different keys. Without this a day holding FULL beside AM is counted twice in
-- the Releve (countDays adds every row's weight, R476) - a document handed to a
-- tax office. The rule must hold for a writer that does not know it exists (R196).
--
-- AN EXCLUSION CONSTRAINT, NOT A TRIGGER: it is atomic under concurrency (a
-- trigger needs an advisory lock to be, and is one more thing to get wrong).
-- btree_gist gives gist the equality operator for text and date; the third
-- element is "is this row FULL" as an integer, excluded when two rows for the
-- same user and day DISAGREE on it. AM beside PM agree (both 0) and stay legal;
-- a row never conflicts with itself, so edits and kind changes are unaffected.
-- btree_gist is a TRUSTED extension (PostgreSQL 13+): a role with CREATE on the
-- database can install it, no superuser needed.
--
-- THIS FAILS ON A DATABASE THAT ALREADY HOLDS A MIXED DAY, by design: it never
-- rewrites or deletes a row. The production census (R498) read 0 / 0.
--
-- Prisma does not model exclusion constraints; it neither reports nor drops this
-- one (proved in REPORT-FW-GRANULARITY.txt, R499).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Entry"
  ADD CONSTRAINT "entry_one_granularity_per_day"
  EXCLUDE USING gist (
    "userId" WITH =,
    "dayDate" WITH =,
    ((("portion" = 'FULL'))::int) WITH <>
  );
