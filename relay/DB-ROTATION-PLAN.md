# The production database password rotation - PREPARED, NOT EXECUTED

Queue step C3 (relay/ORCH-NO-PHONE-QUEUE.txt). **No session executes this.** The rotation needs the
operator's own, separate authorisation; this file is what that authorisation would run. Written
2026-11-11 by the orchestrating session.

## What the plan rests on

- **A Coolify restart applies a changed environment variable.** The repository's record is one
  line in `relay/QUEUE-2026-10-28.txt` (UPDATE 2026-10-31): *"Password rotation NOT done - needs
  its own authorisation. A Coolify restart applies env (measured)."* The measurement's detail is
  in the orchestrator's notes, not in the repository, and was NOT re-run for this plan (the
  Coolify API token is gone - QUEUE-STATE.md): a harmless `ROTATION_PROBE` variable was added
  while absent from the running container (the negative control), the app was restarted through
  Coolify, the restart ran as a queued deployment of about 4 minutes, and a NEW container came up
  carrying the variable. `/api/ready` sampled every second showed 1 timeout in 251 s at the swap,
  and 0 in 163 s on a second restart. Coolify masks env values in its logs; creating a variable
  through the API also creates a preview copy.
- **Changing a password does not drop existing Postgres sessions.** The running app's pooled
  connections stay authenticated after `ALTER ROLE`; only NEW connections need the new password.
- **`POSTGRES_PASSWORD` on the database container only acts at first initialisation.** Changing
  Coolify's record of it does not change the role. Whether Coolify 4.5.0 runs an `ALTER ROLE` by
  itself when its database settings change was NOT established - so this plan does the `ALTER`
  explicitly and proves it with a negative control.

## Where the password lives (step 0 confirms this list before anything is written)

1. The Postgres role inside the database container `poxl2l4x0p0fxd85or0itnxo` - the authority.
2. The app's `DATABASE_URL` in Coolify (app `pkptabevr1nhtyygrq0mc8qx`) - TWO copies, the normal
   one and its preview copy.
3. Coolify's record of the database resource (its password field) - used for Coolify's own
   connection strings and any Coolify-scheduled backup.
4. Any backup job outside Coolify (docs/deploy.md section 5 shows a nightly `pg_dump` with
   `PGPASSWORD`; where it is scheduled must be found in step 0).

## Preconditions

- The operator's explicit authorisation for the rotation, naming the time.
- Coolify reachable for the operator (the UI) or the orchestrator (a new API token).
- SSH `monreleve-vps`. Every docker command names this app's uuids, nothing else (CLAUDE.md).
- A low-traffic hour. The expected cost is up to about 4 minutes in which requests that need a NEW
  database connection fail (the restart's measured length). Option B below, which was to remove
  it, is struck.

## The steps (option A - works today)

0. **Inventory, read-only.** List the names (never values) of the app's Coolify variables that
   embed the password; the database resource's record; Coolify scheduled tasks; the server's
   crontab lines naming this app's uuids. Anything not in the list above: stop and ask.
1. **Back up now.** `pg_dump` inside `poxl2l4x0p0fxd85or0itnxo` (docs/deploy.md section 5's
   command); check the file is non-empty and ends with the dump's completion line.
2. **Generate the new password on the server**, into a shell variable only - e.g.
   `NEW=$(openssl rand -base64 33 | tr -d '/+=\n')`. Keep the old one in `OLD` the same way (read
   from the running container's env, never echoed). Neither is ever printed, logged or written to
   a file or to this repository.
3. **Stage the app's variable.** Set `DATABASE_URL` with `$NEW` in Coolify - both copies. It does
   not apply until the restart (measured). Do not restart yet.
4. **Change the role.** `docker exec poxl2l4x0p0fxd85or0itnxo psql -U <superuser> -c "ALTER ROLE
   <app user> WITH PASSWORD '...'"` with `$NEW`. From here the OLD container's new connections fail.
5. **Restart the app at once** (Coolify -> the app -> Restart). About 4 minutes.
6. **Align Coolify's database record** with `$NEW`, so its connection strings and backups match.
7. **Verify, both directions:**
   - the app container is the NEW one (its start time is after step 5) and its `DATABASE_URL` has
     the new length (read the length, never the value);
   - `https://monreleve.ch/api/ready` answers 200 with `database` ok, and `/api/health` 200 naming
     monreleve;
   - **negative control:** a `psql` connection with `$OLD` is REFUSED (`password authentication
     failed`); **positive control:** the same connection with `$NEW` succeeds;
   - one real path that opens a connection (e.g. a sign-in code request to a `@monreleve.test`
     address) works.
8. **Backups.** Update the backup job found in step 0; run it once; check the file as in step 1.
9. **Record it** in relay/QUEUE-STATE.md and the rulings file: date, who authorised, each check's
   output. Then `unset OLD NEW`.

## Rollback (if any check in step 7 fails)

1. `ALTER ROLE <app user> WITH PASSWORD` back to `$OLD` (still in the shell).
2. Set `DATABASE_URL` back to the old value (both copies); Coolify's database record back too.
3. Restart the app; check `/api/ready` 200 with `database` ok.
4. Record what failed. The database container itself is never restarted by this plan, so its data
   is not at risk at any step.

## Option B - STRUCK (C1's R844, Queue Ruling 2)

It was: stage the variable, restart, and let a readiness-gated release keep the old container
serving until `ALTER ROLE` makes the new one ready. C1 read Coolify 4.5.0's source
(REPORT-FW-READY-GATE.txt, R844): while the Dockerfile carries a HEALTHCHECK, Coolify gates the
release on the IMAGE's check, which is `/api/health` - liveness, never the database (R83, R357).
A new container holding a wrong password passes it and REPLACES the old one. Coolify's own check
on `/api/ready` stays off (C1's QUESTION 1). Use option A. If QUESTION 1 is ever ruled for a
readiness-gated release, this option can be re-derived from that ruling and measured first.
