# docs/deploy.md — deploying Mon Relevé

Written for whoever puts this on a VPS, including the person who wrote it,
six months from now, at an hour when nothing is obvious.

Everything below was **measured against a running container** during FW28, not
inferred from the Dockerfile (R249). Where a claim has not been executed, it
says so under **NEEDS** rather than being written as if it had.

---

## 1. What is being deployed

One image, built from `web/Dockerfile`, serving Next.js standalone output on
port 3000 inside the container.

| | |
|---|---|
| Base | `node:22-bookworm-slim` |
| Runs as | `nextjs`, uid 1001, unprivileged |
| Browser | Debian `chromium`, **pinned** and verified at build time |
| Timezone | `Europe/Paris`, with `tzdata` installed so `Intl` resolves it |
| Entrypoint | `scripts/entrypoint.mjs` — refuses to start on a misconfiguration |

### What triggers a deploy: the `production` branch, never `main`

Since 2026-10-21 Coolify watches **`production`**, with auto-deploy on. A push
to `main` deploys nothing, so development never waits on production. To deploy,
apply any new migration first (section 4), then fast-forward `production` to a
`main` commit that has passed `pnpm gate:clone`: **that push is the deploy.** A
session follows a deploy by reading Coolify's deployment list and never triggers
one through the API. On 2026-10-14 an API call made right after a push produced
a second deploy of the same commit, three times. The Chromium pin lives only in
`web/Dockerfile`: Coolify's `CHROMIUM_VERSION` override was deleted the same day,
after it had kept every deploy failing for six days.

### The image is environment-specific, and that is not negotiable

`NEXT_PUBLIC_SITE_URL` is a **build argument**, not only a runtime variable.
Every static route renders its `<head>` — canonical included — during
`next build`, so an origin supplied only at runtime arrives too late and the
canonicals are already frozen.

```
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://monreleve.ch -t monreleve:prod web/
```

**Measured:** an image built without it failed **41 of 284** e2e specs while
the same source under `next start` passed all of them — correct CSS, correct
scripts, a correct `/api/health` naming the right runtime origin, and **zero**
`<link rel="canonical">`.

The build records the origin in `/etc/frontalier-site-origin`, and the
entrypoint **refuses to start** when the runtime value disagrees. Promoting a
staging image to production is therefore impossible rather than discouraged —
that failure would otherwise be green in every test and invisible in every log.

---

## 2. Environment

### Refused at startup — the container will not run

| Variable | Why |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. The entries table is the product. |
| `AUTH_SECRET` | Signs the short-lived print token. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |

**Any variable set to the placeholder `.env.example` ships is also refused**,
at any severity. A placeholder presents as configured — it is a value, it has
the right shape, every naive check passes — so the failure would otherwise be
discovered by a reader, in production, quietly.

### Starts, and reports itself degraded

These are **designed** states. `/api/ready` answers 503 and the entrypoint
names each one at boot. They are deliberately not fatal: a restart cannot
supply a missing variable, so turning them into crashes converts *this deploy
did not go out* into a crash-loop (R83).

| Variable | Absent means |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | localhost stand-in; `/sitemap.xml` and `/api/ready` answer 503; canonicals omitted |
| `RESEND_API_KEY` | confirmation mail is collected in memory and delivered to nobody |
| `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY` | the daily reminder job is **not scheduled at all**, reported by name |
| `ANDROID_PACKAGE_NAME` / `ANDROID_SHA256_CERT_FINGERPRINTS` | `/.well-known/assetlinks.json` is withheld entirely (R205) |
| `TRUSTED_PROXY_HOPS` | defaults to **1** (Traefik only). See below - the default is correct for this deployment |

### `TRUSTED_PROXY_HOPS` — which `X-Forwarded-For` entry is the real client (R362)

Rate limiting buckets callers by address, and the address comes from
`X-Forwarded-For`. **Proxies append**, so the header reads
`<whatever the client sent>, <what hop 1 saw>, <what hop 2 saw>, …` — the
**rightmost** entries are the ones our own infrastructure wrote and the
leftmost is attacker-controlled.

