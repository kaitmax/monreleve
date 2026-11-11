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
   checks, to run in order (C1 first) when the token is back. The Coolify settings of C1 and C2
   park the same way.

## PARKED PROMOTIONS (run in this order once the token is back)

(none yet)

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
| C1 FW-READY-GATE | next | | | |
| C2 FW-SECRETS | | | | |
| C3 DB password rotation (prepare) | | | | |
| C4 AN-APK-DIFF | | | | |
| C5 AN-PARAM-BASELINES | | | | |
| C6 FW-TESTDB-GUARD | | | | |
| C7 FW-DEPLOY-DOC | | | | |
| C8 IOS-2f | | | | |
| C9 FW-WEB-ACCOUNT | | | | |
| C10 FW-DELAI-RAPPEL | | | | |
| C11 the guide and the hub | | | | |
