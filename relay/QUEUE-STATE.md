# QUEUE-STATE - the no-phone queue (relay/ORCH-NO-PHONE-QUEUE.txt)

The queue's memory. After any compaction, or when unsure where the queue is: read this file and
`relay/RULINGS-2026-11-11.txt` first, re-verify the last DONE step (V1-V2), then continue.

## SECURITY INCIDENTS

none

## BLOCKED ON THE OPERATOR

1. **THE COOLIFY API TOKEN IS GONE.** `C:/Users/KAMXKAM/AppData/Local/Temp/cf/` exists and is empty;
   its mtime is 2026-11-10 20:02; the cause is unknown. A7 ("remove the Coolify API token when the
   queue is done") assumes it exists - it does not. **The operator's action:** in Coolify, create a
   new API token with the same read-write scope, save it as
   `C:/Users/KAMXKAM/AppData/Local/Temp/cf/tok`, and revoke the old one - its whereabouts are
   unknown, so treat it as lost. Until then (Queue Ruling 1): no `production` promotion, because
   Part B's rollback ("restore the previous deployment from Coolify at once") cannot be done; code
   lands on `main`, and each promotion is PARKED below with its exact command and after-deploy
   checks, to run in order (C1 first) when the token is back. C2's Coolify setting (untick Build
   Variable) parks the same way. **C1's is not a parked action: Coolify's deploy health check is
   DO NOT ENABLE** until QUESTION 1 below is ruled (Queue Ruling 2).

2. **C3, THE DATABASE PASSWORD ROTATION** - prepared in `relay/DB-ROTATION-PLAN.md`, never executed. **The operator's action:** authorise it with a time (it also needs Coolify - the UI, or a new token).

3. **C1's QUESTION 1 - where Coolify's deploy health check may point** (REPORT-FW-READY-GATE.txt,
   R844). Coolify 4.5.0's check, once in effect, replaces the image HEALTHCHECK for the container's
   life, and Traefik stops routing to a container that is not healthy - so `/api/ready` there
   would make readiness into liveness (R375/R357 forbid it). **In force: A, the check stays off;
   releases are gated on the image's `/api/health` only.** The operator's choice among: B, the
   image HEALTHCHECK strict on `/api/ready` until it first passes, then `/api/health` (amends
   R375); C, a start-window route; D, the entrypoint refuses an unmigrated database (crash-loop
   risk); E (remove the HEALTHCHECK, enable Coolify's) is forbidden.

4. **C1's QUESTION 4 - the 60 s start period** (the operator's own figure in the queue's C1).
   Coolify sleeps the image's start period before checking, and Traefik serves the old and the new
   container side by side meanwhile, so the window in which a page from one build can ask the
   other for a hashed chunk grows from about 20 s to about 60 s per deploy. Reasoned, not
   measured. **The operator's action:** keep 60 s, or allow a shorter start period (the
   2 s start interval makes the container healthy on its first passing probe either way).

## HOLDS (until lifted)