`TRUSTED_PROXY_HOPS` is how many proxies append before the request reaches
the app. The code takes the **n-th entry from the right**. Default `1`:
Coolify's Traefik, with nothing in front of it. Put a CDN in front and it
becomes `2`.

> This was wrong until FW-CODE-CAP, and the consequence was real: the code
> took the **first** entry, so any caller could choose their own rate-limit
> bucket — or share everyone else's — by sending one header. The per-IP
> limit was advisory against exactly the person it exists to stop.

**How to verify the count on the VPS**, which cannot be checked from the
repository — the number depends on what is actually in front of the app:

1. From a machine whose public address you know, request any page.
2. Read the container log for that request and print the raw header:
   `docker logs <app container> | grep -i x-forwarded-for` (or add a
   temporary log line if the header is not already recorded).
3. Count the entries and find the position of **your real address** from the
   right. That position is `TRUSTED_PROXY_HOPS`.

If your address is the **last** entry, the default of `1` is correct and
nothing needs setting. If the value is wrong, rate limiting still works —
it just buckets on the wrong thing, which is why this is worth checking
once rather than assuming.

### Set by the image — do not set these in the host

`HOSTNAME=0.0.0.0` · `PORT=3000` · `TZ=Europe/Paris` ·
`FRONTALIER_RUNTIME=1` · `FRONTALIER_CHROMIUM_PATH=/usr/bin/chromium` ·
`NODE_ENV=production`

`HOSTNAME` is the one that bites: Next binds `127.0.0.1` by default, which a
proxy in another container cannot reach. The symptom is a 502 from a server
that is running perfectly and logging nothing.

### Set by the deployment, deliberately

| Variable | Why it is not in the image |
|---|---|
| `FRONTALIER_SCHEDULER=1` | Enables the scheduler against a non-local database. **The image does not set it**, so `docker run monreleve` by hand cannot start notifying people. This process sends reminders without being asked, and a run against a real database is a notification in somebody's hand with no undo (R243). |

---

## 3. Ports and the health checks

There are two endpoints and **one Docker healthcheck**, and FW-READY-GATE
(R844) found that the second fact decides everything: Coolify 4.5.0 has no
separate release probe. It gates a release on Docker's health status, and
Traefik routes by the same status.

| Path | Who points at it | When it runs |
|---|---|---|
| `/api/health` | the **container's own `HEALTHCHECK`** (R375) — and through it **Coolify's release gate** and **Traefik's routing** (R844) | every 2 s for up to 60 s after start, then every 10 s for the container's life |
| `/api/ready` | **nothing automatic.** Coolify's check is disabled, and where it may point is QUESTION 1 of `REPORT-FW-READY-GATE.txt` | by hand: the after-deploy check, and `curl` inside the container |

### The container's `HEALTHCHECK`, as it now stands (R375, R846)

```
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --start-interval=2s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health')..."
```

**It is a liveness probe, and that is R375.** It used to probe `/api/ready`,
under a comment citing R83 and describing Coolify's check. It was harmless
until FW-READY made `/api/ready` check the database; from that commit a
database outage would have marked the **serving** container unhealthy every
ten seconds, which is the opposite of what R357 wants. R83 had already said so
in its own second sentence: *"Wire the restart policy, if any, at
`/api/health`."* R844 adds the platform fact that makes it non-negotiable:
whatever this probe asks is what Traefik routes on.

**A 60 s start window, probed every 2 s (R846).** Failures in the first
minute do not count, so a slow cold start is not marked unhealthy, and the
first success ends the window at once; inside it the probe runs every 2 s, so
the container turns healthy within about 2 s of answering instead of at the
first 10 s tick. `--start-interval` needs Docker 25 or later: the server runs
29.7.1, the development machine 29.6.1 (measured 2026-11-11).
`tests/unit/meta/healthcheck-target.test.ts` asserts every value, and the
values Coolify's own parser reads back from the line.