- **No `docker builder prune` / `system prune` / image prune on this machine or on the server**
  until the Chromium pin is bumped (C1's QUESTION 2): Debian dropped `156.0.8078.73-1~deb12u1`,
  so a cold build fails R249 and every build here takes the Chromium layer from cache. Every
  gate:clone verdict until then reads "Chromium layer from cache; a cold build fails R249".
- **No privileged containers**, and nothing written to the shared Docker VM's kernel tunables:
  C1 dropped the page cache twice that way (Queue Ruling 2, deviation 5). A heavy step waits for
  memory.
- **Next ruling number: R852** (R844-R851 are C1's).

## PARKED PROMOTIONS (run in this order once the token is back)

### P1 - C1 FW-READY-GATE (main b4df928 or later)

From REPORT-FW-READY-GATE.txt's R849, with the PDF line added (Queue Ruling 2):

- [ ] 0. The Chromium pin is bumped and merged (HOLDS). A promotion before it builds only if the
      server's cache still holds the old layer - never rely on that.
- [ ] 1. QUESTION 1 stays open: Coolify's deploy check stays OFF.
- [ ] 2. gate:clone alone on the exact SHA promoted. No migration in this change.
- [ ] 3. `git push origin <sha>:production`, fast-forward. Watch Coolify's deployment list
      read-only; never trigger a deploy through the API.
- [ ] 4. The deploy log, in order: "Rolling update started." / "Custom healthcheck found in
      Dockerfile." / "Waiting for the start period (60 seconds) before starting healthcheck." /
      "Attempt 1 of 3 | Healthcheck status: "healthy"" / "New container is healthy." / "Rolling
      update completed."
- [ ] 5. `curl -fsS https://monreleve.ch/api/health` -> 200, body names "monreleve".
- [ ] 6. `curl -sS -w '\nHTTP %{http_code}\n' https://monreleve.ch/api/ready` -> HTTP 200.
- [ ] 7. `ssh monreleve-vps "docker inspect --format '{{json .Config.Healthcheck}} {{json
      .State.Health.Status}}' \$(docker ps -q --filter name=pkptabevr1nhtyygrq0mc8qx)"` ->
      Interval 10000000000, Timeout 5000000000, StartPeriod 60000000000, StartInterval
      2000000000, Retries 3, the `/api/health` command, "healthy". (Coolify's parser has never
      met `--start-interval` in production: this item is where that is proven.)
- [ ] 8. `docker exec <that container> curl -sS -o /dev/null -w '%{http_code}\n'
      http://localhost:3000/api/ready` -> 200.
- [ ] 9. **The PDF**, because the Dockerfile changed (Part B): one annual dossier PDF generated
      on production for a `@monreleve.test` account, opened, its pages and timestamps read.
- [ ] 10. Any failed item: restore the previous deployment from Coolify at once, then fix.

## macOS MINUTES (cap: 60 per step, 200 for the queue)

| step | run | billed min | running total |
|---|---|---|---|
| (start) | - | 0 | 0 |

The 27 minutes of IOS-2d / IOS-2e / IOS-2e-FIX on 2026-11-11 predate the queue.

## EVIDENCE OUTSIDE THE REPO

`C:/wt/queue-evidence/` - the release APKs and gate logs copied out of the IOS-2d/2e/2e-FIX
worktrees before A6 removes them, with `SHA256SUMS.txt`: 52da740 `e1cf60f7`, 0616b4e = 19ce23f
`463dc949`, 9a6dd55 `cc77402f`, cf485c4 `355afca5`. C4 reads these.

## SERVER ACCESS

SSH `monreleve-vps` (root on the shared VPS 164.132.85.231, key `id_ed25519_monreleve_vps`). Within
authority for what the queue asks (Queue Ruling 1). Every docker command names this app's uuids:
app `pkptabevr1nhtyygrq0mc8qx`, database `poxl2l4x0p0fxd85or0itnxo`. First contact 2026-11-11,
read-only: `hostname; whoami; docker ps | grep <uuids>` and one `docker inspect` of the app
container.

## STEPS

| step | status | SHAs | verified how | rulings |
|---|---|---|---|---|
| C0 is the new design live | DONE | production 52caca8 | deployed image read on the server: `pkptabevr1nhtyygrq0mc8qx:52caca8cf6388cb596c9a074175756d16a867858`; /api/health 200 naming monreleve; /api/ready 200 (database ok); /calculateur-lamal-cmu serves R743's "Individuelle"/"Commune", copy that exists only from the fw-calcs-a2 merge. ADDENDUM 1 was never delivered (FW-CALCS-A2.txt's orchestrator note), so "both addenda" = addendum 2 under the exception it restates. ORCH-A2-LIVE (named, nonexistent) not needed. | Queue Ruling 1 |
| C1 FW-READY-GATE | MERGED, readiness gate NOT delivered - releases still gated on liveness only; promotion PARKED (P1) | branch b339a88 (code ef88fa3); merge b4df928 | V1: tips, 5-file diff, merge tree == branch tip on web/docs/report; gate:clone PASSED on ef88fa3 (session log); r847.log both directions (unmigrated exit=1 + 503 `unmigrated`, migrated exit=0 + 200); R846 value tests. V2: gate:clone runs on the commit that carries this row, before its push; the verdict is recorded in the next QUEUE-STATE commit (it cannot be written into the commit it vouches for). V3: Queue Ruling 2. QUESTIONS 1 and 4 -> BLOCKED 3-4; Q2 -> step C1b; Q3 curl confirmed. | Queue Ruling 2 |
| C1b FW-CHROMIUM-PIN-2 (Queue Ruling 2, before C2) | next | | | |
| C2 FW-SECRETS (its prune of this app's server images waits for C1b - HOLDS) | | | | |
| C3 DB password rotation (prepare) | PARKED FOR THE OPERATOR (prepared, never executed) | - | relay/DB-ROTATION-PLAN.md: inventory, backup, stage env, ALTER ROLE, restart, align Coolify record, verify both directions (old password refused, new accepted), backups, rollback. Option B struck by C1's R844 (Queue Ruling 2): the release gate is the image's `/api/health`, which a container with a wrong password passes. Basis: relay/QUEUE-2026-10-28.txt "A Coolify restart applies env (measured)" - not re-run (no token). **Operator action:** authorise the rotation with a time; then the plan runs as written. | - |
| C4 AN-APK-DIFF | | | | |
| C5 AN-PARAM-BASELINES | | | | |
| C6 FW-TESTDB-GUARD | | | | |
| C7 FW-DEPLOY-DOC | | | | |
| C8 IOS-2f | | | | |
| C9 FW-WEB-ACCOUNT | | | | |
| C10 FW-DELAI-RAPPEL | | | | |
| C11 the guide and the hub | | | | |