**One cost, stated.** While Coolify's check is disabled it copies
`--start-period` into its own deploy wait (`Application.php` 2725) and sleeps
that long before its first poll (`ApplicationDeploymentJob.php` 2743-2748), so
a deploy now waits 60 s there instead of 20 s. And because Traefik routes to
the new container as soon as Docker calls it healthy (c) while Coolify removes
the old one only after that wait (b), two versions now share the router for
about a minute per deploy instead of about 10 s — reasoned, not measured: a
page from one version can ask the other for a hashed `/_next/static` chunk it
does not have. QUESTION 4 of `REPORT-FW-READY-GATE.txt`.

**curl is in the image (R845).** Coolify generates its check as
`curl … || wget … || exit 1`, and the image had neither, so that command could
only ever fail. curl now comes with `--no-install-recommends`, with the eight
libraries apt requires for it (listed in `REPORT-FW-READY-GATE.txt`), in a
layer of its own right after the Chromium one — not inside it, because on
2026-11-11 Debian no longer offered the pinned Chromium, so that layer builds
only from a warm cache and changing one byte of it turns the build into the
R249 refusal (the Dockerfile's R845 block). The image grows by 1 287 352
bytes (`docker image inspect .Size`: 372 165 557 before, 373 452 909 after,
both built for the same origin on 2026-11-11). `pnpm test:container` asserts
curl from a running container.

> **Coolify's deploy health check is currently DISABLED**, so the deploy gate
> described below **does not exist yet**: a release goes live whether or not
> the new version is ready. Enabling it, pointed at `/api/ready`, is an
> operator step and nothing in this repository can do it. (FW-READY parked
> this; it is still open. **Do not enable it until QUESTION 1 of
> `REPORT-FW-READY-GATE.txt` is ruled**: R844 below shows it would not do what
> this paragraph assumed.)

**What does gate a release today — inferred from Coolify's source, not read
from Coolify:** the image's liveness `HEALTHCHECK`, through
`custom_healthcheck_found` (R844 (a) below). A release that cannot answer
`/api/health` within the window is rolled back, on the rolling path (b); a
release whose database is unmigrated goes live, because `/api/health` answers
200 without one (R357) — that half is proven below (R847).

### What Coolify 4.5.0 does with a health check (R844, read from its source)

Read from `coollabsio/coolify` at tag `v4.5.0` (commit `5ca69705`), not from
memory or its documentation; line numbers are at that tag. Traefik is read from
`traefik/traefik` at `v3.7.0` (the same lines at `v3.7.9`).

**The command.** When Coolify's own check is in effect,
`generate_healthcheck_commands()` (`app/Jobs/ApplicationDeploymentJob.php`
4402-4455) builds, with this application's values:

```
curl -s -X 'GET' -f 'http://localhost:3000/api/ready' > /dev/null || wget -q -O- 'http://localhost:3000/api/ready' > /dev/null || exit 1
```

Host `localhost`, method `GET` and scheme `http` are the column defaults
(`database/migrations/2023_03_27_081716_create_applications_table.php`
45-55); the port is the first *Ports exposes* entry when the Port field is
empty (4419-4427); the URL is shell-quoted (4441). It runs as the compose
`test: [CMD-SHELL, …]` (4201-4210). curl first, wget only if curl fails.

**(a) It REPLACES the image's `HEALTHCHECK` for the container's whole life —
when it is used at all.** There is no once-at-release probe.
`generate_compose_file()` writes the command into the service's `healthcheck:`
(4195-4212), which Docker runs for the container's life in place of the
image's. The release gate, `health_check()` (2721-2801), only reads Docker's
own status: it sleeps `start_period` (2743-2748), then reads
`docker inspect .State.Health.Status` up to `retries` times, `interval` apart
(2749-2792).

**But not while this Dockerfile carries a `HEALTHCHECK`.** Each deploy reads
the Dockerfile (4143-4152), and `parseHealthcheckFromDockerfile()`
(`app/Models/Application.php` 2686-2745) — while Coolify's check is disabled —
copies its interval, timeout, start period and retries into the application
(2723-2739) and sets `custom_healthcheck_found` (2740-2743). With the flag
set, the compose gets **no** Coolify healthcheck (job 4198), and the release
gate still runs — 2727 skips it only when the flag is false — on the
**image's** `HEALTHCHECK`, that is `/api/health`. **Enabling the check in the
UI does not clear the flag:** `app/Livewire/Project/Shared/HealthChecks.php`
writes it back unchanged (218, in `toggleHealthcheck()` 199-231). Three things
clear it: `HEALTHCHECK` leaving the repository Dockerfile (`Application.php`
2691-2702); the build pack changing away from dockerfile (386-392); or the
application's inline `dockerfile` column changing, through a General-page save
or an API PATCH carrying `dockerfile`
(`app/Livewire/Project/Application/General.php` 845-847,
`app/Http/Controllers/Api/ApplicationsController.php` 3781-3783). This app is
built from git and the deploy job only reads that column (593, 4144). The
UI says the opposite — *"Enabling this configuration replaces the custom
healthcheck currently defined by the application"*
(`resources/views/livewire/project/shared/health-checks.blade.php` 27-33) — and
the deploy job does not do it. As things stand, **pointing Coolify at
`/api/ready` would be silently ignored**: the deploy log would say
`Custom healthcheck found in Dockerfile.` (2733) where it would otherwise say
`Healthcheck URL (inside the container): …` (2739-2742). **The exception:** if
the flag is cleared by one of those three while the check is enabled, the next
deploy does not re-parse (2704 runs only while it is disabled) and writes
Coolify's `/api/ready` check into the compose — the forbidden case below.

*Inferred, not read:* the flag cannot be read without Coolify. Its two tells
are the *"Custom healthcheck detected"* callout on the application's
Healthcheck page, and that log line in any deploy.

**(b) When it fails, the old container keeps serving — on the rolling path
only.** `rolling_update()` (2670-2717) starts the new container beside the old
one, runs `health_check()`, then `stop_running_container()` (4943-4990):
unhealthy, or still `starting` after the last poll, gives *"New container is
not healthy, rolling back to the old container."* (4970), the deployment
marked failed (4971) and the new container shut down (4972); the old one is
untouched. That path is taken only with no port mappings, consistent container
naming off, no pull request and no custom `--ip` (2687). Otherwise the old
container is stopped **first** and the new one started with **no health check
at all** (2687-2706). Production's container name,
`pkptabevr1nhtyygrq0mc8qx-20261102T154408`, is the uuid-timestamp form
(`bootstrap/helpers/docker.php` 573-588), so consistent naming is off; the
port mappings were not read.

**(c) Traefik stops routing to a container Docker does not call healthy.**
Coolify 4.5.0's default proxy is `traefik:v3.7` with the Docker provider
(`bootstrap/helpers/proxy.php` 741, 808-809), and Coolify never sets
`allowEmptyServices`. Traefik's `keepContainer()`
(`pkg/provider/docker/config.go` 197-232) drops any container whose health is
not `healthy` — *"Filtering unhealthy or starting container"* (228-231) — and
re-reads on every `health_status` event (`pdocker.go` 123-127). The only
container behind a router takes the router with it: every path 404s, static
pages included. The server's actual proxy version was not read. The same
filter means **a new container takes traffic the moment Docker calls it
healthy**, whatever Coolify's poll concludes afterwards.

**So (a) "replaces" and (c) "stops routing" both hold.** Pointing Coolify's
check at `/api/ready`, where it took effect, would turn readiness into
liveness for the container's life: a database blip, three failed probes 10 s
apart, and every page out of routing — what R375 and R357 forbid. That is
QUESTION 1 of `REPORT-FW-READY-GATE.txt`, with the options.

### What `/api/ready` checks (R353)

**`/api/ready` checks the database (R353).** It answers 503 unless the
database is reachable (`SELECT 1` inside 2 s) **and** carries every migration
this build ships. The body names one of `unreachable`, `timeout`,
`unmigrated`, `migration_failed` - never the driver error, the host, the port
or a migration name, because this endpoint is unauthenticated (R354); the
detail is in the container log.

For `unmigrated`, the fix is section 4 of this document. For `unreachable`,
check the database service is up and that `DATABASE_URL` resolves from inside
the container. R83 meant a failing readiness check to stop the deploy and
leave the running version serving; on Coolify 4.5.0 it can only do that
through Docker's health status, which lasts the container's life — (a) and
(c) above.

`/api/health` deliberately does **not** check the database: an orchestrator
restarts what fails liveness, and a restart cannot repair a database, so a
liveness check that waited on a slow one would crash-loop the container while
the previous version stayed down.

**They are not interchangeable, and R83 is why.** Readiness returning 503 stops
a deploy and leaves the running version serving — the outcome wanted. Liveness
returns 200 whenever the process answers, because an orchestrator **restarts**
what fails liveness, and a restart cannot supply a missing environment
variable. Wiring the deploy check to `/api/health` would ship a degraded
version; wiring the restart policy to `/api/ready` would crash-loop a container
that is merely missing a credential. R844 adds that on Coolify 4.5.0 the
deploy check and the container's healthcheck are **one** Docker healthcheck,
so neither half of that sentence can be had on its own there.

### The refusal, proven locally (R847)

Run on 2026-11-11 against `monreleve:ready-gate-after` (this change's image,
built for `https://ready-gate.example`) and a **new** scratch database on
`frontalier-postgres` with no tables in it. One container for both halves; the
command is Coolify's, verbatim, run the way its `CMD-SHELL` runs it. The full
log is in `REPORT-FW-READY-GATE.txt`.

Presence first, from inside the same container:

```
$ docker exec <c> curl -s http://localhost:3000/api/health
{"service":"monreleve","instance":null,"status":"ok","reasons":[],"origin":"https://ready-gate.example","runtime":true}
```

**Unmigrated — refused:**

```
$ docker exec <c> sh -c "curl -s -X 'GET' -f 'http://localhost:3000/api/ready' > /dev/null || wget -q -O- 'http://localhost:3000/api/ready' > /dev/null || exit 1"; echo "exit=$?"
sh: 1: wget: not found
exit=1
$ docker exec <c> curl -s -w '\nHTTP %{http_code}\n' http://localhost:3000/api/ready
{"ready":false,"checks":[{"name":"site-origin","ok":true},{"name":"database","ok":false,"reason":"unmigrated","detail":"The database is reachable but does not have every migration this version ships. Run prisma migrate deploy as docs/deploy.md section 4 describes, then redeploy. Ruling R353."}]}
HTTP 503
```

curl exits 22 on the 503 (`-f`), so the shell tries wget, which the image
deliberately lacks; the result is exit 1 either way. Meanwhile the container's
own `HEALTHCHECK` read **`"healthy"`** — R357 working: liveness does not wait
on the database, which is exactly why it cannot be the readiness gate.

**Migrated — passes.** `prisma migrate deploy` against that database applied
all 15 migrations; then, in the same container:

```
$ docker exec <c> sh -c "curl -s -X 'GET' -f 'http://localhost:3000/api/ready' > /dev/null || wget -q -O- 'http://localhost:3000/api/ready' > /dev/null || exit 1"; echo "exit=$?"
exit=0
$ docker exec <c> curl -s -w '\nHTTP %{http_code}\n' http://localhost:3000/api/ready
{"ready":true,"checks":[{"name":"site-origin","ok":true},{"name":"database","ok":true}]}
HTTP 200
```

**Control — the image as it was before R845**, the same command against
`/api/health` of a server that was answering it:

```
sh: 1: curl: not found
sh: 1: wget: not found
exit=1
```

So until this change, Coolify's own check could not have passed even on
liveness. The container's healthcheck as Docker holds it:

```
$ docker inspect --format '{{json .Config.Healthcheck}}' <c>
{"Test":["CMD-SHELL","node -e \"fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""],"Interval":10000000000,"Timeout":5000000000,"StartPeriod":60000000000,"StartInterval":2000000000,"Retries":3}
```

**Not in a suite, and why.** `pnpm test:container` is database-free by its own
header (*"Anything that needs a database, a browser or a rendered page belongs
to test:db or test:e2e"*), and the pair needs a database it can migrate between
the halves. What it does gain is the structural half: curl present, read from a
running container. `test:container:write`, which already owns a scratch
database and a running container, is the natural home for the pair; that is
parked in the report rather than done here.

### PARKED — the operator's Coolify step: do not enable until QUESTION 1 is ruled

Recorded so the step is ready once the ruling exists, **not** to be done now.
In Coolify 4.5.0: **Projects → the project → the environment → the
application → sidebar *Healthcheck*** (`…/application/<uuid>/healthcheck`) →
**Enable** (confirm *Enable healthcheck?*) → *Check type* HTTP request,
*Method* GET, *Scheme* HTTP, *Host* localhost, *Port* 3000, *Path*
`/api/ready`, *Expected code* 200 → **Timing and retries**: *Start period* 60
or more, *Interval* 10, *Timeout* 5, *Retries* 3 → save.

While the Dockerfile carries a `HEALTHCHECK` that does nothing — unless the flag
is later cleared, which makes it the forbidden case (R844 (a));
without one it is the forbidden case (R844 (c)). Read-only, and useful before
the ruling: whether the Healthcheck page shows *"Custom healthcheck
detected"*; whether the last deploy log says `Custom healthcheck found in
Dockerfile.`; and that **General → Networking → Port mappings** is empty and
**Advanced → Container → Container naming** reads *Generated name (rolling
updates)*, which together decide
whether a failed check rolls back at all (R844 (b)).

`/api/health` names the product in a `service` field. Every harness in this
repository refuses to run until it sees that name (R169) — a health check that
proves something is listening proves nothing about **what**.

---

## 4. Migrations

The migrations travel **inside the image**, so the version being deployed and
the migrations applied for it are one artefact.

Run them as a **separate, deliberate step** before the new version serves. They
are not run on boot, because a server that migrates on boot migrates once per
replica, concurrently.

### Migrations run FROM THE SERVER, never through a published database port

Open a shell on the VPS - SSH, or Coolify's own **Servers → localhost →
Terminal**, which needs nothing on your machine - and run the migration there,
on the `coolify` network. **Never make the database public to reach it from
outside**, not even for a few minutes.

**Why this is a rule (2026-10-24).** To apply
`20261015104441_code_attempt_budget`, the production Postgres was made public
through Coolify's API on a published port, the migration ran through it, and the
API was asked to make it private again. Coolify's record said `is_public: false`
- and then **nobody could prove the port was closed**, for two hours. The
workstation doing the checking sat behind something that completes EVERY
outbound TCP handshake itself: a connection to that port "opened", but so did a
connection to a port nothing had ever used, and to an unrelated host on the same
port. Every "still open" reading that afternoon measured the interceptor, not
the server. A database stop/start was even made on that evidence, costing the
live site about fifteen seconds of `/api/ready` 503. What finally settled it was
the server itself: `ss -ltnp` showed nothing on the port and the database's
`-proxy` container was gone. Whether Coolify's API close would have removed that
container on its own was never established.

**Three lessons.**
1. **The step that needed undoing should never have been taken.** The server
   terminal was there all along; a migration needs no published port.
2. **A flag is not evidence.** Neither Coolify's `is_public` nor an API's 200
   says what is listening.
3. **A TCP connection from the outside is not evidence either, until it is
   controlled.** Check closure FROM THE SERVER (`ss -ltnp`, `docker ps`), or with
   a probe only the real service can answer - a Postgres SSL request, an HTTP
   request - beside a POSITIVE control (a port known to be served must answer)
   and a NEGATIVE one (a port nothing ever used). A probe that cannot tell those
   two apart measures nothing.

**Where the migrations come from.** The command below copies them out of the
RUNNING container, which is right only when the running image already ships
them. When the migration arrives with the release being promoted - the usual
case - the running image does not have it yet. Take the migration folder from
the repository at the commit being promoted instead, and confirm that
`migrate status` lists exactly the migrations that commit adds before running
`migrate deploy`.

### The command, corrected after it was run for real (2026-10-14)

This section used to say:

```
docker run --rm -e DATABASE_URL=... monreleve:prod \
  node node_modules/prisma/build/index.js migrate deploy
```

**That cannot work, and nothing found out until the production database turned
out to be unmigrated** - every data-backed request on the live site returned
500 for roughly a week. Two things are wrong with it, both measured against the
running container rather than reasoned about:

1. **The runtime image has no Prisma CLI.** `next.config.ts` emits
   `output: 'standalone'` and the runner stage copies the traced bundle plus
   `prisma/`, so the *migrations* ship inside the image and the *tool that
   applies them* does not. Measured:
   `ls node_modules/prisma/build/index.js` -> `No such file or directory`.
2. **The schema carries no connection URL.** Prisma 7 moved it out of
   `schema.prisma` into `prisma.config.ts` - that file's own header explains
   why - and `prisma.config.ts` is **not** copied into the runner stage. A CLI
   run against the image alone therefore has no datasource at all.

What works: the image supplies the migrations, a throwaway container supplies
the CLI, and the repository supplies the config.

```sh
APP=$(docker ps --format '{{.Names}}' | grep ^pkptabevr1nhtyygrq0mc8qx)
WORK=/tmp/mr-prisma

rm -rf "$WORK" && mkdir -p "$WORK"
docker cp "$APP":/app/prisma "$WORK/prisma"    # migrations, out of the image
rm -f "$WORK/prisma/seed.ts"                   # production is never seeded
# and the datasource, out of the repository:
#   scp web/prisma.config.ts root@<host>:"$WORK/prisma.config.ts"

# the URL comes from the running container - keep it in a variable, never echo it
DB=$(docker inspect "$APP" --format '{{range .Config.Env}}{{println .}}{{end}}' \
       | sed -n 's/^DATABASE_URL=//p')

docker run --rm --network coolify -e DATABASE_URL="$DB" \
  -v "$WORK":/work -w /work node:22 \
  sh -lc 'npm i --no-audit --no-fund --loglevel=error prisma@7.10.0 \
          && npx prisma migrate status'

# only then swap `migrate status` for `migrate deploy`

rm -rf "$WORK"
```

`node:22` rather than `node:22-slim`: slim ships no OpenSSL and Prisma warns
that it "failed to detect the libssl/openssl version to use". The warning is
survivable for a read-only `migrate status`; it is not worth carrying into the
command that writes.

**Run `migrate status` before `migrate deploy`, every time.** It is read-only,
it proves the config file loaded, and it names the database it resolved to. On
2026-10-14 it printed `Datasource "db": PostgreSQL database "postgres", schema
"public" at "poxl2l4x0p0fxd85or0itnxo:5432"` - which is how the right database
was confirmed before a single statement was written to it. Two Postgres
containers on this host have near-identical generated names and one of them
belongs to another project; `migrate status` is what tells them apart.

---


## 5. Backups, and a restore that has actually been performed

**A backup nobody has restored is a hope.** `pg_dump` running nightly proves a
file is being written; it says nothing about whether that file can be turned
back into a database.

Nightly, from the host:

```
docker exec -e PGPASSWORD=... <postgres> pg_dump --clean --if-exists \
  -d postgresql://<user>@127.0.0.1:5432/<db> -f /tmp/monreleve-$(date +%F).sql
```

### The restore is tested by `pnpm test:container:restore`

It does the destructive half, which is the whole point:

1. a scratch database, migrated from `prisma/migrations`
2. rows seeded into every table the dossier depends on
3. `pg_dump` to a file, and the file asserted non-trivial in size
4. **`DROP DATABASE`** — confirmed gone by querying `pg_database`, not assumed
5. `CREATE` + restore from the file
6. every row count compared, table by table, with what was there before

A restore into a database that still holds its data proves nothing: every
count matches because nothing was lost. The drop is what makes the comparison
mean something.

**Executed during FW28 — see REPORT-FW28.txt for the counts.**

---

## 6. Reminder punctuality, measured (R236)

`REMINDER_CRON` is `*/5 * * * *` and the question parked since FW27 was
whether five minutes is the right number, to be answered on the real image.

**The arithmetic.** A person choosing 17:30 receives their reminder at the
first pass **at or after** 17:30, so worst-case lateness is:

```
  one cron interval            300 000 ms   (*/5)
+ one pass over the due set        273 ms   measured, 500 due users
= worst case                    300 273 ms   = 5 min 0,3 s
```

**Measured**, not estimated: 500 users with reminders enabled, the indexed
query the pass actually runs, timed against a scratch database. The pass is
**0,09 %** of the interval, so the cadence is what decides punctuality and the
query is not going to become the reason a reminder is late.

Correctness does not depend on the interval. *Exactly one per day* is the
unique `(userId, sentOn)` row in `ReminderSent`, and that holds at any cadence
— which is also why two containers produce one notification rather than two.

**If a reminder must arrive at 17:30 rather than by 17:35**, the answer is a
per-minute cron and a heavier query, and that is a product decision about
punctuality rather than a defect. Left at five minutes.

### Concurrency

Every replica runs its own scheduler — `globalThis` is per-process and cannot
see another container. **Measured with two containers against one database: 6
jobs enqueued, 3 executed by each, 6 total.** Work is distributed, not
duplicated, and each log line names the instance that produced it.

There is deliberately **no advisory lock**. A session-held lock survives a
container that dies until its connection is reaped, so the survivor silently
never schedules — a failure indistinguishable from working, because the dead
container had been doing the job. Every claim here is a unique row instead: a
dead container releases nothing because it holds nothing.

---

## 7. Co-hosted sites — do not touch

This VPS hosts other projects. The following are **not** ours:

- any container not named `monreleve-*`
- any database other than the one `DATABASE_URL` names
- ports already bound by another project

**Rules that have already been needed.** When another project holds a port,
move ours rather than stopping theirs. A harness may kill only a process tree
it spawned itself (R179) — a neighbour's container is not one.

Recorded because it happened: during FW28 a Docker engine failure required
`wsl --shutdown`, which stopped every container on the machine. Ours returned
by restart policy; a neighbour's did not, and it was **left alone** rather than
restarted by us.

---

## 8. NEEDS — what the operator must supply

Nothing below was created during FW28. R250 forbids this task from obtaining a
real credential, and every one of these touches a real account or a real
person.

| # | What | Where it goes | Until then |
|---|---|---|---|
| N1 | A Firebase project, a service account, and its private key | `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` | the reminder job is not scheduled, and says so by name |
| N2 | A Resend API key, and a verified sending domain | `RESEND_API_KEY`, `EMAIL_FROM` | confirmation mail is collected in memory and delivered to nobody |
| N3 | **SPF and DKIM** for the sending subdomain | DNS | double opt-in lands in spam and the list silently stops growing — a failure that looks like nobody being interested |
| N4 | The production domain and its TLS certificate | `NEXT_PUBLIC_SITE_URL`, **as a build argument** | the image serves the localhost stand-in and omits canonicals |
| N5 | The Android package name and signing certificate fingerprints | `ANDROID_PACKAGE_NAME`, `ANDROID_SHA256_CERT_FINGERPRINTS` | `/.well-known/assetlinks.json` is withheld (R205) |
| N6 | A generated `AUTH_SECRET` | the host's environment | **the container refuses to start** |
| N7 | The VPS, Coolify, and a managed PostgreSQL with nightly dumps | — | nothing is deployed |

**N4 is the one most easily got wrong**, because it is a *build* argument. An
image built for staging and run with a production origin is refused at startup
by design — but an image built with **no** origin starts and serves without
canonicals, which no test catches and search notices slowly.

---

## 9. Not deployed by FW28

`Umami` (SPEC 15 / R143) and `GlitchTip` (D32) are named in `tasks/todo.md` for
this task and are **not** in this image. `/confidentialite` still says the site
does not measure its audience, and `e2e/analytics.spec.ts` holds that sentence
on every public route: no analytics script, no cookie, no third-party request.

Shipping either without changing that sentence fails there, which is the point.
See REPORT-FW28.txt under **PARKED**.
